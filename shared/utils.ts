
import crypto from 'crypto';

// Enhanced perceptual hash comparison with similarity threshold
export function calculateHashSimilarity(hash1: string, hash2: string): number {
  if (hash1 === hash2) return 100;
  
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
}

// Detect duplicates with multiple criteria
export function detectDuplicate(
  newHash: string, 
  newName: string, 
  newType: string, 
  newColor: string,
  existingItems: Array<{hash: string, name: string, type: string, color: string}>
): { isDuplicate: boolean, similarity: number, matchedItem?: any, reason?: string } {
  
  // Check for exact hash matches (100% similarity)
  const exactMatch = existingItems.find(item => item.hash === newHash);
  if (exactMatch) {
    return {
      isDuplicate: true,
      similarity: 100,
      matchedItem: exactMatch,
      reason: 'Identical image detected'
    };
  }
  
  // Check for high similarity hashes (95%+ similarity)
  for (const item of existingItems) {
    const similarity = calculateHashSimilarity(newHash, item.hash);
    if (similarity >= 95) {
      return {
        isDuplicate: true,
        similarity,
        matchedItem: item,
        reason: 'Very similar image detected'
      };
    }
  }
  
  // Check for metadata duplicates (same name, type, and color)
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
  
  return { isDuplicate: false, similarity: 0 };
}

// Generate normalized filename for comparison
export function normalizeFilename(filename: string): string {
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}
