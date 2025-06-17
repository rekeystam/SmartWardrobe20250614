
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CloudUpload, Wand2, CheckCircle, AlertTriangle, Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface FlatLayItem {
  name: string;
  category: string;
  color: string;
  material: string;
  position: string;
  confidence: number;
}

export function FlatLayAnalyzer() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<FlatLayItem[] | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const analyzeMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await apiRequest('POST', '/api/analyze-flat-lay', formData);
      return response.json();
    },
    onSuccess: (data) => {
      setAnalysisResult(data.items);
      setShowResults(true);
      setSelectedItems(new Set(data.items.map((_: any, index: number) => index)));
      
      toast({
        title: "Flat Lay Analysis Complete",
        description: `Found ${data.totalItems} clothing items in ${data.processingTime}ms`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze flat lay image",
        variant: "destructive",
      });
    },
  });

  const addSelectedItemsMutation = useMutation({
    mutationFn: async (items: FlatLayItem[]) => {
      const itemsToAdd = items.map(item => ({
        name: item.name,
        type: item.category,
        color: item.color,
        material: item.material || 'unknown',
        pattern: 'solid',
        occasion: 'casual'
      }));

      // For now, we'll use the existing upload endpoint structure
      // In a real implementation, you'd want a dedicated batch creation endpoint
      const results = [];
      for (const item of itemsToAdd) {
        try {
          // Create a simple colored rectangle as placeholder image
          const canvas = document.createElement('canvas');
          canvas.width = 200;
          canvas.height = 200;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = item.color.includes('white') ? '#f8f9fa' : 
                           item.color.includes('black') ? '#212529' :
                           item.color.includes('gray') ? '#6c757d' :
                           item.color.includes('cream') ? '#f5f5dc' :
                           item.color.includes('purple') ? '#6f42c1' :
                           item.color.includes('burgundy') ? '#722f37' : '#007bff';
            ctx.fillRect(0, 0, 200, 200);
            ctx.fillStyle = 'white';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(item.name, 100, 100);
          }
          
          canvas.toBlob(async (blob) => {
            if (blob) {
              const formData = new FormData();
              formData.append('images', blob, `${item.name}.png`);
              
              try {
                const response = await apiRequest('POST', '/api/upload', formData);
                results.push(await response.json());
              } catch (error) {
                console.error('Failed to add item:', item.name, error);
              }
            }
          });
        } catch (error) {
          console.error('Failed to create item:', item.name, error);
        }
      }
      
      return results;
    },
    onSuccess: () => {
      toast({
        title: "Items Added",
        description: `Successfully added ${selectedItems.size} items to your wardrobe`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/wardrobe"] });
      setShowResults(false);
      setSelectedFile(null);
      setAnalysisResult(null);
      setSelectedItems(new Set());
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Add Items",
        description: error.message || "Some items could not be added",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleAnalyze = () => {
    if (selectedFile) {
      analyzeMutation.mutate(selectedFile);
    }
  };

  const toggleItemSelection = (index: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedItems(newSelected);
  };

  const handleAddSelected = () => {
    if (analysisResult) {
      const itemsToAdd = analysisResult.filter((_, index) => selectedItems.has(index));
      addSelectedItemsMutation.mutate(itemsToAdd);
    }
  };

  return (
    <>
      <Card className="p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Flat Lay Analyzer</h2>
            <p className="text-sm text-gray-500 mt-1">
              Upload a photo with multiple clothing items arranged together
            </p>
          </div>
        </div>

        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
              <CloudUpload className="w-8 h-8 text-purple-600" />
            </div>
            <div>
              <p className="text-lg font-medium text-gray-900">Upload Flat Lay Photo</p>
              <p className="text-sm text-gray-500 mt-1">
                Photo with multiple clothing items laid out together
              </p>
            </div>
            
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              id="flat-lay-input"
            />
            
            <div className="flex justify-center gap-3">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => document.getElementById('flat-lay-input')?.click()}
              >
                <Plus className="w-4 h-4 mr-2" />
                Choose Photo
              </Button>
              
              {selectedFile && (
                <Button 
                  onClick={handleAnalyze}
                  disabled={analyzeMutation.isPending}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Wand2 className="w-4 h-4 mr-2" />
                  {analyzeMutation.isPending ? "Analyzing..." : "Analyze Items"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {selectedFile && (
          <div className="mt-6">
            <div className="flex items-center gap-4">
              <img
                src={URL.createObjectURL(selectedFile)}
                alt="Selected flat lay"
                className="w-24 h-24 object-cover rounded-lg"
              />
              <div>
                <p className="font-medium">{selectedFile.name}</p>
                <p className="text-sm text-gray-500">
                  {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Results Dialog */}
      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Found {analysisResult?.length || 0} Clothing Items
            </DialogTitle>
          </DialogHeader>

          {analysisResult && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Select the items you want to add to your wardrobe:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analysisResult.map((item, index) => (
                  <div
                    key={index}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      selectedItems.has(index)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => toggleItemSelection(index)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{item.name}</h3>
                        <div className="mt-2 space-y-1">
                          <div className="flex gap-2">
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {item.category}
                            </span>
                            <span className="text-xs bg-blue-100 px-2 py-1 rounded">
                              {item.color}
                            </span>
                            {item.material && (
                              <span className="text-xs bg-green-100 px-2 py-1 rounded">
                                {item.material}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{item.position}</p>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-400">Confidence:</span>
                            <div className="w-16 h-1 bg-gray-200 rounded">
                              <div
                                className="h-1 bg-green-500 rounded"
                                style={{ width: `${item.confidence}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-400">{item.confidence}%</span>
                          </div>
                        </div>
                      </div>
                      {selectedItems.has(index) && (
                        <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <p className="text-sm text-gray-600">
                  {selectedItems.size} of {analysisResult.length} items selected
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setShowResults(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddSelected}
                    disabled={selectedItems.size === 0 || addSelectedItemsMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {addSelectedItemsMutation.isPending ? "Adding..." : `Add ${selectedItems.size} Items`}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
