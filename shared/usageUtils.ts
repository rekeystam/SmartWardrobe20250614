
export interface UsageCount {
  current: number;
  maximum: number;
  display: string;
  isAtLimit: boolean;
  canUse: boolean;
}

export const MAX_USAGE_COUNT = 3;

export function createUsageCount(current: number = 0, maximum: number = MAX_USAGE_COUNT): UsageCount {
  const clampedCurrent = Math.max(0, Math.min(current, maximum));
  
  return {
    current: clampedCurrent,
    maximum,
    display: `${clampedCurrent}/${maximum} uses`,
    isAtLimit: clampedCurrent >= maximum,
    canUse: clampedCurrent < maximum
  };
}

// Validate usage count format and normalize it
export function normalizeUsageCount(usageInput: string | number | UsageCount): UsageCount {
  if (typeof usageInput === 'object' && 'current' in usageInput) {
    // Already a UsageCount object, validate it
    return createUsageCount(usageInput.current, usageInput.maximum);
  }
  
  if (typeof usageInput === 'number') {
    return createUsageCount(usageInput);
  }
  
  if (typeof usageInput === 'string') {
    // Parse "X/Y uses" format
    const match = usageInput.match(/(\d+)\/(\d+)\s*uses?/i);
    if (match) {
      const current = parseInt(match[1], 10);
      const maximum = parseInt(match[2], 10);
      return createUsageCount(current, maximum);
    }
    
    // Parse just number
    const num = parseInt(usageInput, 10);
    if (!isNaN(num)) {
      return createUsageCount(num);
    }
  }
  
  // Fallback to default
  return createUsageCount(0);
}

export function incrementUsage(usageCount: UsageCount): UsageCount {
  if (usageCount.isAtLimit) {
    return usageCount; // Cannot increment further
  }
  
  return createUsageCount(usageCount.current + 1, usageCount.maximum);
}

export function resetUsage(usageCount: UsageCount): UsageCount {
  return createUsageCount(0, usageCount.maximum);
}

export function validateUsageForOutfit(items: Array<{usageCount: number}>): {
  valid: boolean;
  unavailableItems: number[];
  message?: string;
} {
  const unavailableItems = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.usageCount >= MAX_USAGE_COUNT)
    .map(({ index }) => index);
  
  if (unavailableItems.length > 0) {
    return {
      valid: false,
      unavailableItems,
      message: `${unavailableItems.length} item(s) have reached the maximum usage limit (${MAX_USAGE_COUNT} uses)`
    };
  }
  
  return { valid: true, unavailableItems: [] };
}

export function getUsageStatus(current: number): {
  status: 'available' | 'warning' | 'limit_reached';
  color: string;
  message: string;
} {
  const usage = createUsageCount(current);
  
  if (usage.isAtLimit) {
    return {
      status: 'limit_reached',
      color: 'red',
      message: 'Usage limit reached'
    };
  } else if (usage.current >= usage.maximum - 1) {
    return {
      status: 'warning',
      color: 'orange',
      message: 'Last use available'
    };
  } else {
    return {
      status: 'available',
      color: 'green',
      message: `${usage.maximum - usage.current} uses remaining`
    };
  }
}
