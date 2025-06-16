
import crypto from 'crypto';

// Enhanced perceptual hash comparison with similarity threshold
export function calculateHashSimilarity(hash1: string, hash2: string): number {
  if (!hash1 || !hash2) return 0;
  if (hash1 === hash2) return 100;
  
  try {
    // Validate hash format - should be valid hex
    const isValidHex = (hash: string) => /^[a-fA-F0-9]+$/.test(hash);
    
    if (!isValidHex(hash1) || !isValidHex(hash2)) {
      // Fallback to string similarity for non-hex hashes
      return calculateStringSimilarity(hash1, hash2);
    }
    
    // Convert hashes to binary for Hamming distance calculation
    const bin1 = BigInt('0x' + hash1).toString(2).padStart(256, '0');
    const bin2 = BigInt('0x' + hash2).toString(2).padStart(256, '0');
    
    let differences = 0;
    for (let i = 0; i < Math.min(bin1.length, bin2.length); i++) {
      if (bin1[i] !== bin2[i]) differences++;
    }
    
    // Calculate similarity percentage (lower differences = higher similarity)
    const similarity = Math.max(0, 100 - (differences / 256) * 100);
    return similarity;
  } catch (error) {
    console.warn('Hash comparison failed, using string similarity:', error);
    return calculateStringSimilarity(hash1, hash2);
  }
}

// Fallback string similarity calculation
function calculateStringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 100;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return Math.max(0, 100 - (editDistance / longer.length) * 100);
}

// Levenshtein distance calculation
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,     // deletion
        matrix[j - 1][i] + 1,     // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Enhanced duplicate detection with multiple criteria
export function detectDuplicate(
  newHash: string, 
  newName: string, 
  newType: string, 
  newColor: string,
  existingItems: Array<{hash: string, name: string, type: string, color: string}>,
  filename?: string
): { isDuplicate: boolean, similarity: number, matchedItem?: any, reason?: string } {
  
  // 1. Check for exact hash matches (100% similarity)
  const exactMatch = existingItems.find(item => item.hash === newHash && item.hash);
  if (exactMatch) {
    return {
      isDuplicate: true,
      similarity: 100,
      matchedItem: exactMatch,
      reason: 'Identical image detected (exact hash match)'
    };
  }
  
  // 2. Check for high similarity hashes (95%+ similarity)
  for (const item of existingItems) {
    if (item.hash) {
      const similarity = calculateHashSimilarity(newHash, item.hash);
      if (similarity >= 95) {
        return {
          isDuplicate: true,
          similarity,
          matchedItem: item,
          reason: `Very similar image detected (${similarity.toFixed(1)}% similarity)`
        };
      }
    }
  }
  
  // 3. Check for exact metadata duplicates (same name, type, and color)
  const normalizedNewName = newName.toLowerCase().trim();
  const metadataMatch = existingItems.find(item => {
    const normalizedExistingName = item.name.toLowerCase().trim();
    return normalizedExistingName === normalizedNewName &&
           item.type === newType &&
           item.color.toLowerCase() === newColor.toLowerCase();
  });
  
  if (metadataMatch) {
    return {
      isDuplicate: true,
      similarity: 90,
      matchedItem: metadataMatch,
      reason: 'Identical item details (name, type, color)'
    };
  }
  
  // 4. Check for filename similarity (if provided)
  if (filename) {
    const normalizedNewFilename = normalizeFilename(filename);
    for (const item of existingItems) {
      if (item.name) {
        const normalizedExistingName = normalizeFilename(item.name);
        const filenameSimilarity = calculateStringSimilarity(normalizedNewFilename, normalizedExistingName);
        
        // High filename similarity + same type indicates likely duplicate
        if (filenameSimilarity >= 85 && item.type === newType) {
          return {
            isDuplicate: true,
            similarity: filenameSimilarity,
            matchedItem: item,
            reason: `Similar filename and type detected (${filenameSimilarity.toFixed(1)}% filename similarity)`
          };
        }
      }
    }
  }
  
  // 5. Check for semantic duplicates (similar items of same type/color)
  const semanticMatch = existingItems.find(item => {
    const typeMatch = item.type === newType;
    const colorMatch = item.color.toLowerCase() === newColor.toLowerCase();
    const nameWords = newName.toLowerCase().split(' ');
    const existingWords = item.name.toLowerCase().split(' ');
    
    // Check if significant words overlap
    const commonWords = nameWords.filter(word => 
      word.length > 3 && existingWords.includes(word)
    );
    
    return typeMatch && colorMatch && commonWords.length >= 2;
  });
  
  if (semanticMatch) {
    return {
      isDuplicate: true,
      similarity: 80,
      matchedItem: semanticMatch,
      reason: 'Similar item with matching type and color detected'
    };
  }
  
  return { isDuplicate: false, similarity: 0 };
}

// Generate normalized filename for comparison
export function normalizeFilename(filename: string): string {
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}


