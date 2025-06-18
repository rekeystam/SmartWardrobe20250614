import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface FlatLayItem {
  name: string;
  type: string;
  color: string;
  material: string;
  pattern: string;
  occasion: string;
  demographic: string;
  description: string;
}

interface FlatLayAnalysisResponse {
  items: FlatLayItem[];
  processingTime: number;
  filename: string;
  itemCount: number;
  isMultiItem: boolean;
  needsReview: boolean;
  autoDetected: boolean;
  fallback?: boolean;
  originalImage?: string;
  processedImage?: string;
  regions?: Array<{x: number, y: number, width: number, height: number}>;
  croppedImages?: string[];
  focusedImages?: string[];
  imageProcessing?: boolean;
  fallbackReason?: string;
}

interface FlatLayAnalyzerProps {
  onAnalysisComplete?: () => void;
}

export function FlatLayAnalyzer({ onAnalysisComplete }: FlatLayAnalyzerProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<FlatLayAnalysisResponse | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [editingItems, setEditingItems] = useState<Map<number, Partial<FlatLayItem>>>(new Map());
  const [showProcessedImage, setShowProcessedImage] = useState(false);
  const [showCroppedImages, setShowCroppedImages] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Enhanced analyze clothing image with intelligent detection
  const analyzeMutation = useMutation({
    mutationFn: async (file: File): Promise<FlatLayAnalysisResponse> => {
      const formData = new FormData();
      formData.append('image', file);
      
      // Use the unified endpoint that intelligently detects single vs multi-item
      const response = await fetch('/api/analyze-clothing', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      return response.json() as Promise<FlatLayAnalysisResponse>;
    },
    onSuccess: (data: FlatLayAnalysisResponse) => {
      console.log('Enhanced analysis result:', data);
      setAnalysisResult(data);
      // Select all items by default
      setSelectedItems(new Set(Array.from({ length: data.items.length }, (_, i) => i)));

      let description = `${data.isMultiItem ? 'Multi-item' : 'Single item'} analysis detected ${data.itemCount} clothing item${data.itemCount > 1 ? 's' : ''} in ${data.processingTime}ms`;
      
      if (data.autoDetected) {
        description += `. AI automatically detected ${data.isMultiItem ? 'flat-lay layout' : 'single item'}.`;
      }
      
      if (data.croppedImages && data.croppedImages.length > 0) {
        description += ` Generated ${data.croppedImages.length} cropped images.`;
      }

      if (data.fallback) {
        toast({
          title: "Analysis completed with fallback",
          description: `${description} ${data.fallbackReason || 'AI analysis unavailable.'}`,
        });
      } else {
        const title = data.isMultiItem ? "Multi-item flat-lay analyzed" : "Single item analyzed";
        toast({
          title,
          description,
        });
      }
    },
    onError: (error) => {
      console.error('Flat lay analysis error:', error);
      toast({
        title: "Analysis failed",
        description: "Failed to analyze the flat lay image. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Add selected items to wardrobe
  const addItemsMutation = useMutation({
    mutationFn: async (itemsToAdd: FlatLayItem[]) => {
      console.log('Attempting to add items:', itemsToAdd);
      
      const response = await fetch('/api/add-flat-lay-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: itemsToAdd,
          originalImage: analysisResult?.originalImage,
          croppedImages: analysisResult?.croppedImages
        }),
      });

      const responseText = await response.text();
      console.log('Add items response:', responseText);

      if (!response.ok) {
        let errorMessage = 'Failed to add items';
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          errorMessage = responseText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      try {
        return JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse response:', responseText);
        throw new Error('Invalid response from server');
      }
    },
    onSuccess: (data) => {
      console.log('Add items success:', data);
      const successCount = data.items?.length || 0;
      const errorCount = data.errors?.length || 0;

      if (successCount > 0) {
        queryClient.invalidateQueries({ queryKey: ['/api/wardrobe'] });
        toast({
          title: "Items added successfully",
          description: `${successCount} items added to your wardrobe${errorCount > 0 ? ` (${errorCount} failed)` : ''}`,
        });

        // Reset the component state after successful addition
        setAnalysisResult(null);
        setSelectedItems(new Set());

        if (onAnalysisComplete) {
          onAnalysisComplete();
        }
      }

      if (errorCount > 0 && successCount === 0) {
        console.error('All items failed to add:', data.errors);
        toast({
          title: "Failed to add items",
          description: data.errors?.[0]?.error || "All items could not be added. Please try again.",
          variant: "destructive",
        });
      } else if (errorCount > 0) {
        toast({
          title: "Some items failed to add",
          description: `${errorCount} items could not be added. Please try again.`,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      console.error('Add items error:', error);
      toast({
        title: "Failed to add items",
        description: error.message || "Could not add items to wardrobe. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));

    if (imageFile) {
      analyzeMutation.mutate(imageFile);
    } else {
      toast({
        title: "Invalid file",
        description: "Please upload an image file.",
        variant: "destructive",
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      analyzeMutation.mutate(file);
    }
  };

  const toggleItemSelection = (index: number) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedItems(newSelection);
  };

  const handleAddSelectedItems = () => {
    if (!analysisResult || selectedItems.size === 0) return;

    const itemsToAdd = Array.from(selectedItems).map(index => analysisResult.items[index]);
    addItemsMutation.mutate(itemsToAdd);
  };

  // Item editing functions
  const startItemEdit = (index: number) => {
    const newEditingItems = new Map(editingItems);
    newEditingItems.set(index, {});
    setEditingItems(newEditingItems);
  };

  const updateEditingItem = (index: number, updates: Partial<FlatLayItem>) => {
    const newEditingItems = new Map(editingItems);
    const currentEdit = newEditingItems.get(index) || {};
    newEditingItems.set(index, { ...currentEdit, ...updates });
    setEditingItems(newEditingItems);
  };

  const saveItemEdit = (index: number) => {
    if (!analysisResult) return;
    
    const editedItem = editingItems.get(index);
    if (editedItem) {
      const newItems = [...analysisResult.items];
      newItems[index] = { ...newItems[index], ...editedItem };
      setAnalysisResult({ ...analysisResult, items: newItems });
    }
    
    const newEditingItems = new Map(editingItems);
    newEditingItems.delete(index);
    setEditingItems(newEditingItems);
  };

  const cancelItemEdit = (index: number) => {
    const newEditingItems = new Map(editingItems);
    newEditingItems.delete(index);
    setEditingItems(newEditingItems);
  };

  const removeItem = (index: number) => {
    if (!analysisResult) return;
    
    const newItems = analysisResult.items.filter((_, i) => i !== index);
    const newSelected = new Set(selectedItems);
    newSelected.delete(index);
    
    // Adjust selected indices for remaining items
    const adjustedSelected = new Set<number>();
    newSelected.forEach(selectedIndex => {
      if (selectedIndex < index) {
        adjustedSelected.add(selectedIndex);
      } else if (selectedIndex > index) {
        adjustedSelected.add(selectedIndex - 1);
      }
    });
    
    setAnalysisResult({ 
      ...analysisResult, 
      items: newItems,
      itemCount: newItems.length,
      isMultiItem: newItems.length > 1
    });
    setSelectedItems(adjustedSelected);
  };

  const resetAnalysis = () => {
    setAnalysisResult(null);
    setSelectedItems(new Set());
    setEditingItems(new Map());
    setShowProcessedImage(false);
    setShowCroppedImages(false);
  };

  if (analysisResult) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Flat Lay Analysis Complete
          </CardTitle>
          <CardDescription>
            Found {analysisResult.itemCount} individual clothing items. Select which items to add to your wardrobe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Image processing visualization */}
          {analysisResult.imageProcessing && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowProcessedImage(!showProcessedImage)}
                >
                  {showProcessedImage ? 'Hide' : 'Show'} Processed Image
                </Button>
                {analysisResult.croppedImages && analysisResult.croppedImages.length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowCroppedImages(!showCroppedImages)}
                  >
                    {showCroppedImages ? 'Hide' : 'Show'} Cropped Items
                  </Button>
                )}
              </div>
              
              {showProcessedImage && analysisResult.processedImage && (
                <div className="border rounded-lg p-4">
                  <h5 className="font-medium mb-2">Image Processing Result</h5>
                  <p className="text-sm text-gray-600 mb-3">
                    Edge detection and region highlighting. Colored boxes show detected item boundaries.
                  </p>
                  <img 
                    src={`data:image/jpeg;base64,${analysisResult.processedImage}`}
                    alt="Processed flat lay with detected regions"
                    className="max-w-full h-auto border rounded"
                  />
                  <div className="mt-2 text-xs text-gray-500">
                    Found {analysisResult.regions?.length || 0} potential item regions
                  </div>
                </div>
              )}
              
              {showCroppedImages && analysisResult.croppedImages && analysisResult.croppedImages.length > 0 && (
                <div className="border rounded-lg p-4">
                  <h5 className="font-medium mb-2">Individual Item Preview</h5>
                  <p className="text-sm text-gray-600 mb-3">
                    Each item highlighted while others are darkened for clear identification.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {(analysisResult.focusedImages || analysisResult.croppedImages).map((image, index) => (
                      <div key={index} className="border rounded overflow-hidden">
                        <img 
                          src={`data:image/jpeg;base64,${image}`}
                          alt={`Focused item ${index + 1}: ${analysisResult.items[index]?.name || 'Item'}`}
                          className="w-full h-32 object-cover"
                        />
                        <div className="p-2 text-xs text-center bg-gray-50">
                          {analysisResult.items[index]?.name || `Item ${index + 1}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <Separator />
            </div>
          )}

          {/* Enhanced Items grid with focused previews */}
          <div className="grid gap-4">
            {analysisResult.items.map((item, index) => {
              const isEditing = editingItems.has(index);
              const editedItem = editingItems.get(index) || {};
              
              return (
                <div
                  key={index}
                  className={`border rounded-lg overflow-hidden transition-all ${
                    selectedItems.has(index) 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex">
                    {/* Focused item preview */}
                    {analysisResult.focusedImages && analysisResult.focusedImages[index] && (
                      <div className="w-24 h-24 flex-shrink-0">
                        <img 
                          src={`data:image/jpeg;base64,${analysisResult.focusedImages[index]}`}
                          alt={`Focused ${item.name}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    
                    {/* Item details */}
                    <div className="flex-1 p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          {isEditing ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={editedItem.name || item.name}
                                onChange={(e) => updateEditingItem(index, { name: e.target.value })}
                                className="w-full text-sm font-medium border rounded px-2 py-1"
                                placeholder="Item name"
                              />
                              <select
                                value={editedItem.type || item.type}
                                onChange={(e) => updateEditingItem(index, { type: e.target.value })}
                                className="text-xs border rounded px-2 py-1"
                              >
                                <option value="top">Top</option>
                                <option value="bottom">Bottom</option>
                                <option value="dress">Dress</option>
                                <option value="outerwear">Outerwear</option>
                                <option value="shoes">Shoes</option>
                                <option value="accessory">Accessory</option>
                              </select>
                              <input
                                type="text"
                                value={editedItem.color || item.color}
                                onChange={(e) => updateEditingItem(index, { color: e.target.value })}
                                className="text-xs border rounded px-2 py-1"
                                placeholder="Color"
                              />
                            </div>
                          ) : (
                            <>
                              <h4 className="font-medium text-sm">{item.name}</h4>
                              <p className="text-xs text-gray-600 mt-1">{item.description}</p>
                              <div className="flex gap-1 mt-2 flex-wrap">
                                <Badge variant="secondary" className="text-xs">{item.type}</Badge>
                                <Badge variant="outline" className="text-xs">{item.color}</Badge>
                                <Badge variant="outline" className="text-xs">{item.occasion}</Badge>
                              </div>
                            </>
                          )}
                        </div>
                        
                        {/* Action buttons */}
                        <div className="flex items-center gap-2 ml-3">
                          {isEditing ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => saveItemEdit(index)}
                                className="text-xs h-6"
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => cancelItemEdit(index)}
                                className="text-xs h-6"
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startItemEdit(index)}
                              className="text-xs h-6"
                            >
                              Edit
                            </Button>
                          )}
                          
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => removeItem(index)}
                            className="text-xs h-6 text-red-600 hover:text-red-700"
                          >
                            Delete
                          </Button>
                          
                          <div 
                            className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer ${
                              selectedItems.has(index) 
                                ? 'border-blue-500 bg-blue-500' 
                                : 'border-gray-300'
                            }`}
                            onClick={() => toggleItemSelection(index)}
                          >
                            {selectedItems.has(index) && (
                              <CheckCircle className="h-3 w-3 text-white" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <Separator />

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button 
              onClick={handleAddSelectedItems}
              disabled={selectedItems.size === 0 || addItemsMutation.isPending}
              className="flex-1"
            >
              {addItemsMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding {selectedItems.size} items...
                </>
              ) : (
                `Add Selected Items (${selectedItems.size})`
              )}
            </Button>
            <Button variant="outline" onClick={resetAnalysis}>
              Analyze New Image
            </Button>
          </div>

          {/* Processing info */}
          <div className="text-xs text-gray-500 space-y-1">
            <div className="flex items-center gap-2">
              <span>Analysis completed in {analysisResult.processingTime}ms</span>
              {analysisResult.fallback && (
                <Badge variant="outline" className="text-xs">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Fallback mode
                </Badge>
              )}
              {analysisResult.imageProcessing && (
                <Badge variant="outline" className="text-xs bg-blue-50">
                  Image Processing
                </Badge>
              )}
            </div>
            {analysisResult.regions && analysisResult.regions.length > 0 && (
              <div className="text-xs">
                Edge detection found {analysisResult.regions.length} potential regions
              </div>
            )}
            {analysisResult.croppedImages && analysisResult.croppedImages.length > 0 && (
              <div className="text-xs">
                Generated {analysisResult.croppedImages.length} cropped item images
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Flat Lay Analyzer</CardTitle>
        <CardDescription>
          Upload an image with multiple clothing items to automatically detect and separate each piece
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
          } ${analyzeMutation.isPending ? 'opacity-50 pointer-events-none' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {analyzeMutation.isPending ? (
            <div className="space-y-2">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
              <p className="text-gray-600">Analyzing flat lay image...</p>
              <p className="text-sm text-gray-500">Detecting individual clothing items</p>
            </div>
          ) : (
            <div className="space-y-4">
              <Plus className="h-12 w-12 mx-auto text-gray-400" />
              <div>
                <p className="text-lg font-medium">Drop flat lay image here</p>
                <p className="text-gray-600 mt-1">or click to select file</p>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                id="flat-lay-upload"
              />
              <Button asChild variant="outline">
                <label htmlFor="flat-lay-upload" className="cursor-pointer">
                  Select Image
                </label>
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}