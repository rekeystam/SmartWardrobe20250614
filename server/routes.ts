import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import sharp from "sharp";
import crypto from "crypto";
import { storage } from "./storage";
import { insertClothingItemSchema, insertOutfitSchema, type ClothingItem } from "@shared/schema";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { detectDuplicate } from "@shared/utils";
import { refineCategory, shouldPromptForCategoryConfirmation } from "@shared/categoryRules";
import { createUsageCount, validateUsageForOutfit, MAX_USAGE_COUNT } from "@shared/usageUtils";

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
    // Standardize image preprocessing: 256x256 grayscale for consistent hash computation
    const preprocessed = await sharp(buffer)
      .resize(256, 256, { fit: 'cover' })
      .greyscale()
      .normalize()
      .raw()
      .toBuffer();

    // Generate perceptual hash using DCT-based approach
    const hash = crypto.createHash('sha256').update(preprocessed).digest('hex');

    // Create a shorter, more efficient hash for comparison
    return hash.slice(0, 32);
  } catch (error) {
    console.error('Hash generation failed:', error);
    // Fallback to basic hash
    return crypto.createHash('md5').update(buffer).digest('hex').slice(0, 16);
  }
}

// Enhanced duplicate detection with configurable similarity threshold
async function checkForDuplicates(newHash: string, userId: number): Promise<{isDuplicate: boolean, similarItem?: any, similarity?: number}> {
  try {
    // Get all user items for comparison
    const userItems = await storage.getClothingItemsByUser(userId);

    const SIMILARITY_THRESHOLD = 0.85; // 85% similarity threshold

    for (const item of userItems) {
      if (item.imageHash) {
        const similarity = calculateHashSimilarity(newHash, item.imageHash);

        if (similarity >= SIMILARITY_THRESHOLD) {
          console.log(`Duplicate detected: ${similarity.toFixed(3)} similarity with item ${item.id} (${item.name})`);
          return {
            isDuplicate: true,
            similarItem: item,
            similarity: Math.round(similarity * 100)
          };
        }
      }
    }

    return { isDuplicate: false };
  } catch (error) {
    console.error('Duplicate check failed:', error);
    return { isDuplicate: false };
  }
}

// Calculate similarity between two hashes (Hamming distance approach)
function calculateHashSimilarity(hash1: string, hash2: string): number {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) {
    return 0;
  }

  let matches = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] === hash2[i]) {
      matches++;
    }
  }

  return matches / hash1.length;
}

// Initialize Gemini AI
function initializeGemini() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.log('Google API key not found. Using fallback analysis.');
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI;
  } catch (error) {
    console.error('Failed to initialize Gemini:', error);
    return null;
  }
}

// Enhanced clothing analysis with comprehensive AI integration
async function analyzeClothing(imageBuffer: Buffer): Promise<{type: string, color: string, name: string, demographic: string, material: string, pattern: string, occasion: string}> {
  const genAI = initializeGemini();

  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      return await analyzeWithGemini(model, imageBuffer);
    } catch (error) {
      console.error('Gemini analysis failed, using fallback:', error);
    }
  }

  // Fallback to deterministic analysis
  return await analyzeWithImageHash(imageBuffer);
}

