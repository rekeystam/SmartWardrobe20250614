import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Upload, Loader2, CheckCircle, AlertCircle } from "lucide-react";
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
  fallback?: boolean;
  originalImage?: string;
}

interface FlatLayAnalyzerProps {
  onAnalysisComplete?: () => void;
}

export function FlatLayAnalyzer({ onAnalysisComplete }: FlatLayAnalyzerProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<FlatLayAnalysisResponse | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Analyze flat lay image
  const analyzeMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/analyze-flat-lay', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      return response.json();
    },
    onSuccess: (data: FlatLayAnalysisResponse) => {
      console.log('Flat lay analysis result:', data);
      setAnalysisResult(data);
      // Select all items by default
      setSelectedItems(new Set(Array.from({ length: data.items.length }, (_, i) => i)));

      if (data.fallback) {
        toast({
          title: "Analysis completed with fallback",
          description: `Found ${data.itemCount} item(s). AI analysis unavailable, using basic detection.`,
        });
      } else {
        toast({
          title: "Flat lay analyzed successfully",
          description: `Detected ${data.itemCount} individual clothing items in ${data.processingTime}ms`,
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
      const response = await fetch('/api/add-flat-lay-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: itemsToAdd,
          originalImage: analysisResult?.originalImage
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add items');
      }

      return response.json();
    },
    onSuccess: (data) => {
      const successCount = data.items?.length || 0;
      const errorCount = data.errors?.length || 0;

      if (successCount > 0) {
        queryClient.invalidateQueries({ queryKey: ['/api/wardrobe'] });
        toast({
          title: "Items added successfully",
          description: `${successCount} items added to your wardrobe${errorCount > 0 ? ` (${errorCount} failed)` : ''}`,
        });

        if (onAnalysisComplete) {
          onAnalysisComplete();
        }
      }

      if (errorCount > 0) {
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
        description: "Could not add items to wardrobe. Please try again.",
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

  const resetAnalysis = () => {
    setAnalysisResult(null);
    setSelectedItems(new Set());
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
          {/* Items grid */}
          <div className="grid gap-3">
            {analysisResult.items.map((item, index) => (
              <div
                key={index}
                className={`p-3 border rounded-lg cursor-pointer transition-all ${
                  selectedItems.has(index) 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => toggleItemSelection(index)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{item.name}</h4>
                    <p className="text-xs text-gray-600 mt-1">{item.description}</p>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      <Badge variant="secondary" className="text-xs">{item.type}</Badge>
                      <Badge variant="outline" className="text-xs">{item.color}</Badge>
                      <Badge variant="outline" className="text-xs">{item.occasion}</Badge>
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                    selectedItems.has(index) 
                      ? 'border-blue-500 bg-blue-500' 
                      : 'border-gray-300'
                  }`}>
                    {selectedItems.has(index) && (
                      <CheckCircle className="h-3 w-3 text-white" />
                    )}
                  </div>
                </div>
              </div>
            ))}
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
          <div className="text-xs text-gray-500 flex items-center gap-2">
            <span>Analysis completed in {analysisResult.processingTime}ms</span>
            {analysisResult.fallback && (
              <Badge variant="outline" className="text-xs">
                <AlertCircle className="h-3 w-3 mr-1" />
                Fallback mode
              </Badge>
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
              <Upload className="h-12 w-12 mx-auto text-gray-400" />
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