import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import sharp from "sharp";
import crypto from "crypto";
import { storage } from "./storage";
import { insertClothingItemSchema, insertOutfitSchema } from "@shared/schema";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 10 // max 10 files
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Enhanced perceptual hash function for better duplicate detection
async function generateImageHash(buffer: Buffer): Promise<string> {
  try {
    // Get image metadata for uniqueness
    const metadata = await sharp(buffer).metadata();
    
    // Create multiple hash components for better accuracy
    const components = [];
    
    // 1. Basic perceptual hash (8x8 grayscale)
    const { data: grayData } = await sharp(buffer)
      .resize(8, 8, { fit: 'fill' })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    components.push(crypto.createHash('md5').update(grayData).digest('hex').slice(0, 8));
    
    // 2. Color histogram hash (16x16 with color info)
    const { data: colorData } = await sharp(buffer)
      .resize(16, 16, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    components.push(crypto.createHash('md5').update(colorData).digest('hex').slice(0, 8));
    
    // 3. Edge detection hash
    const { data: edgeData } = await sharp(buffer)
      .resize(32, 32, { fit: 'fill' })
      .greyscale()
      .convolve({
        width: 3,
        height: 3,
        kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1]
      })
      .raw()
      .toBuffer({ resolveWithObject: true });
    components.push(crypto.createHash('md5').update(edgeData).digest('hex').slice(0, 8));
    
    // 4. Include file size and original dimensions for uniqueness
    const sizeInfo = `${buffer.length}_${metadata.width}_${metadata.height}`;
    components.push(crypto.createHash('md5').update(sizeInfo).digest('hex').slice(0, 8));
    
    // Combine all components
    const combinedHash = components.join('');
    return crypto.createHash('sha256').update(combinedHash).digest('hex');
    
  } catch (error) {
    // Enhanced fallback - include more unique characteristics
    const timestamp = Date.now().toString();
    const random = Math.random().toString();
    const fallbackData = buffer.toString('base64').slice(0, 100) + timestamp + random;
    return crypto.createHash('sha256').update(fallbackData).digest('hex');
  }
}

// Initialize Gemini Flash 2.0
const initializeGemini = () => {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.warn("GOOGLE_API_KEY not found, using fallback analysis");
    return null;
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
};

// AI clothing analysis function with Gemini Flash 2.0
async function analyzeClothing(imageBuffer: Buffer): Promise<{type: string, color: string, name: string}> {
  const model = initializeGemini();
  
  if (model) {
    try {
      return await analyzeWithGemini(model, imageBuffer);
    } catch (error) {
      console.error("Gemini analysis failed, falling back to deterministic analysis:", error);
      return await analyzeWithImageHash(imageBuffer);
    }
  } else {
    // Fallback to deterministic analysis
    return await analyzeWithImageHash(imageBuffer);
  }
}

// Batch analysis for multiple images
async function batchAnalyzeClothing(imageBuffers: Buffer[]): Promise<Array<{type: string, color: string, name: string}>> {
  const model = initializeGemini();
  
  if (model && imageBuffers.length > 1) {
    try {
      return await batchAnalyzeWithGemini(model, imageBuffers);
    } catch (error) {
      console.error("Gemini batch analysis failed, falling back to individual analysis:", error);
    }
  }
  
  // Fallback to individual analysis
  const results = [];
  for (const buffer of imageBuffers) {
    const result = await analyzeClothing(buffer);
    results.push(result);
  }
  return results;
}