// Batch analysis for multiple items
async function batchAnalyzeClothing(imageBuffers: Buffer[]): Promise<Array<{type: string, color: string, name: string, demographic: string, material: string, pattern: string, occasion: string}>> {
  const genAI = initializeGemini();

  if (genAI && imageBuffers.length > 1) {
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      return await batchAnalyzeWithGemini(model, imageBuffers);
    } catch (error) {
      console.error('Batch Gemini analysis failed:', error);
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

async function analyzeWithGemini(model: any, imageBuffer: Buffer): Promise<{type: string, color: string, name: string, demographic: string, material: string, pattern: string, occasion: string}> {
  // Convert buffer to base64 for Gemini
  const base64Image = imageBuffer.toString('base64');

  const prompt = `CRITICAL: Scan this image thoroughly and identify EVERY SINGLE clothing item visible. This may be a flat lay with multiple items arranged together, or individual pieces photographed separately.

SYSTEMATIC SCAN PROCESS:
1. Examine the entire image methodically from left to right, top to bottom
2. Look for items that may be folded, stacked, or partially obscured
3. Count each distinct piece separately (even if they're similar)
4. Include all visible clothing regardless of size or prominence in the photo

ITEM CATEGORIES TO IDENTIFY:
- TOPS: T-shirts, blouses, sweaters, hoodies, tank tops, dress shirts, polo shirts
- BOTTOMS: Jeans, pants, shorts, skirts, leggings, trousers, chinos
- OUTERWEAR: Jackets, coats, blazers, cardigans, vests, sweaters (heavy)
- SHOES: Sneakers, boots, heels, flats, sandals, dress shoes
- ACCESSORIES: Belts, hats, scarves, bags, jewelry, ties, socks, undergarments
- DRESSES/JUMPSUITS: One-piece garments

COLOR IDENTIFICATION:
- Use specific color names (navy blue, forest green, burgundy, cream, charcoal gray)
- For patterned items, identify the dominant color first
- Note secondary colors in patterns (e.g., "navy blue with white stripes")

ENHANCED TAGGING SYSTEM:
For each item, provide comprehensive tags covering:
- Color descriptors: ["navy", "dark", "neutral", "vibrant"]
- Material clues: ["cotton", "denim", "knit", "leather", "silk", "wool"]
- Style attributes: ["casual", "formal", "sporty", "vintage", "modern"]
- Fit descriptors: ["fitted", "loose", "oversized", "tailored", "relaxed"]
- Seasonal indicators: ["summer", "winter", "transitional", "layering"]
- Occasion suitability: ["work", "weekend", "evening", "athletic", "formal"]

OCCASION GUIDELINES (choose ONE most appropriate for each item):
1. "Everyday Casual" - T-shirts, jeans, casual shoes, hoodies, sneakers for daily wear
2. "Work Smart" - Button-downs, blazers, chinos, loafers for professional settings
3. "Active & Sporty" - Athletic wear, gym clothes, running shoes for physical activities
4. "Evening Social" - Dressy pieces, statement items, heels for social events
5. "Dress to Impress" - Formal wear, suits, dress shoes for special occasions

RESPONSE FORMAT:
Always return a JSON ARRAY, even for single items:
[
  {
    "name": "Descriptive Item Name",
    "category": "top|bottom|outerwear|shoes|accessories|dress",
    "occasion": "single_occasion_label",
    "color": "primary_color",
    "description": "Detailed description of the item and its styling potential",
    "imageHash": "",
    "tags": ["comprehensive", "style", "tags", "for", "advanced", "matching"],
    "coordinates": {"x": 0, "y": 0, "area": "description of location in image"},
    "confidence": 95
  }
]

IMPORTANT: Even if you see only ONE item, return it as an array with one object. Count carefully - many images contain multiple pieces that might look similar but are distinct items.`;

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
    // Extract JSON from response, handling markdown code blocks and multiple formats
    let jsonText = text;

    // Remove markdown code blocks if present
    if (text.includes('```json')) {
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      }
    } else if (text.includes('```')) {
      // Handle generic code blocks
      const codeMatch = text.match(/```\s*([\s\S]*?)\s*```/);
      if (codeMatch) {
        jsonText = codeMatch[1];
      }
    } else {
      // Try to find JSON array first (for multi-item responses)
      const arrayMatch = text.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        jsonText = arrayMatch[0];
      } else {
        // Fallback to single object
        const objectMatch = text.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          jsonText = objectMatch[0];
        }
      }
    }

    const parsed = JSON.parse(jsonText);

    // Handle both single objects and arrays of multiple items
    const items = Array.isArray(parsed) ? parsed : [parsed];

    // For single image analysis, return the first (or only) item
    const analysis = items[0];

    // Validate the response structure
    if (!analysis.category || !analysis.color || !analysis.name) {
      throw new Error("Invalid response structure");
    }

    // Ensure category is valid
    const validTypes = ['top', 'bottom', 'outerwear', 'shoes', 'accessories'];
    if (!validTypes.includes(analysis.category.toLowerCase())) {
      analysis.category = 'top'; // Default fallback
    }

    // Map the new structure to legacy format for compatibility
    return {
      type: analysis.category.toLowerCase(),
      color: analysis.color.toLowerCase(),
      name: analysis.name,
      demographic: 'unisex',
      material: analysis.tags?.[1] || 'unknown',
      pattern: 'solid',
      occasion: analysis.occasion || 'Everyday Casual'
    };

  } catch (parseError) {
    console.error("Failed to parse Gemini response:", text, parseError);
    // Fallback to deterministic analysis
    return await analyzeWithImageHash(imageBuffer);
  }
}

