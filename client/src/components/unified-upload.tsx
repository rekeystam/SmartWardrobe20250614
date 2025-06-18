import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Loader2, CheckCircle, AlertCircle, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AnalyzedItem {
  name: string;
  type: string;
  color: string;
  material: string;
  pattern: string;
  occasion: string;
  demographic: string;
  description: string;
}

interface AnalysisResponse {
  items: AnalyzedItem[];
  processingTime: number;
  filename: string;
  itemCount: number;
  fallback?: boolean;
  originalImage?: string;
  processedImage?: string;
  regions?: Array<{x: number, y: number, width: number, height: number}>;
  croppedImages?: string[];
  imageProcessing?: boolean;
  fallbackReason?: string;
  isMultiItem?: boolean;
}

interface UnifiedUploadProps {
  onUploadComplete?: () => void;
}

export function UnifiedUpload({ onUploadComplete }: UnifiedUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [editedItems, setEditedItems] = useState<Map<number, Partial<AnalyzedItem>>>(new Map());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Analyze uploaded image
  const analyzeMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await fetch('/api/analyze-clothing', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to analyze image');
      }

      return response.json();
    },
    onSuccess: (data: AnalysisResponse) => {
      setAnalysisResult(data);
      // Auto-select all items for multi-item analysis
      if (data.isMultiItem && data.items.length > 1) {
        setSelectedItems(new Set(data.items.map((_, index) => index)));
      } else {
        setSelectedItems(new Set([0])); // Select single item
      }
    },
    onError: (error) => {
      toast({
        title: "Analysis failed",
        description: error.message || "Could not analyze the image. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Add selected items to wardrobe
  const addItemsMutation = useMutation({
    mutationFn: async (itemsToAdd: AnalyzedItem[]) => {
      const response = await fetch('/api/add-clothing-items', {
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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add items');
      }

      return response.json();
    },
    onSuccess: (data) => {
      const successCount = data.items?.length || 0;
      
      if (successCount > 0) {
        queryClient.invalidateQueries({ queryKey: ['/api/wardrobe'] });
        toast({
          title: "Items added successfully",
          description: `${successCount} item(s) added to your wardrobe`,
        });

        // Reset the component state
        resetState();

        if (onUploadComplete) {
          onUploadComplete();
        }
      }
    },
    onError: (error) => {
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
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      analyzeMutation.mutate(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      analyzeMutation.mutate(files[0]);
    }
    e.target.value = ''; // Reset input
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

  const startEditing = (index: number) => {
    setEditingItem(index);
  };

  const saveEdit = (index: number) => {
    setEditingItem(null);
  };

  const updateEditedItem = (index: number, field: keyof AnalyzedItem, value: string) => {
    const newEditedItems = new Map(editedItems);
    const existingEdits = newEditedItems.get(index) || {};
    newEditedItems.set(index, { ...existingEdits, [field]: value });
    setEditedItems(newEditedItems);
  };

  const getItemValue = (item: AnalyzedItem, index: number, field: keyof AnalyzedItem): string => {
    const edited = editedItems.get(index);
    return edited?.[field] || item[field];
  };

  const getFinalItems = (): AnalyzedItem[] => {
    if (!analysisResult) return [];
    
    return Array.from(selectedItems).map(index => {
      const originalItem = analysisResult.items[index];
      const edits = editedItems.get(index) || {};
      return { ...originalItem, ...edits };
    });
  };

  const handleAddSelectedItems = () => {
    const itemsToAdd = getFinalItems();
    if (itemsToAdd.length === 0) return;
    addItemsMutation.mutate(itemsToAdd);
  };

  const resetState = () => {
    setAnalysisResult(null);
    setSelectedItems(new Set());
    setEditingItem(null);
    setEditedItems(new Map());
  };

  if (analysisResult) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            {analysisResult.isMultiItem ? 'Flat Lay Analysis Complete' : 'Item Analysis Complete'}
          </CardTitle>
          <CardDescription>
            {analysisResult.isMultiItem 
              ? `Found ${analysisResult.itemCount} individual clothing items. Select which items to add to your wardrobe.`
              : 'Review the analyzed item and add it to your wardrobe.'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Items grid */}
          <div className="grid gap-3">
            {analysisResult.items.map((item, index) => (
              <div
                key={index}
                className={`p-3 border rounded-lg transition-all ${
                  selectedItems.has(index) 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    {editingItem === index ? (
                      <div className="space-y-2">
                        <Input
                          value={getItemValue(item, index, 'name')}
                          onChange={(e) => updateEditedItem(index, 'name', e.target.value)}
                          placeholder="Item name"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Select
                            value={getItemValue(item, index, 'type')}
                            onValueChange={(value) => updateEditedItem(index, 'type', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="top">Top</SelectItem>
                              <SelectItem value="bottom">Bottom</SelectItem>
                              <SelectItem value="outerwear">Outerwear</SelectItem>
                              <SelectItem value="shoes">Shoes</SelectItem>
                              <SelectItem value="accessories">Accessories</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            value={getItemValue(item, index, 'color')}
                            onChange={(e) => updateEditedItem(index, 'color', e.target.value)}
                            placeholder="Color"
                          />
                        </div>
                        <Button size="sm" onClick={() => saveEdit(index)}>
                          Save Changes
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-sm">{getItemValue(item, index, 'name')}</h4>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEditing(index)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-xs text-gray-600">{item.description}</p>
                        <div className="flex gap-1 flex-wrap">
                          <Badge variant="secondary" className="text-xs">
                            {getItemValue(item, index, 'type')}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {getItemValue(item, index, 'color')}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {getItemValue(item, index, 'occasion')}
                          </Badge>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleItemSelection(index)}
                      className={selectedItems.has(index) ? 'text-red-600' : 'text-green-600'}
                    >
                      {selectedItems.has(index) ? (
                        <>
                          <Trash2 className="h-3 w-3 mr-1" />
                          Remove
                        </>
                      ) : (
                        <>
                          <Plus className="h-3 w-3 mr-1" />
                          Add
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Separator />

          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {selectedItems.size} of {analysisResult.items.length} items selected
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetState}>
                Analyze New Image
              </Button>
              <Button 
                onClick={handleAddSelectedItems}
                disabled={selectedItems.size === 0 || addItemsMutation.isPending}
              >
                {addItemsMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Add Selected Items ({selectedItems.size})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Add Clothing Items
        </CardTitle>
        <CardDescription>
          Upload images of individual items or flat lay photos with multiple items
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
              <p className="text-gray-600">Analyzing image...</p>
              <p className="text-sm text-gray-500">Detecting clothing items</p>
            </div>
          ) : (
            <div className="space-y-4">
              <Plus className="h-12 w-12 mx-auto text-gray-400" />
              <div>
                <p className="text-lg font-medium">Drop image here</p>
                <p className="text-gray-600 mt-1">or click to select file</p>
                <p className="text-sm text-gray-500 mt-2">
                  Works with single items or flat lay photos
                </p>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                id="unified-upload"
              />
              <Button asChild variant="outline">
                <label htmlFor="unified-upload" className="cursor-pointer">
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