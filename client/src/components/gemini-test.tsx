
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Upload } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface AnalysisResult {
  analysis: {
    type: string;
    color: string;
    name: string;
  };
  processingTime: number;
  filename: string;
}

export function GeminiTest() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const analyzeMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await apiRequest('POST', '/api/analyze-image', formData);
      return response.json();
    },
    onSuccess: (data) => {
      setResult(data);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
    }
  };

  const handleAnalyze = () => {
    if (selectedFile) {
      analyzeMutation.mutate(selectedFile);
    }
  };

  return (
    <Card className="p-6 mb-8 border-dashed border-2 border-gray-300">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-4">🧠 Gemini AI Test</h3>
        
        <div className="space-y-4">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            id="test-file-input"
          />
          
          <Button
            variant="outline"
            onClick={() => document.getElementById('test-file-input')?.click()}
            className="w-full max-w-xs"
          >
            <Upload className="w-4 h-4 mr-2" />
            Select Test Image
          </Button>

          {previewUrl && (
            <div className="flex flex-col items-center space-y-4">
              <img
                src={previewUrl}
                alt="Preview"
                className="w-32 h-32 object-cover rounded-lg border"
              />
              
              <Button
                onClick={handleAnalyze}
                disabled={analyzeMutation.isPending}
                className="bg-primary hover:bg-primary/90"
              >
                <Eye className="w-4 h-4 mr-2" />
                {analyzeMutation.isPending ? "Analyzing..." : "Analyze with Gemini"}
              </Button>
            </div>
          )}

          {result && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-left max-w-md mx-auto">
              <h4 className="font-semibold text-green-800 mb-2">Analysis Result:</h4>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary">{result.analysis.type}</Badge>
                  <Badge variant="outline" style={{ color: result.analysis.color }}>
                    {result.analysis.color}
                  </Badge>
                </div>
                <p className="text-sm"><strong>Name:</strong> {result.analysis.name}</p>
                <p className="text-xs text-gray-600">
                  Processed in {result.processingTime}ms
                </p>
              </div>
            </div>
          )}

          {analyzeMutation.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 max-w-md mx-auto">
              <p className="text-sm">Analysis failed. Make sure GOOGLE_API_KEY is set in your environment.</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