async function batchAnalyzeWithGemini(model: any, imageBuffers: Buffer[]): Promise<Array<{type: string, color: string, name: string, demographic: string, material: string, pattern: string, occasion: string}>> {
  // Convert all buffers to base64
  const images = imageBuffers.map((buffer, index) => ({
    index,
    data: buffer.toString('base64')
  }));

  const prompt = `Analyze these ${images.length} clothing items and return clean JSON objects with standardized categorization.

OCCASION GUIDELINES (choose ONE most appropriate):
1. "Everyday Casual" - T-shirts, jeans, casual shoes, hoodies, sneakers, accessories for errands/weekends
2. "Work Smart" - Button-down shirts, blazers, chinos, loafers, professional accessories for office wear
3. "Active & Sporty" - Tracksuits, gym wear, leggings, technical jackets, running shoes, athletic socks for movement/sports
4. "Evening Social" - Bold, stylish pieces including dress shirts, skirts, boots, printed jackets, heels for parties/dates
5. "Dress to Impress" - Suits, gowns, dress shoes, formal blazers, formal shirts for weddings/ceremonies

CATEGORY TYPES: top, bottom, outerwear, shoes, accessories

OVERLAP RULES:
- Ties/vests: Choose between "Work Smart" or "Dress to Impress" based on formality
- Caps/gym hats: Choose between "Active & Sporty" or "Everyday Casual" based on style
- Blazers: Casual blazers = "Work Smart", formal blazers = "Dress to Impress"

Return JSON array with exactly ${images.length} objects:
[
  {
    "name": "Standardized Item Name",
    "category": "category_type",
    "occasion": "single_occasion_label",
    "color": "main_color",
    "description": "One sentence describing how item fits the assigned occasion",
    "imageHash": "",
    "tags": ["color_descriptor", "material_type", "fit_style", "mood_descriptor"]
  }
]

Analyze images in order and maintain consistent formatting.`;

  // Prepare content with all images  
  const content = [
    { text: prompt },
    ...images.map(img => ({
      inlineData: {
        data: img.data,
        mimeType: "image/jpeg"
      }
    }))
  ];

  const result = await model.generateContent(content);
  const response = await result.response;
  const text = response.text();

  try {
    // Extract JSON array from response, handling markdown code blocks
    let jsonText = text;

    // Remove markdown code blocks if present
    if (text.includes('```json')) {
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      }
    } else if (text.includes('```')) {
      const codeMatch = text.match(/```\s*([\s\S]*?)\s*```/);
      if (codeMatch) {
        jsonText = codeMatch[1];
      }
    } else {
      const arrayMatch = text.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        jsonText = arrayMatch[0];
      }
    }

    const analyses = JSON.parse(jsonText);

    if (!Array.isArray(analyses) || analyses.length !== imageBuffers.length) {
      throw new Error(`Expected ${imageBuffers.length} analyses, got ${Array.isArray(analyses) ? analyses.length : 'non-array'}`);
    }

    // Convert to legacy format for compatibility
    return analyses.map(analysis => ({
      type: analysis.category?.toLowerCase() || 'top',
      color: analysis.color?.toLowerCase() || 'unknown',
      name: analysis.name || 'Unknown Item',
      demographic: 'unisex',
      material: analysis.tags?.[1] || 'unknown',
      pattern: 'solid',
      occasion: analysis.occasion || 'Everyday Casual'
    }));

  } catch (parseError) {
    console.error("Failed to parse batch Gemini response:", text, parseError);
    throw parseError;
  }
}

