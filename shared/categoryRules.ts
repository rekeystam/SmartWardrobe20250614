
export interface CategoryRule {
  keywords: string[];
  primaryCategory: string;
  subcategory?: string;
  conditions?: (name: string, color: string) => boolean;
}

export const categoryRules: CategoryRule[] = [
  // Socks - should be accessories
  {
    keywords: ['sock', 'socks'],
    primaryCategory: 'accessories',
    subcategory: 'socks',
  },
  
  // Cardigans - enhanced context-dependent classification
  {
    keywords: ['cardigan'],
    primaryCategory: 'top',
    subcategory: 'optional_outerwear',
    conditions: (name, color) => {
      const nameLower = name.toLowerCase();
      // Heavy cardigans are outerwear
      const heavyIndicators = ['wool', 'thick', 'winter', 'heavy', 'chunky', 'cable knit'];
      const isHeavy = heavyIndicators.some(indicator => nameLower.includes(indicator));
      
      // Light cardigans are tops
      const lightIndicators = ['cotton', 'light', 'summer', 'thin', 'fine knit'];
      const isLight = lightIndicators.some(indicator => nameLower.includes(indicator));
      
      // Default to top unless clearly heavy
      return !isHeavy || isLight;
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
): { shouldPrompt: boolean, suggestion?: string, metadata?: any } {
  
  const ambiguousItems = [
    {
      keywords: ['sock', 'socks'],
      suggestion: 'Socks should be categorized as Accessories. Would you like to move this item?',
      metadata: { type: 'socks', category: 'accessories', subcategory: 'socks' }
    },
    { 
      keywords: ['cardigan'], 
      suggestion: 'Is this item categorized correctly? Cardigan as Top or Outerwear?',
      metadata: { type: 'cardigan', category: type, subcategory: 'optional_outerwear' }
    },
    { 
      keywords: ['vest'], 
      suggestion: 'Is this a casual vest (Top) or formal vest (Outerwear)?',
      metadata: { type: 'vest', category: type, subcategory: 'optional_outerwear' }
    },
    { 
      keywords: ['hoodie', 'sweatshirt'], 
      suggestion: 'Is this a light hoodie (Top) or winter hoodie (Outerwear)?',
      metadata: { type: 'hoodie', category: type, subcategory: 'optional_outerwear' }
    },
    {
      keywords: ['blazer', 'sport coat'],
      suggestion: 'Is this a casual blazer (Top) or formal blazer (Outerwear)?',
      metadata: { type: 'blazer', category: type, subcategory: 'business' }
    }
  ];
  
  const nameLower = name.toLowerCase();
  
  for (const item of ambiguousItems) {
    const hasKeyword = item.keywords.some(keyword => 
      nameLower.includes(keyword)
    );
    
    if (hasKeyword) {
      return { 
        shouldPrompt: true, 
        suggestion: item.suggestion,
        metadata: item.metadata
      };
    }
  }
  
  return { shouldPrompt: false };
}