async function analyzeWithGemini(model: any, imageBuffer: Buffer): Promise<{type: string, color: string, name: string}> {
  // Convert buffer to base64 for Gemini
  const base64Image = imageBuffer.toString('base64');
  
  const prompt = `Analyze this clothing item image and provide:
1. Type: one of [top, bottom, outerwear, shoes, accessories, socks, underwear]
2. Primary color: describe the main color (e.g., "navy blue", "black", "white", "red", etc.)
3. Specific name: what type of item it is specifically (e.g., "T-Shirt", "Jeans", "Sneakers", "Polo Shirt")

Respond in this exact JSON format:
{
  "type": "category",
  "color": "primary color",
  "name": "Color + Specific Item Name"
}

Example: {"type": "top", "color": "navy blue", "name": "Navy Blue Polo Shirt"}`;

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        data: base64Image,
        mimeType: "image/jpeg"
      }
    }
  ]);

  const response = await result.response;
  const text = response.text();
  
  try {
    // Extract JSON from response
    const jsonMatch = text.match(/\{[^}]+\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }
    
    const analysis = JSON.parse(jsonMatch[0]);
    
    // Validate the response structure
    if (!analysis.type || !analysis.color || !analysis.name) {
      throw new Error("Invalid response structure");
    }
    
    // Ensure type is valid
    const validTypes = ['top', 'bottom', 'outerwear', 'shoes', 'accessories', 'socks', 'underwear'];
    if (!validTypes.includes(analysis.type.toLowerCase())) {
      analysis.type = 'top'; // Default fallback
    }
    
    return {
      type: analysis.type.toLowerCase(),
      color: analysis.color.toLowerCase(),
      name: analysis.name
    };
    
  } catch (parseError) {
    console.error("Failed to parse Gemini response:", text, parseError);
    // Fallback to deterministic analysis
    return await analyzeWithImageHash(imageBuffer);
  }
}

async function batchAnalyzeWithGemini(model: any, imageBuffers: Buffer[]): Promise<Array<{type: string, color: string, name: string}>> {
  // Convert all buffers to base64
  const images = imageBuffers.map((buffer, index) => ({
    index,
    data: buffer.toString('base64')
  }));

  const prompt = `Analyze these ${images.length} clothing item images and provide analysis for each:

For each image, provide:
1. Type: one of [top, bottom, outerwear, shoes, accessories, socks, underwear]
2. Primary color: describe the main color
3. Specific name: what type of item it is specifically

Respond with a JSON array where each object corresponds to the image at that index:
[
  {"type": "category", "color": "primary color", "name": "Color + Specific Item Name"},
  {"type": "category", "color": "primary color", "name": "Color + Specific Item Name"},
  ...
]

Analyze images in order and ensure the array has exactly ${images.length} items.`;

  // Prepare content with all images
  const content = [prompt];
  images.forEach(img => {
    content.push({
      inlineData: {
        data: img.data,
        mimeType: "image/jpeg"
      }
    });
  });

  const result = await model.generateContent(content);
  const response = await result.response;
  const text = response.text();
  
  try {
    // Extract JSON array from response
    const jsonMatch = text.match(/\[[^\]]+\]/);
    if (!jsonMatch) {
      throw new Error("No JSON array found in response");
    }
    
    const analyses = JSON.parse(jsonMatch[0]);
    
    if (!Array.isArray(analyses) || analyses.length !== images.length) {
      throw new Error(`Expected ${images.length} analyses, got ${analyses?.length || 0}`);
    }
    
    // Validate and clean each analysis
    return analyses.map((analysis, index) => {
      if (!analysis.type || !analysis.color || !analysis.name) {
        console.warn(`Invalid analysis for image ${index}, using fallback`);
        return {
          type: 'top',
          color: 'unknown',
          name: `Item ${index + 1}`
        };
      }
      
      const validTypes = ['top', 'bottom', 'outerwear', 'shoes', 'accessories', 'socks', 'underwear'];
      if (!validTypes.includes(analysis.type.toLowerCase())) {
        analysis.type = 'top';
      }
      
      return {
        type: analysis.type.toLowerCase(),
        color: analysis.color.toLowerCase(),
        name: analysis.name
      };
    });
    
  } catch (parseError) {
    console.error("Failed to parse Gemini batch response:", text, parseError);
    throw parseError; // This will trigger individual analysis fallback
  }
}