// Deterministic fallback analysis using image characteristics
async function analyzeWithImageHash(imageBuffer: Buffer): Promise<{type: string, color: string, name: string, demographic: string, material: string, pattern: string, occasion: string}> {
  try {
    // Get image metadata
    const metadata = await sharp(imageBuffer).metadata();

    // Resize and get color data for analysis
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

    // Enhanced occasion determination
    let occasion: string;
    if (itemType === 'shoes' && (colorName === 'black' || colorName === 'brown')) {
      occasion = brightness > 100 ? 'Work Smart' : 'Dress to Impress';
    } else if (itemType === 'outerwear' && edgeComplexity > 0.15) {
      occasion = 'Work Smart';
    } else if (brightness > 180 || colorName === 'white') {
      occasion = 'Everyday Casual';
    } else if (brightness < 60) {
      occasion = 'Evening Social';
    } else {
      occasion = 'Everyday Casual';
    }

    const color = colorName.toLowerCase();
    const type = itemType.toLowerCase();

    return { 
      type, 
      color, 
      name: `${colorName} ${itemName}`,
      demographic: 'unisex',
      material: 'unknown', 
      pattern: 'solid',
      occasion
    };
  } catch (error) {
    console.error('Fallback analysis failed:', error);

    // Ultimate fallback
    const colors = ['blue', 'black', 'white', 'gray', 'red', 'green'];
    const types = ['top', 'bottom', 'outerwear'];
    const names = ['T-Shirt', 'Pants', 'Jacket'];

    const randomIndex = Math.floor(Math.random() * 3);
    const color = colors[randomIndex];
    const type = types[randomIndex];
    const name = names[randomIndex];

    return { 
      type, 
      color, 
      name: `${color} ${type}`,
      demographic: 'unisex',
      material: 'unknown', 
      pattern: 'solid',
      occasion: 'casual'
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

  // Multi-item analysis for flat lay photos
  app.post("/api/analyze-flat-lay", upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image uploaded" });
      }

      console.log(`Analyzing flat lay image: ${req.file.originalname}`);
      const startTime = Date.now();

      const genAI = initializeGemini();

      if (genAI) {
        try {
          const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
          const base64Image = req.file.buffer.toString('base64');

          const prompt = `CRITICAL: This is a flat lay photo showing multiple clothing items arranged together. Scan this image systematically and identify EVERY SINGLE clothing item visible.

SYSTEMATIC SCAN PROCESS:
1. Examine the entire image methodically from left to right, top to bottom
2. Look for items that may be folded, stacked, or partially obscured
3. Count each distinct piece separately (even if they're similar)
4. Include all visible clothing regardless of size or prominence in the photo

ITEM CATEGORIES TO IDENTIFY:
- TOPS: T-shirts, blouses, sweaters, hoodies, tank tops, dress shirts, polo shirts, cardigans
- BOTTOMS: Jeans, pants, shorts, skirts, leggings, trousers, chinos
- OUTERWEAR: Jackets, coats, blazers, cardigans (heavy), vests
- SHOES: Sneakers, boots, heels, flats, sandals, dress shoes
- ACCESSORIES: Belts, hats, scarves, bags, jewelry, ties, socks, undergarments

RESPONSE FORMAT - Return a JSON array with one object per item:
[
  {
    "name": "Specific Item Name",
    "type": "top|bottom|outerwear|shoes|accessories",
    "color": "primary_color",
    "material": "material_type",
    "pattern": "solid|striped|printed|etc",
    "occasion": "Everyday Casual|Work Smart|Active & Sporty|Evening Social|Dress to Impress",
    "demographic": "unisex|men|women",
    "description": "Brief description of the item and its location in the image"
  }
]

IMPORTANT: Count carefully and return EVERY distinct clothing item you can see, even if they look similar.`;

          const result = await model.generateContent([
            { text: prompt },
            {
              inlineData: {
                data: base64Image,
                mimeType: "image/jpeg"
              }
            }
          ]);

          const response = await result.response;
          const text = response.text();

          // Extract JSON from response
          let jsonText = text;
          if (text.includes('```json')) {
            const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
              jsonText = jsonMatch[1];
            }
          } else if (text.includes('```')) {
            const codeMatch = text.match(/```\s*([\s\S]*?)\s*```/);
            if (codeMatch) {
              jsonText = codeMatch[1];
            }
          } else {
            const arrayMatch = text.match(/\[[\s\S]*\]/);
            if (arrayMatch) {
              jsonText = arrayMatch[0];
            }
          }

          const items = JSON.parse(jsonText);
          const analysisTime = Date.now() - startTime;

          console.log(`Flat lay analysis completed: Found ${items.length} items in ${analysisTime}ms`);

          const itemsArray = Array.isArray(items) ? items : [items];
          console.log(`Flat lay analysis successful: ${itemsArray.length} items found`);
          
          res.json({
            items: itemsArray,
            processingTime: analysisTime,
            filename: req.file.originalname,
            itemCount: itemsArray.length,
            originalImage: base64Image // Include original image for cropping
          });

        } catch (error) {
          console.error("Gemini flat lay analysis failed:", error);
          // Fallback to single item analysis
          const analysis = await analyzeClothing(req.file.buffer);
          const analysisTime = Date.now() - startTime;
          
          console.log(`Fallback analysis completed: ${analysis.name}`);

          res.json({
            items: [analysis],
            processingTime: analysisTime,
            filename: req.file.originalname,
            itemCount: 1,
            fallback: true
          });
        }
      } else {
        // No API key - use fallback
        const analysis = await analyzeClothing(req.file.buffer);
        const analysisTime = Date.now() - startTime;
        
        console.log(`No API key - fallback analysis completed: ${analysis.name}`);

        res.json({
          items: [analysis],
          processingTime: analysisTime,
          filename: req.file.originalname,
          itemCount: 1,
          fallback: true
        });
      }
    } catch (error) {
      console.error("Flat lay analysis error:", error);
      res.status(500).json({ message: "Failed to analyze flat lay image" });
    }
  });

  // Process and add individual items from flat lay analysis
  app.post("/api/add-flat-lay-items", async (req, res) => {
    try {
      const { items, originalImage } = req.body;

      if (!items || !Array.isArray(items)) {
        return res.status(400).json({ message: "Invalid items data" });
      }

      console.log(`Processing ${items.length} items from flat lay analysis`);
      const startTime = Date.now();

      const addedItems: ClothingItem[] = [];
      const duplicates: any[] = [];
      const errors: any[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        try {
          // Generate a unique hash for each item based on its properties and timestamp
          const itemSignature = `${item.name}_${item.type}_${item.color}_${Date.now()}_${i}`;
          const imageHash = crypto.createHash('md5').update(itemSignature).digest('hex').slice(0, 16);

          // Skip duplicate check for flat lay items to avoid false positives
          console.log(`Creating flat lay item: ${item.name} (${item.type}, ${item.color})`);

          // Refine category based on analysis
          const refinedCategory = refineCategory(item.type, item.name, item.color);

          // Create usage count
          const usageCount = createUsageCount();

          // Validate required fields
          const itemData = {
            userId: 1,
            name: item.name || 'Unknown Item',
            type: refinedCategory.type || item.type || 'top',
            color: item.color || 'unknown',
            material: item.material || 'unknown',
            pattern: item.pattern || 'solid',
            occasion: item.occasion || 'Everyday Casual',
            imageUrl: originalImage ? `data:image/jpeg;base64,${originalImage}` : '',
            imageHash: imageHash,
            usageCount: usageCount.current
          };

          // Create clothing item
          const newItem = await storage.createClothingItem(itemData);

          console.log(`Successfully created flat lay item: ${newItem.name} (ID: ${newItem.id}, ${newItem.type}, ${newItem.color})`);
          addedItems.push(newItem);

        } catch (itemError) {
          console.error(`Error processing flat lay item ${item.name}:`, itemError);
          errors.push({
            itemName: item.name,
            error: itemError instanceof Error ? itemError.message : 'Unknown error'
          });
        }
      }

      const totalTime = Date.now() - startTime;

      console.log(`Flat lay processing completed: ${addedItems.length} items added, ${duplicates.length} duplicates, ${errors.length} errors in ${totalTime}ms`);

      res.json({
        message: `${addedItems.length} items added successfully from flat lay`,
        items: addedItems,
        duplicates,
        errors,
        processingTime: totalTime
      });

    } catch (error) {
      console.error("Add flat lay items error:", error);
      res.status(500).json({ message: "Failed to process flat lay items" });
    }
  });

  // Duplicate check endpoint
  app.post("/api/check-duplicate", upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image uploaded" });
      }

      console.log(`Checking for duplicates: ${req.file.originalname}`);
      const startTime = Date.now();

      // Generate hash for uploaded image
      const newHash = await generateImageHash(req.file.buffer);

      // Check for duplicates
      const duplicateCheck = await checkForDuplicates(newHash, 1); // Demo user ID

      let analysis = null;
      if (!duplicateCheck.isDuplicate) {
        // Only analyze if not a duplicate
        analysis = await analyzeClothing(req.file.buffer);
      }

      const processingTime = Date.now() - startTime;
      console.log(`Duplicate check completed in ${processingTime}ms`);

      res.json({
        isDuplicate: duplicateCheck.isDuplicate,
        similarItem: duplicateCheck.similarItem,
        similarity: duplicateCheck.similarity,
        analysis,
        processingTime,
        filename: req.file.originalname
      });
    } catch (error) {
      console.error("Duplicate check error:", error);
      res.status(500).json({ message: "Failed to check for duplicates" });
    }
  });

  // Upload clothing items
  app.post("/api/upload", upload.array('images', 10), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No images uploaded" });
      }

      console.log(`Processing batch upload: ${files.length} files`);
      const startTime = Date.now();

      // Batch analyze all uploaded images
      console.log(`Batch analyzing ${files.length} clothing items...`);
      const batchStartTime = Date.now();

      const analyses = await batchAnalyzeClothing(files.map(f => f.buffer));

      const batchAnalysisTime = Date.now() - batchStartTime;
      const avgTime = Math.round(batchAnalysisTime / files.length);
      console.log(`Batch analysis completed in ${batchAnalysisTime}ms (${avgTime}ms per item)`);

      const addedItems: ClothingItem[] = [];
      const duplicates: any[] = [];
      const errors: any[] = [];

      // Process each analyzed result
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const analysis = analyses[i];

        try {
          // Generate image hash for duplicate detection
          const imageHash = await generateImageHash(file.buffer);

          // Check for duplicates
          const duplicateCheck = await checkForDuplicates(imageHash, 1);

          if (duplicateCheck.isDuplicate) {
            duplicates.push({
              filename: file.originalname,
              similarItem: duplicateCheck.similarItem,
              similarity: duplicateCheck.similarity
            });
            continue;
          }

          // Refine category based on analysis
          const refinedCategory = refineCategory(analysis.type, analysis.name, analysis.color);

          // Create usage count
          const usageCount = createUsageCount();

          // Create clothing item
          const newItem = await storage.createClothingItem({
            userId: 1,
            name: analysis.name,
            type: refinedCategory.type,
            color: analysis.color,
            material: analysis.material || 'unknown',
            pattern: analysis.pattern || 'solid',
            occasion: analysis.occasion || 'Everyday Casual',
            imageUrl: `data:image/jpeg;base64,${file.buffer.toString('base64')}`,
            imageHash: imageHash,
            usageCount: usageCount.current
          });

          console.log(`Created item: ${newItem.name} (${newItem.type}, ${newItem.color}) - ${usageCount.display}`);
          addedItems.push(newItem);

        } catch (itemError) {
          console.error(`Error processing ${file.originalname}:`, itemError);
          errors.push({
            filename: file.originalname,
            error: itemError instanceof Error ? itemError.message : 'Unknown error'
          });
        }
      }

      const totalTime = Date.now() - startTime;

      res.json({
        message: `${addedItems.length} items added successfully`,
        items: addedItems,
        duplicates,
        errors,
        processingTime: totalTime,
        batchAnalysisTime,
        averageProcessingTime: avgTime
      });

    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "Failed to process uploads" });
    }
  });

  // Delete clothing item
  app.delete("/api/wardrobe/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid item ID" });
      }

      await storage.deleteClothingItem(id);
      res.json({ message: "Item deleted successfully" });
    } catch (error) {
      console.error("Delete error:", error);
      res.status(500).json({ message: "Failed to delete item" });
    }
  });

  // Update clothing item
  app.patch("/api/wardrobe/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid item ID" });
      }

      const updates = req.body;
      const updatedItem = await storage.updateClothingItem(id, updates);

      if (!updatedItem) {
        return res.status(404).json({ message: "Item not found" });
      }

      res.json(updatedItem);
    } catch (error) {
      console.error("Update error:", error);
      res.status(500).json({ message: "Failed to update item" });
    }
  });

  // Generate outfits
  app.post("/api/generate-outfits", async (req, res) => {
    try {
      const { occasion, temperature, timeOfDay, season } = req.body;

      // Get user's wardrobe
      const items = await storage.getClothingItemsByUser(1);

      if (items.length === 0) {
        return res.status(400).json({ message: "No clothing items found. Please add some items to your wardrobe first." });
      }

      // Generate outfit suggestions
      const outfitRules = { occasion, temperature, timeOfDay, season };

      // Create outfit combinations
      const outfitSuggestions = [];

      // Get different types of items
      const tops = items.filter(item => item.type === 'top');
      const bottoms = items.filter(item => item.type === 'bottom'); 
      const outerwear = items.filter(item => item.type === 'outerwear');
      const shoes = items.filter(item => item.type === 'shoes');

      // Generate up to 3 outfit combinations
      for (let i = 0; i < Math.min(3, tops.length * bottoms.length); i++) {
        const outfit = [];

        // Add required pieces
        if (tops.length > 0) outfit.push(tops[i % tops.length]);
        if (bottoms.length > 0) outfit.push(bottoms[i % bottoms.length]);

        // Add optional pieces based on occasion and weather
        if (shoes.length > 0) outfit.push(shoes[i % shoes.length]);
        if (outerwear.length > 0 && (temperature < 60 || occasion === 'Work Smart')) {
          outfit.push(outerwear[i % outerwear.length]);
        }

        const outfitName = `${occasion} Outfit ${i + 1}`;

        outfitSuggestions.push({
          name: outfitName,
          items: outfit,
          occasion,
          temperature,
          timeOfDay,
          season,
          score: 85 + Math.random() * 15, // Mock scoring
          weatherAppropriate: true,
          recommendations: [`Perfect for ${occasion.toLowerCase()}`, `Great color combination`]
        });
      }

      res.json({ outfits: outfitSuggestions });
    } catch (error) {
      console.error("Outfit generation error:", error);
      res.status(500).json({ message: "Failed to generate outfits" });
    }
  });

  // Save outfit
  app.post("/api/outfits", async (req, res) => {
    try {
      const outfitData = insertOutfitSchema.parse(req.body);

      // Validate that all items exist and belong to user
      for (const itemId of outfitData.itemIds) {
        const numericId = typeof itemId === 'string' ? parseInt(itemId, 10) : itemId;
        if (isNaN(numericId)) {
          return res.status(400).json({ message: `Invalid item ID format: ${itemId}` });
        }
        const item = await storage.getClothingItem(numericId);
        if (!item || item.userId !== 1) {
          return res.status(400).json({ message: `Invalid item ID: ${itemId}` });
        }
      }

      const newOutfit = await storage.createOutfit({
        ...outfitData,
        userId: 1
      });

      res.status(201).json(newOutfit);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid outfit data", errors: error.errors });
      }
      console.error("Save outfit error:", error);
      res.status(500).json({ message: "Failed to save outfit" });
    }
  });

  // Get user outfits
  app.get("/api/outfits", async (req, res) => {
    try {
      const outfits = await storage.getOutfitsByUser(1);
      res.json(outfits);
    } catch (error) {
      console.error("Get outfits error:", error);
      res.status(500).json({ message: "Failed to get outfits" });
    }
  });

  // Delete outfit
  app.delete("/api/outfits/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid outfit ID" });
      }

      await storage.deleteOutfit(id);
      res.json({ message: "Outfit deleted successfully" });
    } catch (error) {
      console.error("Delete outfit error:", error);
      res.status(500).json({ message: "Failed to delete outfit" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Analyze flat lay image with AI
async function analyzeFlatLayImage(imageBuffer: Buffer) {
  const genAI = initializeGemini();
  if (!genAI) {
    throw new Error("Gemini AI not available");
  }

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `You are a clothing analysis expert. Analyze this flat lay image that contains multiple clothing items arranged together. 

IMPORTANT: Examine the image systematically from left to right, top to bottom. Look for items that may be folded, stacked, or partially obscured by other items.

For each DISTINCT clothing item you can identify, provide:
1. A specific descriptive name (e.g., "Navy Cotton T-Shirt", "Black Leather Jacket")
2. The clothing type (top, bottom, outerwear, shoes, accessories, socks, underwear)
3. The primary color
4. The material (cotton, denim, leather, wool, polyester, etc.)
5. The pattern (solid, striped, checkered, floral, etc.)
6. The occasion it's suitable for (casual, smart-casual, formal, athletic, party, business)
7. The demographic (men, women, unisex, kids)
8. A brief description of the item

Count each piece separately - if you see 3 shirts, list them as 3 separate items. Include ALL visible clothing regardless of size or prominence in the image.

Return as a JSON array with this exact structure:
[
  {
    "name": "item name",
    "type": "clothing type",
    "color": "primary color",
    "material": "material",
    "pattern": "pattern",
    "occasion": "occasion",
    "demographic": "demographic",
    "description": "brief description"
  }
]`;

  const imagePart = {
    inlineData: {
      data: imageBuffer.toString('base64'),
      mimeType: "image/jpeg"
    }
  };

  const result = await model.generateContent([prompt, imagePart]);
  const response = await result.response;
  const text = response.text();

  // Extract JSON from response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("No valid JSON found in AI response");
  }

  return JSON.parse(jsonMatch[0]);
}

// Fallback analysis when AI is not available
async function analyzeFlatLayFallback(imageBuffer: Buffer) {
  // Basic fallback that creates generic items
  // In a real app, you might use basic image processing to detect shapes/colors

  const metadata = await sharp(imageBuffer).metadata();
  const { width = 1, height = 1 } = metadata;

  // Simple heuristic: assume 2-4 items based on image size
  const estimatedItems = Math.min(4, Math.max(2, Math.floor((width * height) / 100000)));

  const fallbackItems = [];
  const colors = ['black', 'white', 'gray', 'blue', 'navy'];
  const types = ['top', 'bottom', 'outerwear'];

  for (let i = 0; i < estimatedItems; i++) {
    fallbackItems.push({
      name: `Clothing Item ${i + 1}`,
      type: types[i % types.length],
      color: colors[i % colors.length],
      material: 'unknown',
      pattern: 'solid',
      occasion: 'casual',
      demographic: 'unisex',
      description: `Detected clothing item ${i + 1} from flat lay`
    });
  }

  return fallbackItems;
}