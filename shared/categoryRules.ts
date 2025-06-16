
export interface CategoryRule {
  keywords: string[];
  primaryCategory: string;
  subcategory?: string;
  conditions?: (name: string, color: string) => boolean;
}

export const categoryRules: CategoryRule[] = [
  // Cardigans - context-dependent classification
  {
    keywords: ['cardigan'],
    primaryCategory: 'top',
    subcategory: 'optional_outerwear',
    conditions: (name, color) => {
      // Light cardigans are tops, heavy ones are outerwear
      const heavyIndicators = ['wool', 'thick', 'winter', 'heavy'];
      const isHeavy = heavyIndicators.some(indicator => 
        name.toLowerCase().includes(indicator)
      );
      return !isHeavy;
    }
  },
  
  // Blazers - business context
  {
    keywords: ['blazer', 'sport coat'],
    primaryCategory: 'outerwear',
    subcategory: 'business',
  },
  
  // Jackets - weather dependent
  {
    keywords: ['jacket'],
    primaryCategory: 'outerwear',
    conditions: (name, color) => {
      const lightJackets = ['bomber', 'denim', 'light'];
      const isLight = lightJackets.some(type => 
        name.toLowerCase().includes(type)
      );
      return !isLight; // Light jackets might be tops in warm weather
    }
  },
  
  // Hoodies - usually tops unless winter context
  {
    keywords: ['hoodie', 'sweatshirt'],
    primaryCategory: 'top',
    subcategory: 'casual',
    conditions: (name, color) => {
      const winterIndicators = ['fleece', 'thermal', 'winter'];
      const isWinter = winterIndicators.some(indicator => 
        name.toLowerCase().includes(indicator)
      );
      return !isWinter;
    }
  }
];

export function refineCategory(
  originalType: string, 
  name: string, 
  color: string,
  temperature?: number
): { type: string, subcategory?: string, confidence: number } {
  
  const nameLower = name.toLowerCase();
  
  // Apply category rules
  for (const rule of categoryRules) {
    const hasKeyword = rule.keywords.some(keyword => 
      nameLower.includes(keyword)
    );
    
    if (hasKeyword) {
      // Check conditions if they exist
      if (rule.conditions && !rule.conditions(name, color)) {
        continue;
      }
      
      // Consider temperature context
      if (temperature !== undefined) {
        if (temperature < 10 && rule.subcategory === 'optional_outerwear') {
          return { 
            type: 'outerwear', 
            subcategory: 'winter',
            confidence: 95 
          };
        }
      }
      
      return { 
        type: rule.primaryCategory, 
        subcategory: rule.subcategory,
        confidence: 90 
      };
    }
  }
  
  // Fallback to original classification
  return { type: originalType, confidence: 70 };
}

export function shouldPromptForCategoryConfirmation(
  type: string, 
  name: string
): { shouldPrompt: boolean, suggestion?: string } {
  
  const ambiguousItems = [
    { keywords: ['cardigan'], suggestion: 'Is this a light cardigan (Top) or heavy cardigan (Outerwear)?' },
    { keywords: ['vest'], suggestion: 'Is this a casual vest (Top) or formal vest (Outerwear)?' },
    { keywords: ['hoodie'], suggestion: 'Is this a light hoodie (Top) or winter hoodie (Outerwear)?' }
  ];
  
  const nameLower = name.toLowerCase();
  
  for (const item of ambiguousItems) {
    const hasKeyword = item.keywords.some(keyword => 
      nameLower.includes(keyword)
    );
    
    if (hasKeyword) {
      return { shouldPrompt: true, suggestion: item.suggestion };
    }
  }
  
  return { shouldPrompt: false };
}
