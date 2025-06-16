import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import sharp from "sharp";
import crypto from "crypto";
import { storage } from "./storage";
import { insertClothingItemSchema, insertOutfitSchema } from "@shared/schema";
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

// Enhanced duplicate detection with similarity threshold
async function checkForDuplicates(newHash: string, userId: number): Promise<{isDuplicate: boolean, similarItem?: any, similarity?: number}> {
  try {
    const existingItems = await storage.getClothingItemsByUser(userId);

    for (const item of existingItems) {
      if (item.imageHash) {
        const similarity = calculateHashSimilarity(newHash, item.imageHash);

        // Stricter threshold for duplicates - catches near-identical photos
        if (similarity > 85) {
          return {
            isDuplicate: true,
            similarItem: item,
            similarity
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

// Helper function for calculating hash similarity (moved from shared/utils.ts)
function calculateHashSimilarity(hash1: string, hash2: string): number {
  if (!hash1 || !hash2) return 0;
  if (hash1 === hash2) return 100;

  // Calculate Hamming distance for hex strings
  let differences = 0;
  const minLength = Math.min(hash1.length, hash2.length);

  for (let i = 0; i < minLength; i++) {
    if (hash1[i] !== hash2[i]) differences++;
  }

  // Add penalty for length differences
  differences += Math.abs(hash1.length - hash2.length);

  // Calculate similarity percentage
  const maxLength = Math.max(hash1.length, hash2.length);
  return Math.max(0, 100 - (differences / maxLength) * 100);
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
async function analyzeClothing(imageBuffer: Buffer): Promise<{type: string, color: string, name: string, demographic: string, material: string, pattern: string, occasion: string}> {
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
async function batchAnalyzeClothing(imageBuffers: Buffer[]): Promise<Array<{type: string, color: string, name: string, demographic: string, material: string, pattern: string, occasion: string}>> {
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

async function analyzeWithGemini(model: any, imageBuffer: Buffer): Promise<{type: string, color: string, name: string, demographic: string, material: string, pattern: string, occasion: string}> {
  // Convert buffer to base64 for Gemini
  const base64Image = imageBuffer.toString('base64');

  const prompt = `Analyze this clothing item image with high accuracy. Look carefully at the shape, style, and details to identify the correct item type.

CRITICAL: Pay close attention to distinguish between different clothing types:
- SHORTS vs PANTS: Shorts end above the knee, pants extend to the ankle
- BLAZERS vs JACKETS: Blazers are formal/structured, jackets are casual
- CARDIGANS: Can be worn as tops or light outerwear
- T-SHIRTS vs DRESS SHIRTS: T-shirts are casual, dress shirts have collars/buttons

Categories (choose the most accurate):
1. Type: [top, bottom, outerwear, shoes, accessories, socks, underwear]
2. Color: Main visible color
3. Name: Specific item name (e.g., "Red Shorts", "Black Blazer", "Blue Jeans")
4. Material: Fabric type if visible
5. Pattern: Visual pattern
6. Occasion: Suitable context
7. Demographic: Target audience

Respond in exact JSON format:
{
  "type": "category",
  "color": "primary color", 
  "name": "Color + Specific Item",
  "material": "fabric",
  "pattern": "pattern",
  "occasion": "context",
  "demographic": "audience"
}

Examples:
- Red athletic shorts: {"type": "bottom", "color": "red", "name": "Red Shorts", "material": "polyester", "pattern": "solid", "occasion": "athletic", "demographic": "unisex"}
- Black dress pants: {"type": "bottom", "color": "black", "name": "Black Dress Pants", "material": "wool", "pattern": "solid", "occasion": "formal", "demographic": "unisex"}
- Navy blazer: {"type": "outerwear", "color": "navy blue", "name": "Navy Blue Blazer", "material": "wool", "pattern": "solid", "occasion": "formal", "demographic": "unisex"}`;

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
      name: analysis.name,
      demographic: analysis.demographic || 'unisex',
      material: analysis.material || 'unknown',
      pattern: analysis.pattern || 'solid',
      occasion: analysis.occasion || 'casual'
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

  const prompt = `Analyze these ${images.length} clothing item images and provide detailed analysis for each:

For each image, provide:
1. Type: one of [top, bottom, outerwear, shoes, accessories, socks, underwear]
2. Primary color: describe the main color
3. Specific name: what type of item it is specifically
4. Material: fabric/material type (e.g., "cotton", "denim", "leather", "polyester", "wool", "silk")
5. Pattern: visual pattern (e.g., "solid", "striped", "plaid", "floral", "geometric")
6. Occasion: suitable context (e.g., "casual", "formal", "business", "athletic", "party")
7. Demographic: target gender (e.g., "men", "women", "unisex", "kids")

Respond with a JSON array where each object corresponds to the image at that index:
[
  {"type": "category", "color": "primary color", "name": "Color + Specific Item Name", "material": "fabric", "pattern": "pattern", "occasion": "occasion", "demographic": "gender"},
  {"type": "category", "color": "primary color", "name": "Color + Specific Item Name", "material": "fabric", "pattern": "pattern", "occasion": "occasion", "demographic": "gender"},
  ...
]

Analyze images in order and ensure the array has exactly ${images.length} items.`;

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
            name: `Item ${index + 1}`,
            demographic: 'unisex',
            material: 'unknown',
            pattern: 'solid',
            occasion: 'casual'
          };
        }

        const validTypes = ['top', 'bottom', 'outerwear', 'shoes', 'accessories', 'socks', 'underwear'];
        if (!validTypes.includes(analysis.type.toLowerCase())) {
          analysis.type = 'top';
        }

        // Set defaults for optional fields
        const demographic = analysis.demographic || 'unisex';
        const material = analysis.material || 'unknown';
        const pattern = analysis.pattern || 'solid';
        const occasion = analysis.occasion || 'casual';

        return {
          type: analysis.type.toLowerCase(),
          color: analysis.color.toLowerCase(),
          name: analysis.name,
          demographic: demographic.toLowerCase(),
          material: material.toLowerCase(),
          pattern: pattern.toLowerCase(),
          occasion: occasion.toLowerCase()
        };
      });

  } catch (parseError) {
    console.error("Failed to parse Gemini batch response:", text, parseError);
    throw parseError; // This will trigger individual analysis fallback
  }
}

async function analyzeWithImageHash(imageBuffer: Buffer): Promise<{type: string, color: string, name: string, demographic: string, material: string, pattern: string, occasion: string}> {
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
      name,
      demographic: 'unisex',
      material: 'unknown', 
      pattern: 'solid',
      occasion: 'casual'
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

  // Real-time duplicate check endpoint with enhanced detection
  app.post("/api/check-duplicate", upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image uploaded" });
      }

      const startTime = Date.now();

      // Generate hash for the uploaded image
      const imageHash = await generateImageHash(req.file.buffer);

      // Get preliminary analysis for metadata comparison
      const analysis = await analyzeClothing(req.file.buffer);

      // Get all user items for comprehensive duplicate checking
      const allUserItems = await storage.getClothingItemsByUser(1);

      // Prepare existing items data for duplicate detection
      const existingItemsData = allUserItems.map(item => ({
        hash: item.imageHash || '',
        name: item.name,
        type: item.type,
        color: item.color,
        id: item.id,
        imageUrl: item.imageUrl
      }));

      // Enhanced duplicate detection with filename
      const duplicateResult = detectDuplicate(
        imageHash,
        analysis.name,
        analysis.type,
        analysis.color,
        existingItemsData,
        req.file.originalname
      );

      const checkTime = Date.now() - startTime;

      if (duplicateResult.isDuplicate) {
        res.json({
          isDuplicate: true,
          existingItem: {
            id: duplicateResult.matchedItem.id,
            name: duplicateResult.matchedItem.name,
            type: duplicateResult.matchedItem.type,
            color: duplicateResult.matchedItem.color,
            imageUrl: duplicateResult.matchedItem.imageUrl
          },
          similarity: duplicateResult.similarity,
          reason: duplicateResult.reason,
          message: `Duplicate item detected. Please upload a unique item.`,
          processingTime: checkTime
        });
      } else {
        // Check for category confirmation needs
        const categoryCheck = shouldPromptForCategoryConfirmation(analysis.type, analysis.name);

        res.json({
          isDuplicate: false,
          analysis: {
            type: analysis.type,
            color: analysis.color,
            name: analysis.name
          },
          categoryConfirmation: categoryCheck,
          processingTime: checkTime
        });
      }
    } catch (error) {
      console.error("Duplicate check error:", error);
      res.status(500).json({ message: "Failed to check for duplicates" });
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
      const batchHashes = new Set(); // Track hashes within this batch

      // First pass: check for duplicates and prepare for batch analysis
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          // Generate standardized perceptual hash for efficient duplicate detection
          const imageHash = await generateImageHash(file.buffer);

          // Check for duplicates within the current batch first
          if (batchHashes.has(imageHash)) {
            duplicates.push({
              filename: file.originalname,
              existingItem: "Another item in this upload",
              reason: "Identical image in the same batch",
              similarity: 100
            });
            console.log(`Batch duplicate prevented: ${file.originalname} - identical to another item in this batch`);
            continue;
          }

          // Pre-upload duplicate check against existing database items
          const duplicateCheck = await checkForDuplicates(imageHash, 1);

          if (duplicateCheck.isDuplicate) {
            duplicates.push({
              filename: file.originalname,
              existingItem: duplicateCheck.similarItem.name,
              reason: `Similar image detected (${duplicateCheck.similarity.toFixed(1)}% match)`,
              similarity: duplicateCheck.similarity
            });
            console.log(`Duplicate prevented: ${file.originalname} - ${duplicateCheck.similarity.toFixed(1)}% similarity to "${duplicateCheck.similarItem.name}"`);
            continue;
          }

          // Add to batch tracking
          batchHashes.add(imageHash);

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

      // Create clothing items from analyses with refined categories
      const createdItemsInBatch = new Map(); // Track items created in this batch

      for (let i = 0; i < analyses.length; i++) {
        const analysis = analyses[i];
        const data = fileData[i];

        try {
          // Refine category based on context and rules
          const refinedCategory = refineCategory(
            analysis.type,
            analysis.name,
            analysis.color,
            req.body.temperature // Optional temperature context
          );

          // Check for semantic duplicates within the batch (same name, type, color)
          const itemKey = `${analysis.name.toLowerCase()}-${refinedCategory.type}-${analysis.color.toLowerCase()}`;
          if (createdItemsInBatch.has(itemKey)) {
            duplicates.push({
              filename: data.originalFile.originalname,
              existingItem: `Another "${analysis.name}" in this batch`,
              reason: "Identical item details in the same batch",
              similarity: 100
            });
            console.log(`Semantic batch duplicate prevented: ${analysis.name} - identical to another item in this batch`);
            continue;
          }

          const imageUrl = `data:image/jpeg;base64,${data.resizedBuffer.toString('base64')}`;

          // Create with standardized usage count
          const usage = createUsageCount(0);

          const newItem = await storage.createClothingItem({
            userId: 1,
            name: analysis.name,
            type: refinedCategory.type,
            color: analysis.color,
            imageUrl,
            imageHash: data.imageHash,
            usageCount: usage.current,
            demographic: analysis.demographic || 'unisex',
            material: analysis.material || 'unknown',
            pattern: analysis.pattern || 'solid',
            occasion: analysis.occasion || 'casual'
          });

          // Track this item in the batch
          createdItemsInBatch.set(itemKey, newItem);

          // Add usage information to result
          const itemWithUsage = {
            ...newItem,
            usage: usage.display,
            usageStatus: 'available'
          };

          results.push(itemWithUsage);
          console.log(`Created item: ${analysis.name} (${refinedCategory.type}, ${analysis.color}) - ${usage.display}`);

          // Log category confirmation if needed
          const categoryCheck = shouldPromptForCategoryConfirmation(refinedCategory.type, analysis.name);
          if (categoryCheck.shouldPrompt) {
            console.log(`Category confirmation suggested for ${analysis.name}: ${categoryCheck.suggestion}`);
          }

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

  // Delete clothing item
  app.delete("/api/clothing/:id", async (req, res) => {
    try {
      const itemId = parseInt(req.params.id);
      if (isNaN(itemId)) {
        return res.status(400).json({ message: "Invalid item ID" });
      }

      const item = await storage.getClothingItem(itemId);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      // Check if item belongs to the user (demo user ID: 1)
      if (item.userId !== 1) {
        return res.status(403).json({ message: "Not authorized to delete this item" });
      }

      await storage.deleteClothingItem(itemId);

      res.json({ 
        message: "Item deleted successfully",
        deletedItem: {
          id: item.id,
          name: item.name
        }
      });
    } catch (error) {
      console.error("Delete item error:", error);
      res.status(500).json({ message: "Failed to delete item" });
    }
  });

  // Update clothing item (for correcting AI analysis)
  app.put("/api/clothing/:id", async (req, res) => {
    try {
      const itemId = parseInt(req.params.id);
      if (isNaN(itemId)) {
        return res.status(400).json({ message: "Invalid item ID" });
      }

      const { name, type, color, material, pattern, occasion } = req.body;

      const existingItem = await storage.getClothingItem(itemId);
      if (!existingItem) {
        return res.status(404).json({ message: "Item not found" });
      }

      // Check if item belongs to the user
      if (existingItem.userId !== 1) {
        return res.status(403).json({ message: "Not authorized to update this item" });
      }

      const updatedItem = await storage.updateClothingItem(itemId, {
        name: name || existingItem.name,
        type: type || existingItem.type,
        color: color || existingItem.color,
        material: material || existingItem.material,
        pattern: pattern || existingItem.pattern,
        occasion: occasion || existingItem.occasion
      });

      res.json({
        message: "Item updated successfully",
        item: updatedItem
      });
    } catch (error) {
      console.error("Update item error:", error);
      res.status(500).json({ message: "Failed to update item" });
    }
  });

  // Generate outfit suggestions with AI
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

      // Use AI to generate outfit suggestions
      const model = initializeGemini();
      let outfits = [];

      if (model) {
        try {
          console.log('Generating AI-powered outfit suggestions...');
          const prompt = `As a professional fashion stylist, create 3 outfit combinations for a ${user.age}-year-old ${user.gender} with ${user.bodyType} body type and ${user.skinTone} skin tone.

Context:
- Occasion: ${occasion}
- Temperature: ${temperature}°C
- Time of day: ${timeOfDay}
- Season: ${season}

Available clothing items:
${availableItems.map(item => `- ${item.name} (${item.type}, ${item.color}, ID: ${item.id})`).join('\n')}

Create 3 different outfit combinations using only the available items above. Each outfit must include at least one top and one bottom. Consider the weather, occasion, and personal characteristics.

Respond with a JSON array of outfits:
[
  {
    "name": "Outfit Name",
    "itemIds": [1, 2, 3],
    "score": 85,
    "weatherAppropriate": true,
    "recommendations": ["Style tip 1", "Style tip 2"]
  }
]`;

          const result = await model.generateContent(prompt);
          const response = await result.response;
          const text = response.text();

          try {
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const aiOutfits = JSON.parse(jsonMatch[0]);

              // Convert AI suggestions to our format with proper validation
              outfits = aiOutfits.map((aiOutfit: any) => {
                const outfitItems = aiOutfit.itemIds
                  .map((id: number) => availableItems.find(item => item.id === id))
                  .filter(Boolean);

                // Validate outfit has essential components
                const hasTop = outfitItems.some(item => item.type === 'top');
                const hasBottom = outfitItems.some(item => item.type === 'bottom');
                const hasShoes = outfitItems.some(item => item.type === 'shoes');

                // Check for duplicate item types (especially accessories)
                const itemTypeCounts = outfitItems.reduce((counts, item) => {
                  counts[item.type] = (counts[item.type] || 0) + 1;
                  return counts;
                }, {} as Record<string, number>);

                // Prevent multiple accessories of the same type and ensure no duplicate items
                const hasDuplicates = Object.values(itemTypeCounts).some(count => count > 1) || 
                                     (itemTypeCounts.accessories && itemTypeCounts.accessories > 1);

                // Only accept outfits with proper structure: must have top, bottom, and no duplicates
                if (outfitItems.length >= 2 && hasTop && hasBottom && !hasDuplicates) {
                  // If missing shoes, try to add them
                  let finalItems = [...outfitItems];
                  if (!hasShoes && shoes.length > 0) {
                    const availableShoe = shoes.find(shoe => !finalItems.some(item => item.id === shoe.id));
                    if (availableShoe) {
                      finalItems.push(availableShoe);
                    }
                  }

                  return {
                    name: aiOutfit.name || 'AI Styled Outfit',
                    items: finalItems,
                    occasion,
                    temperature,
                    timeOfDay,
                    season,
                    score: aiOutfit.score || 100,
                    weatherAppropriate: aiOutfit.weatherAppropriate ?? true,
                    recommendations: aiOutfit.recommendations || ['AI-curated style combination'],
                    personalizedFor: {
                      age: user.age,
                      bodyType: user.bodyType,
                      skinTone: user.skinTone,
                      gender: user.gender
                    },
                    validation: {
                      hasEssentials: hasTop && hasBottom,
                      hasShoes: finalItems.some(item => item.type === 'shoes'),
                      itemCount: finalItems.length
                    }
                  };
                }
                return null;
              }).filter(Boolean);
            }
          } catch (parseError) {
            console.error("Failed to parse AI outfit response:", parseError);
          }
        } catch (error) {
          console.error("AI outfit generation failed:", error);
        }
      }

      // Fallback to algorithmic generation if AI fails or no valid outfits
      if (outfits.length === 0) {
        console.log('Using fallback outfit generation...');
        const maxOutfits = 3;
        const usedCombinations = new Set();
        const usedOutfitNames = new Set();

        // Helper function to prioritize formal items for formal occasions
        function getFormalPriority(item: any): number {
          const name = item.name.toLowerCase();
          const type = item.type.toLowerCase();
          
          if (occasion === 'formal' || occasion === 'business') {
            // Prioritize truly formal items
            if (name.includes('dress shirt') || name.includes('blazer') || name.includes('suit')) return 100;
            if (name.includes('dress shoes') || name.includes('leather shoes')) return 90;
            if (name.includes('necktie') || name.includes('tie')) return 85;
            if (name.includes('chinos') || name.includes('dress pants')) return 80;
            if (type === 'outerwear' && (name.includes('blazer') || name.includes('jacket'))) return 75;
            // Penalize casual items for formal occasions
            if (name.includes('t-shirt') || name.includes('jeans') || name.includes('sneakers')) return 10;
          }
          return 50; // Neutral priority
        }

        // Sort items by formality for the occasion
        const sortedTops = [...tops].sort((a, b) => getFormalPriority(b) - getFormalPriority(a));
        const sortedBottoms = [...bottoms].sort((a, b) => getFormalPriority(b) - getFormalPriority(a));
        const sortedOuterwear = [...outerwear].sort((a, b) => getFormalPriority(b) - getFormalPriority(a));
        const sortedShoes = [...shoes].sort((a, b) => getFormalPriority(b) - getFormalPriority(a));
        const sortedAccessories = [...accessories].sort((a, b) => getFormalPriority(b) - getFormalPriority(a));

        // Helper function to score outfit based on user profile and occasion appropriateness
        function getPersonalizedScore(outfit: any[]): number {
          let score = 100;

          // Formal occasion scoring
          if (occasion === 'formal' || occasion === 'business') {
            const formalItems = outfit.filter(item => getFormalPriority(item) >= 75);
            const casualItems = outfit.filter(item => getFormalPriority(item) <= 30);
            
            score += formalItems.length * 20; // Bonus for formal items
            score -= casualItems.length * 30; // Penalty for casual items
            
            // Must have dress shirt for formal
            const hasDressShirt = outfit.some(item => item.name.toLowerCase().includes('dress shirt'));
            if (hasDressShirt) score += 25;
            
            // Must have dress shoes for formal
            const hasDressShoes = outfit.some(item => item.name.toLowerCase().includes('dress shoes'));
            if (hasDressShoes) score += 20;
            
            // Bonus for ties in formal settings
            const hasTie = outfit.some(item => item.name.toLowerCase().includes('tie'));
            if (hasTie) score += 15;
          }

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

          return score;
        }

        // Generate unique outfit combinations with better variety
        for (let topIdx = 0; topIdx < Math.min(sortedTops.length, 5) && outfits.length < maxOutfits; topIdx++) {
          for (let bottomIdx = 0; bottomIdx < Math.min(sortedBottoms.length, 3) && outfits.length < maxOutfits; bottomIdx++) {
            for (let shoeIdx = 0; shoeIdx < Math.min(sortedShoes.length, 2) && outfits.length < maxOutfits; shoeIdx++) {
              const outfit = [];
              const top = sortedTops[topIdx];
              const bottom = sortedBottoms[bottomIdx];
              const shoe = sortedShoes[shoeIdx];

              // Create more detailed combination ID including shoes to ensure true uniqueness
              const baseComboId = `${top.id}-${bottom.id}-${shoe.id}`;
              if (usedCombinations.has(baseComboId)) continue;

              outfit.push(top, bottom, shoe);

              // Temperature-based layering logic
              if (temperature < 14 && sortedOuterwear.length > 0) {
                const jacket = sortedOuterwear[topIdx % sortedOuterwear.length];
                outfit.push(jacket);
              }

              // Add accessories based on occasion
              if ((occasion === 'formal' || occasion === 'business') && sortedAccessories.length > 0) {
                // Try to add a tie first for formal occasions
                const tie = sortedAccessories.find(item => item.name.toLowerCase().includes('tie'));
                if (tie) {
                  outfit.push(tie);
                } else {
                  // Fallback to other accessories
                  const accessory = sortedAccessories[topIdx % sortedAccessories.length];
                  outfit.push(accessory);
                }
              } else if (sortedAccessories.length > 0 && Math.random() > 0.5) {
                // Occasionally add accessories for other occasions
                const accessory = sortedAccessories[topIdx % sortedAccessories.length];
                outfit.push(accessory);
              }

              // Skip if insufficient items
              if (outfit.length < 3) continue;

              usedCombinations.add(baseComboId);

              // Calculate personalized score
              const score = getPersonalizedScore(outfit);

              // Generate unique outfit names
              const outfitNames = {
                'casual': [
                  'Weekend Casual', 'Relaxed Comfort', 'Easy Going', 
                  'Casual Friday', 'Off-Duty Style', 'Laid-Back Look'
                ],
                'smart-casual': [
                  'Smart Casual', 'Polished Casual', 'Refined Relaxed', 
                  'Business Casual', 'Elevated Casual', 'Modern Classic'
                ],
                'formal': [
                  'Executive Formal', 'Classic Business', 'Professional Elite', 
                  'Boardroom Ready', 'Formal Sophistication', 'Distinguished Look'
                ],
                'business': [
                  'Business Professional', 'Corporate Style', 'Office Executive', 
                  'Meeting Ready', 'Professional Power', 'Business Elite'
                ],
                'party': [
                  'Party Ready', 'Social Elite', 'Evening Sophistication', 
                  'Night Out', 'Celebration Style', 'Special Event'
                ]
              };

              const nameOptions = outfitNames[occasion as keyof typeof outfitNames] || ['Stylish Look'];
              let outfitName = nameOptions[outfits.length % nameOptions.length];
              
              // Ensure unique names
              let nameCounter = 1;
              const baseName = outfitName;
              while (usedOutfitNames.has(outfitName)) {
                outfitName = `${baseName} ${nameCounter + 1}`;
                nameCounter++;
              }
              usedOutfitNames.add(outfitName);

              // Generate personalized recommendations
              const recommendations = [];

              if (occasion === 'formal' || occasion === 'business') {
                const hasTie = outfit.some(item => item.name.toLowerCase().includes('tie'));
                const hasBlazer = outfit.some(item => item.name.toLowerCase().includes('blazer'));
                const hasDressShirt = outfit.some(item => item.name.toLowerCase().includes('dress shirt'));
                
                if (hasDressShirt && hasTie) {
                  recommendations.push('Perfect formal combination with dress shirt and tie');
                }
                if (hasBlazer) {
                  recommendations.push('Blazer adds professional sophistication');
                }
                if (!hasTie && sortedAccessories.some(item => item.name.toLowerCase().includes('tie'))) {
                  recommendations.push('Consider adding a tie for extra formality');
                }
              }

              if (temperature < 14) {
                const hasOuterwear = outfit.some(item => item.type === 'outerwear');
                if (hasOuterwear) {
                  recommendations.push('Layered appropriately for cool weather');
                }
              }

              recommendations.push('Colors complement your burnt tan skin tone');

              if (user.age >= 40) {
                recommendations.push('Age-appropriate styling with sophisticated elements');
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
        outfits: outfits.slice(0, 3),
        aiPowered: model !== null,
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