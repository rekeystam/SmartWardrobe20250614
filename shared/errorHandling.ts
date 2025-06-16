
export interface UserMessage {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}

export const createUserMessage = (
  type: UserMessage['type'],
  title: string,
  message: string,
  duration: number = 5000
): UserMessage => ({
  type,
  title,
  message,
  duration
});

export const errorMessages = {
  ITEM_RECLASSIFIED: (itemName: string, oldCategory: string, newCategory: string) => 
    createUserMessage(
      'info',
      'Item Reclassified',
      `${itemName} was moved from ${oldCategory} to ${newCategory}. Please verify the category is correct.`,
      7000
    ),
    
  DUPLICATE_DETECTED: (itemName: string) =>
    createUserMessage(
      'warning',
      'Duplicate Item Detected',
      `${itemName} appears to already exist in your wardrobe. Please upload a unique item.`,
      6000
    ),
    
  METADATA_ENRICHED: (itemName: string) =>
    createUserMessage(
      'success',
      'Item Analysis Complete',
      `${itemName} has been analyzed and tagged with material, occasion, and pattern information.`,
      4000
    ),
    
  ANALYSIS_FALLBACK: (itemName: string) =>
    createUserMessage(
      'warning',
      'Basic Analysis Used',
      `${itemName} was analyzed using basic detection. You may want to manually review the tags.`,
      5000
    )
};

export const handleApiError = (error: any): UserMessage => {
  if (error.status === 409) {
    return createUserMessage('error', 'Duplicate Item', error.message || 'This item already exists in your wardrobe.');
  }
  
  if (error.status === 400) {
    return createUserMessage('error', 'Upload Error', error.message || 'Please check your file and try again.');
  }
  
  return createUserMessage('error', 'Unexpected Error', 'Something went wrong. Please try again later.');
};
