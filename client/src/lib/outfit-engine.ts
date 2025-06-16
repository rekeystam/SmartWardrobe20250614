import type { ClothingItem } from "@shared/schema";

export interface OutfitRules {
  occasion: string;
  temperature: number;
  timeOfDay: string;
  season: string;
}

export interface OutfitSuggestion {
  name: string;
  items: ClothingItem[];
  score: number;
  reasons: string[];
}

export class OutfitEngine {
  private items: ClothingItem[];

  constructor(items: ClothingItem[]) {
    this.items = items.filter(item => item.usageCount < 3);
  }

  generateOutfits(rules: OutfitRules, maxSuggestions = 3): OutfitSuggestion[] {
    const { occasion, temperature, timeOfDay, season } = rules;
    
    // Categorize available items
    const tops = this.items.filter(item => item.type === 'top');
    const bottoms = this.items.filter(item => item.type === 'bottom');
    const outerwear = this.items.filter(item => item.type === 'outerwear');
    const shoes = this.items.filter(item => item.type === 'shoes');
    const accessories = this.items.filter(item => item.type === 'accessories');

    // Check minimum requirements
    if (tops.length === 0 || bottoms.length === 0) {
      throw new Error('Insufficient wardrobe items: Need at least one top and one bottom');
    }

    const outfits: OutfitSuggestion[] = [];

    // Generate different outfit combinations
    for (let i = 0; i < Math.min(maxSuggestions, tops.length); i++) {
      for (let j = 0; j < Math.min(maxSuggestions, bottoms.length); j++) {
        if (outfits.length >= maxSuggestions) break;

        const outfit: ClothingItem[] = [];
        const reasons: string[] = [];
        let score = 100;

        // Add essential items
        const top = tops[i % tops.length];
        const bottom = bottoms[j % bottoms.length];
        outfit.push(top, bottom);

        // Add outerwear if temperature is low
        if (temperature < 14 && outerwear.length > 0) {
          const jacket = outerwear[i % outerwear.length];
          outfit.push(jacket);
          reasons.push('Jacket added for cool weather');
        }

        // Add shoes if available
        if (shoes.length > 0) {
          const shoe = shoes[i % shoes.length];
          outfit.push(shoe);
        }

        // Add accessories for formal occasions
        if ((occasion === 'formal' || occasion === 'business') && accessories.length > 0) {
          const accessory = accessories[i % accessories.length];
          outfit.push(accessory);
          reasons.push('Accessory added for formal look');
        }

        // Score the outfit based on various factors
        score += this.scoreColorCombination(outfit);
        score += this.scoreOccasionAppropriate(outfit, occasion);
        score += this.scoreWeatherAppropriate(outfit, temperature);
        score += this.scoreTimeAppropriate(outfit, timeOfDay);

        // Generate outfit name
        const name = this.generateOutfitName(occasion, timeOfDay, outfit.length);

        outfits.push({
          name,
          items: outfit,
          score,
          reasons: reasons.length > 0 ? reasons : ['Well-balanced color combination', 'Appropriate for the occasion']
        });
      }
    }

    // Sort by score and return top suggestions
    return outfits
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSuggestions);
  }

  private scoreColorCombination(outfit: ClothingItem[]): number {
    const colors = outfit.map(item => item.color.toLowerCase());
    const uniqueColors = new Set(colors);
    
    // Prefer 2-3 colors max for cohesion
    if (uniqueColors.size <= 3) return 10;
    return -5; // Too many colors
  }

  private scoreOccasionAppropriate(outfit: ClothingItem[], occasion: string): number {
    const formalItems = outfit.filter(item => 
      item.name.toLowerCase().includes('shirt') || 
      item.name.toLowerCase().includes('blazer') ||
      item.name.toLowerCase().includes('dress') ||
      item.name.toLowerCase().includes('chinos') ||
      item.name.toLowerCase().includes('dress shoes')
    );

    const casualItems = outfit.filter(item =>
      item.name.toLowerCase().includes('t-shirt') ||
      item.name.toLowerCase().includes('jeans') ||
      item.name.toLowerCase().includes('sneakers') ||
      item.name.toLowerCase().includes('polo')
    );

    switch (occasion) {
      case 'formal':
      case 'business':
        return formalItems.length > casualItems.length ? 15 : -10;
      case 'casual':
        return casualItems.length > 0 ? 10 : 0;
      case 'smart-casual':
        // Balance of formal and casual elements
        return formalItems.length > 0 && casualItems.length > 0 ? 12 : 5;
      case 'party':
        // Slightly more formal but still stylish
        return formalItems.length > 0 ? 8 : 3;
      default:
        return 5;
    }
  }

  private scoreWeatherAppropriate(outfit: ClothingItem[], temperature: number): number {
    const hasOuterwear = outfit.some(item => item.type === 'outerwear');
    
    if (temperature < 14) {
      return hasOuterwear ? 15 : -10;
    }
    if (temperature > 25) {
      return hasOuterwear ? -5 : 5;
    }
    return 0;
  }

  private scoreTimeAppropriate(outfit: ClothingItem[], timeOfDay: string): number {
    // Simple time-based scoring
    const darkColors = outfit.filter(item => 
      item.color.toLowerCase().includes('black') ||
      item.color.toLowerCase().includes('navy') ||
      item.color.toLowerCase().includes('dark')
    );

    switch (timeOfDay) {
      case 'evening':
      case 'night':
        return darkColors.length > 0 ? 5 : 0;
      case 'morning':
      case 'afternoon':
        return 2;
      default:
        return 0;
    }
  }

  private generateOutfitName(occasion: string, timeOfDay: string, itemCount: number): string {
    const occasionNames = {
      'casual': 'Casual',
      'smart-casual': 'Smart Casual',
      'formal': 'Formal',
      'business': 'Business',
      'party': 'Party'
    };

    const timeNames = {
      'morning': 'Morning',
      'afternoon': 'Afternoon',
      'evening': 'Evening',
      'night': 'Night'
    };

    const occasionName = occasionNames[occasion as keyof typeof occasionNames] || 'Stylish';
    const timeName = timeNames[timeOfDay as keyof typeof timeNames] || '';

    if (itemCount >= 4) {
      return `${occasionName} Layered Look`;
    }
    if (timeName) {
      return `${occasionName} ${timeName}`;
    }
    return `${occasionName} Look`;
  }
}
