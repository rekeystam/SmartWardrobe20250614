import { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CloudUpload, Plus, X, Wand2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface UploadZoneProps {
  onUploadComplete?: () => void;
}

export function UploadZone({ onUploadComplete }: UploadZoneProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('images', file);
      });
      
      const response = await apiRequest('POST', '/api/upload', formData);
      
      // Handle 207 Multi-Status as success (partial duplicates)
      if (response.status === 207) {
        return response.json();
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      const processingTime = data.processingTime ? ` in ${data.processingTime}ms` : '';
      
      if (data.duplicates && data.duplicates.length > 0 && (!data.items || data.items.length === 0)) {
        // All duplicates
        toast({
          title: "Duplicate Items Detected",
          description: `All ${data.duplicates.length} items were duplicates and not added.`,
          variant: "destructive",
        });
      } else if (data.duplicates && data.duplicates.length > 0 && data.items && data.items.length > 0) {
        // Partial success
        toast({
          title: "Upload Complete",
          description: `${data.items.length} new items analyzed and added, ${data.duplicates.length} duplicates skipped${processingTime}.`,
        });
      } else if (data.items && data.items.length > 0) {
        // All success
        toast({
          title: "AI Analysis Complete",
          description: `${data.items.length} items analyzed and added to your wardrobe${processingTime}.`,
        });
      }
      
      setSelectedFiles([]);
      queryClient.invalidateQueries({ queryKey: ["/api/wardrobe"] });
      onUploadComplete?.();
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to process uploaded files",
        variant: "destructive",
      });
    },
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/')
    ).slice(0, 10);
    
    // Check each file for duplicates in real-time
    const validFiles = [];
    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('image', file);
        
        const response = await apiRequest('POST', '/api/check-duplicate', formData);
        const result = await response.json();
        
        if (result.isDuplicate) {
          const reason = result.reason || 'identical image';
          const similarity = result.similarity || 100;
          toast({
            title: "Duplicate Item Detected",
            description: `${file.name} matches "${result.existingItem.name}" (${similarity}% similarity - ${reason})`,
            variant: "destructive",
          });
        } else {
          validFiles.push(file);
          // Show suggested name if available
          if (result.suggestedName) {
            console.log(`AI suggests: "${result.suggestedName}" for ${file.name}`);
          }
        }
      } catch (error) {
        // If duplicate check fails, still add the file
        validFiles.push(file);
      }
    }
    
    setSelectedFiles(prev => [...prev, ...validFiles].slice(0, 10));
  }, [toast]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).slice(0, 10);
      
      // Check each file for duplicates in real-time
      const validFiles = [];
      for (const file of files) {
        try {
          const formData = new FormData();
          formData.append('image', file);
          
          const response = await apiRequest('POST', '/api/check-duplicate', formData);
          const result = await response.json();
          
          if (result.isDuplicate) {
            toast({
              title: "Duplicate Item Detected",
              description: `${file.name} is already in your wardrobe as "${result.existingItem.name}"`,
              variant: "destructive",
            });
          } else {
            validFiles.push(file);
          }
        } catch (error) {
          // If duplicate check fails, still add the file
          validFiles.push(file);
        }
      }
      
      setSelectedFiles(prev => [...prev, ...validFiles].slice(0, 10));
    }
  }, [toast]);

  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearAll = useCallback(() => {
    setSelectedFiles([]);
  }, []);

  const handleUpload = useCallback(() => {
    if (selectedFiles.length > 0) {
      uploadMutation.mutate(selectedFiles);
    }
  }, [selectedFiles, uploadMutation]);

  return (
    <Card className="p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Add Clothing Items</h2>
        <span className="text-sm text-gray-500">Maximum 10 items at once</span>
      </div>
      
      <div 
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
          isDragOver 
            ? 'border-primary bg-blue-50' 
            : 'border-gray-300 hover:border-primary hover:bg-blue-50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <div className="space-y-4">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <CloudUpload className="w-8 h-8 text-primary" />
          </div>
          <div>
            <p className="text-lg font-medium text-gray-900">Drop your clothing photos here</p>
            <p className="text-sm text-gray-500 mt-1">or click to browse files</p>
          </div>
          <div className="flex justify-center">
            <Button type="button" className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              Choose Files
            </Button>
          </div>
          <p className="text-xs text-gray-400">Supports JPG, PNG, WEBP • Max 5MB per file</p>
        </div>
      </div>

      <input
        id="file-input"
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {selectedFiles.length > 0 && (
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {selectedFiles.map((file, index) => (
            <div key={index} className="relative group">
              <div className="aspect-square bg-gray-100 rounded-lg border-2 border-gray-300 overflow-hidden">
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-1 truncate">{file.name}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center mt-6 pt-6 border-t border-gray-200">
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-600">{selectedFiles.length} files selected</span>
          {uploadMutation.isPending && (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm text-gray-600">AI analyzing {selectedFiles.length} items with Gemini...</span>
            </div>
          )}
        </div>
        <div className="flex space-x-3">
          <Button 
            variant="outline" 
            onClick={clearAll}
            disabled={selectedFiles.length === 0 || uploadMutation.isPending}
          >
            Clear All
          </Button>
          <Button 
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || uploadMutation.isPending}
            className="bg-primary hover:bg-primary/90"
          >
            <Wand2 className="w-4 h-4 mr-2" />
            Analyze & Add
          </Button>
        </div>
      </div>
    </Card>
  );
}