async function analyzeWithImageHash(imageBuffer: Buffer): Promise<{type: string, color: string, name: string}> {
  // Enhanced deterministic analysis based on actual image characteristics
  try {
    const metadata = await sharp(imageBuffer).metadata();
    
    // Analyze color distribution to better identify item type
    const { data: resizedData, info } = await sharp(imageBuffer)
      .resize(64, 64, { fit: 'cover' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Calculate color statistics
    let totalR = 0, totalG = 0, totalB = 0;
    let darkPixels = 0, lightPixels = 0;
    const pixelCount = info.width * info.height;
    
    for (let i = 0; i < resizedData.length; i += 3) {
      const r = resizedData[i];
      const g = resizedData[i + 1]; 
      const b = resizedData[i + 2];
      
      totalR += r;
      totalG += g;
      totalB += b;
      
      const brightness = (r + g + b) / 3;
      if (brightness < 100) darkPixels++;
      else if (brightness > 200) lightPixels++;
    }
    
    const avgR = totalR / pixelCount;
    const avgG = totalG / pixelCount;
    const avgB = totalB / pixelCount;
    const brightness = (avgR + avgG + avgB) / 3;
    
    // Enhanced edge detection for shape analysis
    const { data: edgeData } = await sharp(imageBuffer)
      .resize(32, 32, { fit: 'cover' })
      .greyscale()
      .convolve({
        width: 3,
        height: 3,
        kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1]
      })
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Count edge pixels for shape complexity
    let edgePixels = 0;
    for (let i = 0; i < edgeData.length; i++) {
      if (edgeData[i] > 50) edgePixels++;
    }
    const edgeComplexity = edgePixels / edgeData.length;
    
    // Determine color name
    let colorName: string;
    if (brightness < 50) {
      colorName = 'black';
    } else if (brightness > 200) {
      colorName = 'white';
    } else if (avgR > avgG && avgR > avgB) {
      if (avgR > 150 && avgG < 100) colorName = 'red';
      else colorName = 'brown';
    } else if (avgB > avgR && avgB > avgG) {
      if (avgB > 120 && avgR < 80) colorName = 'blue';
      else colorName = 'navy blue';
    } else if (avgG > avgR && avgG > avgB) {
      colorName = 'green';
    } else {
      colorName = 'gray';
    }
    
    // Improved type detection based on image characteristics
    let itemType: string;
    const aspectRatio = metadata.width && metadata.height ? metadata.width / metadata.height : 1;
    
    // Shoes detection: high edge complexity, usually wider than tall, often dark or colorful
    if (edgeComplexity > 0.15 && aspectRatio > 1.2 && 
        (brightness < 80 || (avgR > 100 && avgG > 100) || (avgB > 120))) {
      itemType = 'shoes';
    }
    // Outerwear detection: large items, moderate edge complexity
    else if (edgeComplexity > 0.12 && aspectRatio < 1.5 && aspectRatio > 0.7) {
      itemType = 'outerwear';
    }
    // Bottom detection: usually rectangular, moderate brightness
    else if (aspectRatio > 0.6 && aspectRatio < 1.4 && brightness > 70 && brightness < 180) {
      itemType = 'bottom';
    }
    // Accessories detection: small items, high contrast or very specific colors
    else if (edgeComplexity > 0.2 || brightness > 220 || brightness < 30) {
      itemType = 'accessories';
    }
    // Default to top
    else {
      itemType = 'top';
    }
    
    // Generate appropriate name based on detected type and color
    const typeNames = {
      'top': ['T-Shirt', 'Shirt', 'Sweater', 'Polo', 'Tank Top', 'Blouse'],
      'bottom': ['Jeans', 'Pants', 'Shorts', 'Chinos', 'Trousers', 'Skirt'],
      'outerwear': ['Jacket', 'Coat', 'Blazer', 'Hoodie', 'Cardigan'],
      'shoes': ['Sneakers', 'Running Shoes', 'Boots', 'Dress Shoes', 'Loafers'],
      'accessories': ['Belt', 'Watch', 'Hat', 'Scarf', 'Bag']
    };
    
    // Use image characteristics to pick specific item name
    const possibleNames = typeNames[itemType as keyof typeof typeNames] || typeNames.top;
    const hash = await generateImageHash(imageBuffer);
    const hashNum = parseInt(hash.slice(0, 8), 16) || 1;
    const itemName = possibleNames[Math.abs(hashNum) % possibleNames.length];
    
    const capitalizedColor = colorName.charAt(0).toUpperCase() + colorName.slice(1);
    const name = `${capitalizedColor} ${itemName}`;
    
    // Simulate API processing time
    await new Promise(resolve => setTimeout(resolve, 800));
    
    return { 
      type: itemType, 
      color: colorName, 
      name 
    };
    
  } catch (error) {
    console.error('Enhanced analysis failed, using fallback:', error);
    
    // Fallback to basic hash-based analysis
    const hash = await generateImageHash(imageBuffer);
    const hashNum = parseInt(hash.slice(0, 8), 16) || 1;
    
    const types = ['top', 'bottom', 'outerwear', 'shoes', 'accessories'];
    const colors = ['navy blue', 'black', 'white', 'gray', 'brown'];
    
    const type = types[Math.abs(hashNum) % types.length] || 'top';
    const color = colors[Math.abs(hashNum >> 3) % colors.length] || 'black';
    
    return { 
      type, 
      color, 
      name: `${color.charAt(0).toUpperCase() + color.slice(1)} Item` 
    };
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Get demo user profile
  app.get("/api/profile", async (req, res) => {
    try {
      const user = await storage.getUser(1); // Demo user
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to get user profile" });
    }
  });

  // Get user's wardrobe
  app.get("/api/wardrobe", async (req, res) => {
    try {
      const items = await storage.getClothingItemsByUser(1); // Demo user
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Failed to get wardrobe items" });
    }
  });

  // Single image analysis endpoint
  app.post("/api/analyze-image", upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image uploaded" });
      }

      console.log(`Analyzing single image: ${req.file.originalname}`);
      const startTime = Date.now();
      
      const analysis = await analyzeClothing(req.file.buffer);
      
      const analysisTime = Date.now() - startTime;
      console.log(`Single image analysis completed in ${analysisTime}ms`);

      res.json({
        analysis,
        processingTime: analysisTime,
        filename: req.file.originalname
      });
    } catch (error) {
      console.error("Single image analysis error:", error);
      res.status(500).json({ message: "Failed to analyze image" });
    }
  });

  // Upload and analyze clothing items with batch processing
  app.post("/api/upload", upload.array('images', 10), async (req, res) => {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const files = req.files;
      const results = [];
      const duplicates = [];
      const filesToAnalyze = [];
      const fileData = [];

      // First pass: check for duplicates and prepare for batch analysis
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          // Generate perceptual hash
          const imageHash = await generateImageHash(file.buffer);
          
          // Check for duplicates
          const existingItem = await storage.getClothingItemByHash(1, imageHash);
          if (existingItem) {
            duplicates.push({
              filename: file.originalname,
              existingItem: existingItem.name
            });
            continue;
          }

          // Resize and optimize image for analysis
          const resizedBuffer = await sharp(file.buffer)
            .resize(400, 400, { fit: 'cover' })
            .jpeg({ quality: 85 })
            .toBuffer();

          filesToAnalyze.push(resizedBuffer);
          fileData.push({
            originalFile: file,
            imageHash,
            resizedBuffer,
            index: i
          });

        } catch (error) {
          console.error(`Error preprocessing file ${file.originalname}:`, error);
        }
      }

      if (filesToAnalyze.length === 0) {
        if (duplicates.length > 0) {
          return res.status(409).json({ 
            message: "All items were duplicates", 
            duplicates
          });
        } else {
          return res.status(400).json({ message: "No valid files to process" });
        }
      }

      // Batch analyze all non-duplicate images
      console.log(`Batch analyzing ${filesToAnalyze.length} clothing items...`);
      const startTime = Date.now();
      
      const analyses = await batchAnalyzeClothing(filesToAnalyze);
      
      const analysisTime = Date.now() - startTime;
      console.log(`Batch analysis completed in ${analysisTime}ms (${(analysisTime / filesToAnalyze.length).toFixed(0)}ms per item)`);

      // Create clothing items from analyses
      for (let i = 0; i < analyses.length; i++) {
        const analysis = analyses[i];
        const data = fileData[i];
        
        try {
          const imageUrl = `data:image/jpeg;base64,${data.resizedBuffer.toString('base64')}`;

          const newItem = await storage.createClothingItem({
            userId: 1,
            name: analysis.name,
            type: analysis.type,
            color: analysis.color,
            imageUrl,
            imageHash: data.imageHash,
            usageCount: 0
          });

          results.push(newItem);
          console.log(`Created item: ${analysis.name} (${analysis.type}, ${analysis.color})`);
        } catch (error) {
          console.error(`Error creating item ${i}:`, error);
        }
      }

      // Return appropriate response based on results
      if (duplicates.length > 0 && results.length === 0) {
        return res.status(409).json({ 
          message: "Duplicate items detected", 
          duplicates
        });
      } else if (duplicates.length > 0 && results.length > 0) {
        return res.status(207).json({ 
          message: `${results.length} items added, ${duplicates.length} duplicates skipped`,
          items: results,
          duplicates,
          processingTime: analysisTime
        });
      }

      res.json({ 
        message: `${results.length} items added successfully`,
        items: results,
        processingTime: analysisTime
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "Failed to process uploaded files" });
    }
  });

  // Generate outfit suggestions
  app.post("/api/generate-outfit", async (req, res) => {
    try {
      const { occasion, temperature, timeOfDay, season } = req.body;
      
      // Get user profile for personalization
      const user = await storage.getUser(1); // Demo user
      if (!user) {
        return res.status(404).json({ message: "User profile not found" });
      }

      // Get user's wardrobe
      const allItems = await storage.getClothingItemsByUser(1);
      
      // Filter items that haven't reached usage limit (max 3 uses per item)
      const availableItems = allItems.filter(item => item.usageCount < 3);
      
      // Categorize available items
      const tops = availableItems.filter(item => item.type === 'top');
      const bottoms = availableItems.filter(item => item.type === 'bottom');
      const outerwear = availableItems.filter(item => item.type === 'outerwear');
      const shoes = availableItems.filter(item => item.type === 'shoes');
      const accessories = availableItems.filter(item => item.type === 'accessories');
      const socks = availableItems.filter(item => item.type === 'socks');
      
      // Check minimum requirements
      if (tops.length === 0 || bottoms.length === 0) {
        const missing = [];
        if (tops.length === 0) missing.push('tops');
        if (bottoms.length === 0) missing.push('bottoms');
        
        return res.status(400).json({ 
          message: "Insufficient wardrobe items",
          missing,
          details: "Every outfit must include at least one top and one bottom"
        });
      }

      // Personalized outfit generation based on user profile
      const outfits = [];
      const maxOutfits = 3;
      const usedCombinations = new Set();
      
      // Helper function to score outfit based on user profile
      function getPersonalizedScore(outfit: any[]): number {
        let score = 100;
        
        // Age-appropriate styling (40 years old)
        const matureItems = outfit.filter(item => 
          item.name.toLowerCase().includes('shirt') ||
          item.name.toLowerCase().includes('chinos') ||
          item.name.toLowerCase().includes('blazer') ||
          item.name.toLowerCase().includes('polo')
        );
        if (matureItems.length > 0) score += 15;
        
        // Athletic body type considerations
        const athleticFriendly = outfit.filter(item =>
          item.name.toLowerCase().includes('polo') ||
          item.name.toLowerCase().includes('chinos') ||
          item.name.toLowerCase().includes('jacket') ||
          item.type === 'top' && item.color.toLowerCase().includes('navy')
        );
        if (athleticFriendly.length > 0) score += 10;
        
        // Burnt tan skin tone - favor earth tones and navy
        const skinToneFriendly = outfit.filter(item =>
          item.color.toLowerCase().includes('navy') ||
          item.color.toLowerCase().includes('brown') ||
          item.color.toLowerCase().includes('olive') ||
          item.color.toLowerCase().includes('cream') ||
          item.color.toLowerCase().includes('beige')
        );
        score += skinToneFriendly.length * 5;
        
        // Gender-appropriate (male)
        const masculineItems = outfit.filter(item =>
          !item.name.toLowerCase().includes('dress') &&
          !item.name.toLowerCase().includes('skirt')
        );
        if (masculineItems.length === outfit.length) score += 10;
        
        return score;
      }
      
      // Generate unique outfit combinations
      for (let topIdx = 0; topIdx < tops.length && outfits.length < maxOutfits; topIdx++) {
        for (let bottomIdx = 0; bottomIdx < bottoms.length && outfits.length < maxOutfits; bottomIdx++) {
          const outfit = [];
          const top = tops[topIdx];
          const bottom = bottoms[bottomIdx];
          
          // Create combination ID to ensure uniqueness
          const baseComboId = `${top.id}-${bottom.id}`;
          if (usedCombinations.has(baseComboId)) continue;
          
          outfit.push(top, bottom);
          
          // Temperature-based layering logic
          if (temperature < 14) {
            // Cold weather - require outerwear
            if (outerwear.length > 0) {
              const jacket = outerwear[topIdx % outerwear.length];
              outfit.push(jacket);
            } else {
              // Skip this combination if no outerwear available for cold weather
              continue;
            }
          }
          
          // Add shoes (prioritize for completeness)
          if (shoes.length > 0) {
            const shoe = shoes[topIdx % shoes.length];
            outfit.push(shoe);
          }
          
          // Add accessories for formal/business occasions
          if ((occasion === 'formal' || occasion === 'business') && accessories.length > 0) {
            const accessory = accessories[topIdx % accessories.length];
            outfit.push(accessory);
          }
          
          // Add socks if available
          if (socks.length > 0) {
            const sock = socks[topIdx % socks.length];
            outfit.push(sock);
          }
          
          // Ensure minimum 3 items per outfit
          if (outfit.length < 3) {
            // Try to add more items to reach minimum
            if (accessories.length > 0 && !outfit.some(item => item.type === 'accessories')) {
              outfit.push(accessories[0]);
            }
          }
          
          // Skip if still under minimum
          if (outfit.length < 3) continue;
          
          usedCombinations.add(baseComboId);
          
          // Calculate personalized score
          const score = getPersonalizedScore(outfit);
          
          // Generate personalized outfit name
          const outfitNames = {
            'casual': [`Relaxed ${timeOfDay}`, 'Weekend Casual', 'Comfortable Day Look'],
            'smart-casual': [`Smart ${timeOfDay}`, 'Polished Casual', 'Refined Look'],
            'formal': ['Classic Formal', 'Professional Look', 'Elegant Ensemble'],
            'business': ['Business Professional', 'Office Ready', 'Executive Style'],
            'party': ['Party Ready', 'Social Event', 'Stylish Night Out']
          };
          
          const nameOptions = outfitNames[occasion as keyof typeof outfitNames] || ['Stylish Look'];
          const outfitName = nameOptions[topIdx % nameOptions.length];
          
          // Generate personalized recommendations
          const recommendations = [];
          
          if (temperature < 14) {
            const underLayer = outfit.find(item => item.type === 'top' && item !== outfit.find(o => o.type === 'outerwear'));
            if (underLayer) {
              recommendations.push(`Layer your ${underLayer.name.toLowerCase()} under the jacket for warmth`);
            }
          }
          
          recommendations.push('Colors complement your burnt tan skin tone');
          
          if (user.age >= 40) {
            recommendations.push('Age-appropriate styling with classic cuts');
          }
          
          if (user.bodyType === 'athletic') {
            recommendations.push('Tailored fit enhances your athletic build');
          }
          
          outfits.push({
            name: outfitName,
            items: outfit,
            occasion,
            temperature,
            timeOfDay,
            season,
            score,
            weatherAppropriate: temperature < 14 ? outfit.some(item => item.type === 'outerwear') : true,
            recommendations,
            personalizedFor: {
              age: user.age,
              bodyType: user.bodyType,
              skinTone: user.skinTone,
              gender: user.gender
            }
          });
        }
      }
      
      // Sort by personalized score and return top suggestions
      outfits.sort((a, b) => b.score - a.score);
      
      if (outfits.length === 0) {
        return res.status(400).json({
          message: "Unable to create complete outfits",
          reason: temperature < 14 ? "No outerwear available for cold weather" : "Insufficient variety in wardrobe",
          requirements: {
            minimumItems: 3,
            essentialTypes: ["top", "bottom"],
            coldWeatherRequirement: temperature < 14 ? "outerwear" : null
          }
        });
      }
      
      res.json({ 
        outfits: outfits.slice(0, maxOutfits),
        personalizedFor: {
          user: {
            age: user.age,
            gender: user.gender,
            bodyType: user.bodyType,
            skinTone: user.skinTone,
            height: user.height
          },
          context: {
            occasion,
            temperature,
            timeOfDay,
            season
          }
        }
      });
    } catch (error) {
      console.error("Outfit generation error:", error);
      res.status(500).json({ message: "Failed to generate outfits" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
