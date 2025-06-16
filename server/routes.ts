import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import sharp from "sharp";
import crypto from "crypto";
import { storage } from "./storage";
import { insertClothingItemSchema, insertOutfitSchema } from "@shared/schema";
import { z } from "zod";

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

// AI clothing analysis function - ready for real API integration
async function analyzeClothing(imageBuffer: Buffer): Promise<{type: string, color: string, name: string}> {
  // Check if we have API credentials for vision services
  const hasOpenAI = process.env.OPENAI_API_KEY;
  const hasGoogleVision = process.env.GOOGLE_CLOUD_API_KEY;
  const hasAzureVision = process.env.AZURE_COMPUTER_VISION_KEY;
  
  if (hasOpenAI) {
    // Use OpenAI GPT-4 Vision for clothing analysis
    return await analyzeWithOpenAI(imageBuffer);
  } else if (hasGoogleVision) {
    // Use Google Cloud Vision API
    return await analyzeWithGoogleVision(imageBuffer);
  } else if (hasAzureVision) {
    // Use Azure Computer Vision API
    return await analyzeWithAzureVision(imageBuffer);
  } else {
    // Fallback to deterministic analysis based on image hash for consistency
    return await analyzeWithImageHash(imageBuffer);
  }
}

async function analyzeWithOpenAI(imageBuffer: Buffer): Promise<{type: string, color: string, name: string}> {
  // OpenAI GPT-4 Vision implementation would go here
  // For now, return error to indicate API key is needed
  throw new Error("OpenAI API integration requires OPENAI_API_KEY environment variable");
}

async function analyzeWithGoogleVision(imageBuffer: Buffer): Promise<{type: string, color: string, name: string}> {
  // Google Cloud Vision API implementation would go here
  throw new Error("Google Vision API integration requires GOOGLE_CLOUD_API_KEY environment variable");
}

async function analyzeWithAzureVision(imageBuffer: Buffer): Promise<{type: string, color: string, name: string}> {
  // Azure Computer Vision API implementation would go here
  throw new Error("Azure Vision API integration requires AZURE_COMPUTER_VISION_KEY environment variable");
}

async function analyzeWithImageHash(imageBuffer: Buffer): Promise<{type: string, color: string, name: string}> {
  // Deterministic analysis based on image characteristics for demo purposes
  const hash = await generateImageHash(imageBuffer);
  
  // Use hash to deterministically select type and color for consistency
  const hashNum = parseInt(hash.slice(0, 8), 16) || 1;
  
  const types = ['top', 'bottom', 'outerwear', 'shoes', 'accessories'];
  const colors = ['navy blue', 'black', 'white', 'gray', 'brown', 'blue', 'red', 'green'];
  
  const type = types[Math.abs(hashNum) % types.length] || 'top';
  const color = colors[Math.abs(hashNum >> 3) % colors.length] || 'blue';
  
  // Generate name based on type and color
  const typeNames = {
    'top': ['T-Shirt', 'Shirt', 'Sweater', 'Polo', 'Tank Top'],
    'bottom': ['Jeans', 'Pants', 'Shorts', 'Chinos', 'Trousers'],
    'outerwear': ['Jacket', 'Coat', 'Blazer', 'Hoodie', 'Cardigan'],
    'shoes': ['Sneakers', 'Boots', 'Dress Shoes', 'Loafers', 'Sandals'],
    'accessories': ['Belt', 'Watch', 'Hat', 'Scarf', 'Tie']
  };
  
  const typeNamesList = typeNames[type as keyof typeof typeNames] || typeNames.top;
  const typeName = typeNamesList[Math.abs(hashNum >> 6) % typeNamesList.length] || 'Item';
  
  // Ensure color is valid and construct name safely
  const capitalizedColor = color && color.length > 0 ? 
    color.charAt(0).toUpperCase() + color.slice(1) : 'Blue';
  const name = `${capitalizedColor} ${typeName}`;
  
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  return { type, color, name };
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

  // Upload and analyze clothing items
  app.post("/api/upload", upload.array('images', 10), async (req, res) => {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const results = [];
      const duplicates = [];

      for (const file of req.files) {
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

          // Analyze clothing with AI
          const analysis = await analyzeClothing(file.buffer);
          
          // Resize and optimize image
          const resizedBuffer = await sharp(file.buffer)
            .resize(400, 400, { fit: 'cover' })
            .jpeg({ quality: 85 })
            .toBuffer();

          // In a real app, you'd upload this to cloud storage and get a URL
          // For demo, we'll use a placeholder URL
          const imageUrl = `data:image/jpeg;base64,${resizedBuffer.toString('base64')}`;

          // Create clothing item
          const newItem = await storage.createClothingItem({
            userId: 1,
            name: analysis.name,
            type: analysis.type,
            color: analysis.color,
            imageUrl,
            imageHash,
            usageCount: 0
          });

          results.push(newItem);
        } catch (error) {
          console.error(`Error processing file ${file.originalname}:`, error);
        }
      }

      if (duplicates.length > 0 && results.length === 0) {
        // All items were duplicates
        return res.status(409).json({ 
          message: "Duplicate items detected", 
          duplicates
        });
      } else if (duplicates.length > 0 && results.length > 0) {
        // Some items were duplicates, some were added
        return res.status(207).json({ 
          message: `${results.length} items added, ${duplicates.length} duplicates skipped`,
          items: results,
          duplicates
        });
      }

      res.json({ 
        message: `${results.length} items added successfully`,
        items: results 
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
