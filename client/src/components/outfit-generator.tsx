import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Wand2, Heart, Share2, CheckCircle, Palette, Thermometer, Star, AlertTriangle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ClothingItem } from "@shared/schema";

interface GeneratedOutfit {
  name: string;
  items: ClothingItem[];
  occasion: string;
  temperature: number;
  timeOfDay: string;
  season: string;
  score: number;
  weatherAppropriate: boolean;
  recommendations: string[];
  personalizedFor?: {
    age: number;
    bodyType: string;
    skinTone: string;
    gender: string;
  };
}

export function OutfitGenerator() {
  const [occasion, setOccasion] = useState('casual');
  const [temperature, setTemperature] = useState([18]);
  const [timeOfDay, setTimeOfDay] = useState('afternoon');
  const [season, setSeason] = useState('spring');
  const [generatedOutfits, setGeneratedOutfits] = useState<GeneratedOutfit[]>([]);
  const { toast } = useToast();

  const generateOutfitMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/generate-outfit', {
        occasion,
        temperature: temperature[0],
        timeOfDay,
        season
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.outfits && data.outfits.length > 0) {
        setGeneratedOutfits(data.outfits);
        const personalizedMsg = data.personalizedFor ? 
          `Personalized for ${data.personalizedFor.user.gender}, ${data.personalizedFor.user.age} years old, ${data.personalizedFor.user.bodyType} build` : 
          "based on your preferences";
        toast({
          title: "Personalized Outfits Generated",
          description: `${data.outfits.length} outfit suggestions ${personalizedMsg}.`,
        });
      } else {
        setGeneratedOutfits([]);
        toast({
          title: "No Outfits Available",
          description: "Unable to generate outfits with current wardrobe items.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      setGeneratedOutfits([]);
      if (error.message.includes('Insufficient wardrobe items')) {
        toast({
          title: "Insufficient Wardrobe Items",
          description: "You need more items in your wardrobe to create complete outfits.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Generation Failed",
          description: error.message || "Failed to generate outfit suggestions",
          variant: "destructive",
        });
      }
    },
  });

  const handleGenerateOutfit = () => {
    generateOutfitMutation.mutate();
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Generate Outfit</h2>
          <p className="text-sm text-gray-500 mt-1">AI-powered suggestions based on your wardrobe</p>
        </div>
        <Button 
          onClick={handleGenerateOutfit}
          disabled={generateOutfitMutation.isPending}
          className="bg-primary hover:bg-primary/90"
        >
          <Wand2 className="w-4 h-4 mr-2" />
          {generateOutfitMutation.isPending ? 'Generating...' : 'Generate Outfit'}
        </Button>
      </div>

      {/* Outfit Parameters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Occasion</label>
          <Select value={occasion} onValueChange={setOccasion}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="casual">Casual</SelectItem>
              <SelectItem value="smart-casual">Smart Casual</SelectItem>
              <SelectItem value="formal">Formal</SelectItem>
              <SelectItem value="party">Party</SelectItem>
              <SelectItem value="business">Business</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Temperature</label>
          <div className="flex items-center space-x-2">
            <Slider
              value={temperature}
              onValueChange={setTemperature}
              max={35}
              min={0}
              step={1}
              className="flex-1"
            />
            <span className="text-sm font-medium text-gray-700 min-w-[3rem]">
              {temperature[0]}°C
            </span>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Time of Day</label>
          <Select value={timeOfDay} onValueChange={setTimeOfDay}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="morning">Morning</SelectItem>
              <SelectItem value="afternoon">Afternoon</SelectItem>
              <SelectItem value="evening">Evening</SelectItem>
              <SelectItem value="night">Night</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Season</label>
          <Select value={season} onValueChange={setSeason}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="spring">Spring</SelectItem>
              <SelectItem value="summer">Summer</SelectItem>
              <SelectItem value="fall">Fall</SelectItem>
              <SelectItem value="winter">Winter</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Generated Outfits */}
      <div className="space-y-6">
        {generateOutfitMutation.isPending && (
          <div className="text-center py-12">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Generating Outfits</h3>
            <p className="text-gray-500">Creating personalized suggestions for you...</p>
          </div>
        )}

        {generatedOutfits.map((outfit, index) => (
          <Card key={index} className="border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{outfit.name}</h3>
                <p className="text-sm text-gray-500">
                  Perfect for {outfit.temperature}°C weather • {outfit.items.length} items
                </p>
              </div>
              <div className="flex space-x-2">
                <button className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                  <Heart className="w-4 h-4" />
                </button>
                <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className={`grid gap-4 ${
              outfit.items.length <= 3 ? 'grid-cols-3' : 'grid-cols-4'
            }`}>
              {outfit.items.map((item) => (
                <div key={item.id} className="text-center">
                  <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-2">
                    <img 
                      src={item.imageUrl} 
                      alt={item.name}
                      className="w-full h-full object-cover" 
                    />
                  </div>
                  <p className="text-sm font-medium text-gray-900">{item.name}</p>
                  <p className="text-xs text-gray-500">
                    {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  {outfit.weatherAppropriate && (
                    <span className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-1" />
                      Weather appropriate
                    </span>
                  )}
                  <span className="flex items-center">
                    <Palette className="w-4 h-4 text-purple-500 mr-1" />
                    Colors match your skin tone
                  </span>
                  {outfit.temperature < 14 && (
                    <span className="flex items-center">
                      <Thermometer className="w-4 h-4 text-blue-500 mr-1" />
                      Layered for temperature
                    </span>
                  )}
                  <span className="flex items-center">
                    <Star className="w-4 h-4 text-yellow-500 mr-1" />
                    Highly recommended
                  </span>
                </div>
                <Button className="bg-green-600 hover:bg-green-700 text-white">
                  Try This Outfit
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {!generateOutfitMutation.isPending && generatedOutfits.length === 0 && generateOutfitMutation.isError && (
          <div className="text-center py-12">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to Generate Outfit</h3>
            <p className="text-gray-500 mb-4">You need more items in your wardrobe to create a complete outfit.</p>
            <div className="space-y-2 text-sm text-gray-600">
              <p className="flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-red-500 mr-2" />
                Missing: Essential wardrobe items
              </p>
            </div>
            <Button className="mt-4 bg-primary hover:bg-primary/90">
              Add Missing Items
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
