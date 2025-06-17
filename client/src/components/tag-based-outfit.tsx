
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Wand2, Plus, AlertCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ClothingItem } from "@shared/schema";

interface OutfitSuggestion {
  outfitName: string;
  stylingInstructions: string;
  recommendations: string[];
  occasionFit: string;
  colorAnalysis: string;
  missingPieces: string[];
  confidenceScore: number;
}

export function TagBasedOutfit() {
  const [tags, setTags] = useState<string[]>([]);
  const [currentTag, setCurrentTag] = useState('');
  const [occasion, setOccasion] = useState('casual');
  const [suggestion, setSuggestion] = useState<{
    matchedItems: ClothingItem[];
    unmatchedTags: string[];
    outfitSuggestion: OutfitSuggestion;
    aiPowered: boolean;
  } | null>(null);
  
  const { toast } = useToast();

  const suggestOutfitMutation = useMutation({
    mutationFn: async () => {
      if (tags.length === 0) {
        throw new Error("Please add at least one clothing tag");
      }

      const response = await apiRequest('POST', '/api/suggest-outfit-with-tags', {
        tags,
        occasion,
        style: 'modern classic',
        temperature: 20
      });
      return response.json();
    },
    onSuccess: (data) => {
      setSuggestion(data);
      if (data.unmatchedTags.length > 0) {
        toast({
          title: "Partial Match",
          description: `Found ${data.matchedItems.length} items. ${data.unmatchedTags.length} tags didn't match any items.`,
          variant: "default",
        });
      } else {
        toast({
          title: "Perfect Match!",
          description: `Found all ${data.matchedItems.length} requested items in your wardrobe.`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Outfit Suggestion Failed",
        description: error.message || "Failed to generate outfit suggestion",
        variant: "destructive",
      });
    },
  });

  const addTag = () => {
    const trimmedTag = currentTag.trim();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const clearAll = () => {
    setTags([]);
    setSuggestion(null);
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center mb-2">
            Tag-Based Outfit Suggestions
            <span className="ml-2 text-xs bg-gradient-to-r from-green-500 to-blue-500 text-white px-2 py-1 rounded-full">
              🎯 Smart Matching
            </span>
          </h2>
          <p className="text-sm text-gray-500">
            Enter clothing items, colors, or styles you want to wear and get AI-powered styling suggestions
          </p>
        </div>

        {/* Tag Input */}
        <div className="space-y-3">
          <Label htmlFor="tag-input">Add Clothing Tags</Label>
          <div className="flex space-x-2">
            <Input
              id="tag-input"
              value={currentTag}
              onChange={(e) => setCurrentTag(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="e.g., white blouse, blue jeans, red heels, leather jacket"
              className="flex-1"
            />
            <Button 
              onClick={addTag} 
              disabled={!currentTag.trim()}
              variant="outline"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Example suggestions */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-gray-500">Try:</span>
            {['white shirt', 'black jeans', 'leather jacket', 'red dress', 'blue blazer'].map(example => (
              <button
                key={example}
                onClick={() => {
                  if (!tags.includes(example)) {
                    setTags([...tags, example]);
                  }
                }}
                className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-full transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        {/* Selected Tags */}
        {tags.length > 0 && (
          <div className="space-y-2">
            <Label>Selected Items ({tags.length})</Label>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="flex items-center space-x-1">
                  <span>{tag}</span>
                  <button
                    onClick={() => removeTag(tag)}
                    className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <Button
            onClick={() => suggestOutfitMutation.mutate()}
            disabled={tags.length === 0 || suggestOutfitMutation.isPending}
            className="bg-primary hover:bg-primary/90"
          >
            <Wand2 className="w-4 h-4 mr-2" />
            {suggestOutfitMutation.isPending ? 'Generating...' : 'Get Outfit Suggestion'}
          </Button>
          <Button variant="outline" onClick={clearAll} disabled={tags.length === 0}>
            Clear All
          </Button>
        </div>

        {/* Results */}
        {suggestion && (
          <div className="space-y-6 border-t pt-6">
            {/* Matched Items */}
            {suggestion.matchedItems.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">
                  Matched Items ({suggestion.matchedItems.length})
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {suggestion.matchedItems.map((item) => (
                    <div key={item.id} className="text-center">
                      <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-2">
                        <img 
                          src={item.imageUrl} 
                          alt={item.name}
                          className="w-full h-full object-cover" 
                        />
                      </div>
                      <p className="text-sm font-medium text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.color} • {item.type}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unmatched Tags */}
            {suggestion.unmatchedTags.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                  <h4 className="text-sm font-medium text-yellow-800">Items Not Found</h4>
                </div>
                <div className="flex flex-wrap gap-2">
                  {suggestion.unmatchedTags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-yellow-700 border-yellow-300">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-yellow-600 mt-2">
                  These items weren't found in your wardrobe. Consider adding them or using similar alternatives.
                </p>
              </div>
            )}

            {/* AI Styling Suggestion */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-blue-900">
                  {suggestion.outfitSuggestion.outfitName}
                </h3>
                <div className="flex items-center space-x-2">
                  {suggestion.aiPowered && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                      AI-Powered
                    </span>
                  )}
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                    {suggestion.outfitSuggestion.confidenceScore}% Match
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-blue-900 mb-2">Styling Instructions</h4>
                  <p className="text-sm text-blue-800">{suggestion.outfitSuggestion.stylingInstructions}</p>
                </div>

                <div>
                  <h4 className="font-medium text-blue-900 mb-2">Style Tips</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    {suggestion.outfitSuggestion.recommendations.map((tip, index) => (
                      <li key={index} className="flex items-start space-x-2">
                        <span className="text-blue-600 mt-1">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-blue-900 mb-2">Occasion Fit</h4>
                    <p className="text-sm text-blue-800">{suggestion.outfitSuggestion.occasionFit}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-blue-900 mb-2">Color Analysis</h4>
                    <p className="text-sm text-blue-800">{suggestion.outfitSuggestion.colorAnalysis}</p>
                  </div>
                </div>

                {suggestion.outfitSuggestion.missingPieces.length > 0 && (
                  <div>
                    <h4 className="font-medium text-blue-900 mb-2">Complete the Look</h4>
                    <div className="flex flex-wrap gap-2">
                      {suggestion.outfitSuggestion.missingPieces.map((piece, index) => (
                        <Badge key={index} variant="outline" className="text-blue-700">
                          {piece}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
