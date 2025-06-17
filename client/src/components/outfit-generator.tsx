
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Wand2, Heart, Share2, CheckCircle, Palette, Thermometer, Star, AlertTriangle, Plus, Minus, RotateCcw, Edit3, Save } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
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
  const [generatedOutfits, setGeneratedOutfits] = useState<GeneratedOutfit[]>([]);
  const [customizingOutfit, setCustomizingOutfit] = useState<number | null>(null);
  const [showItemSelector, setShowItemSelector] = useState<{ outfitIndex: number; itemType: string } | null>(null);
  const [customizedOutfits, setCustomizedOutfits] = useState<Record<number, ClothingItem[]>>({});
  const { toast } = useToast();

  // Get user's wardrobe for customization
  const { data: wardrobeItems = [] } = useQuery<ClothingItem[]>({
    queryKey: ["/api/wardrobe"],
  });

  const generateOutfitMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/generate-outfit', {
        occasion
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

  // Get current outfit items (customized or original)
  const getCurrentOutfitItems = (outfitIndex: number): ClothingItem[] => {
    return customizedOutfits[outfitIndex] || generatedOutfits[outfitIndex]?.items || [];
  };

  // Remove item from outfit
  const removeItemFromOutfit = (outfitIndex: number, itemId: number) => {
    const currentItems = getCurrentOutfitItems(outfitIndex);
    const updatedItems = currentItems.filter(item => item.id !== itemId);
    
    setCustomizedOutfits(prev => ({
      ...prev,
      [outfitIndex]: updatedItems
    }));
    
    toast({
      title: "Item Removed",
      description: "Item has been removed from the outfit.",
    });
  };

  // Add item to outfit
  const addItemToOutfit = (outfitIndex: number, newItem: ClothingItem) => {
    const currentItems = getCurrentOutfitItems(outfitIndex);
    
    // Check if item already exists in outfit
    if (currentItems.some(item => item.id === newItem.id)) {
      toast({
        title: "Item Already Added",
        description: "This item is already in the outfit.",
        variant: "destructive",
      });
      return;
    }
    
    const updatedItems = [...currentItems, newItem];
    
    setCustomizedOutfits(prev => ({
      ...prev,
      [outfitIndex]: updatedItems
    }));
    
    setShowItemSelector(null);
    
    toast({
      title: "Item Added",
      description: `${newItem.name} has been added to the outfit.`,
    });
  };

  // Replace item in outfit
  const replaceItemInOutfit = (outfitIndex: number, oldItemId: number, newItem: ClothingItem) => {
    const currentItems = getCurrentOutfitItems(outfitIndex);
    const updatedItems = currentItems.map(item => 
      item.id === oldItemId ? newItem : item
    );
    
    setCustomizedOutfits(prev => ({
      ...prev,
      [outfitIndex]: updatedItems
    }));
    
    setShowItemSelector(null);
    
    toast({
      title: "Item Replaced",
      description: `Item has been replaced with ${newItem.name}.`,
    });
  };

  // Reset outfit to original AI suggestion
  const resetOutfitToOriginal = (outfitIndex: number) => {
    setCustomizedOutfits(prev => {
      const updated = { ...prev };
      delete updated[outfitIndex];
      return updated;
    });
    
    toast({
      title: "Outfit Reset",
      description: "Outfit has been reset to the original AI suggestion.",
    });
  };

  // Save customized outfit
  const saveOutfitMutation = useMutation({
    mutationFn: async ({ outfitIndex, customName }: { outfitIndex: number; customName?: string }) => {
      const items = getCurrentOutfitItems(outfitIndex);
      const outfit = generatedOutfits[outfitIndex];
      
      const response = await apiRequest('POST', '/api/save-outfit', {
        name: customName || `${outfit.name} - Customized`,
        occasion: outfit.occasion,
        itemIds: items.map(item => item.id)
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Outfit Saved",
        description: `"${data.outfit.name}" has been saved to your collection.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save outfit",
        variant: "destructive",
      });
    },
  });

  const saveCustomizedOutfit = (outfitIndex: number) => {
    const items = getCurrentOutfitItems(outfitIndex);
    if (items.length === 0) return;
    
    // Check if outfit has minimum requirements
    const hasTop = items.some(item => item.type === 'top');
    const hasBottom = items.some(item => item.type === 'bottom');
    
    if (!hasTop || !hasBottom) {
      toast({
        title: "Invalid Outfit",
        description: "Outfit must include at least one top and one bottom.",
        variant: "destructive",
      });
      return;
    }
    
    saveOutfitMutation.mutate({ outfitIndex });
  };

  // Filter available items for adding to outfit
  const getAvailableItemsForType = (itemType: string): ClothingItem[] => {
    return wardrobeItems.filter(item => 
      item.type === itemType && item.usageCount < 3
    );
  };

  // Get items that can replace a specific item
  const getReplaceableItems = (currentItem: ClothingItem): ClothingItem[] => {
    return wardrobeItems.filter(item => 
      item.type === currentItem.type && 
      item.id !== currentItem.id && 
      item.usageCount < 3
    );
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            Generate Outfit
            <span className="ml-2 text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2 py-1 rounded-full">
              🧠 AI Powered
            </span>
          </h2>
          <p className="text-sm text-gray-500 mt-1">Real Gemini AI suggestions based on your wardrobe</p>
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
      <div className="flex justify-center mb-6">
        <div className="w-full max-w-md space-y-2">
          <Label htmlFor="occasion" className="text-sm font-medium text-gray-700">
            Occasion
          </Label>
          <Select value={occasion} onValueChange={setOccasion}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="casual">Everyday Casual</SelectItem>
              <SelectItem value="work">Work Smart</SelectItem>
              <SelectItem value="sport">Active & Sporty</SelectItem>
              <SelectItem value="social">Evening Social</SelectItem>
              <SelectItem value="formal">Dress to Impress</SelectItem>
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

        {generatedOutfits.map((outfit, index) => {
          const currentItems = getCurrentOutfitItems(index);
          const isCustomized = customizedOutfits[index] !== undefined;
          const isCustomizing = customizingOutfit === index;
          
          return (
            <Card key={index} className="border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {outfit.name}
                    {isCustomized && (
                      <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                        Customized
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Perfect for {outfit.temperature}°C weather • {currentItems.length} items
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => setCustomizingOutfit(isCustomizing ? null : index)}
                    className={`p-2 transition-colors ${
                      isCustomizing ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-blue-500'
                    }`}
                    title="Customize outfit"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  {isCustomized && (
                    <>
                      <button 
                        onClick={() => resetOutfitToOriginal(index)}
                        className="p-2 text-gray-400 hover:text-orange-500 transition-colors"
                        title="Reset to original"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => saveCustomizedOutfit(index)}
                        className="p-2 text-gray-400 hover:text-green-500 transition-colors"
                        title="Save outfit"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <button className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                    <Heart className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className={`grid gap-4 ${
                currentItems.length <= 3 ? 'grid-cols-3' : 'grid-cols-4'
              }`}>
                {currentItems.map((item) => (
                  <div key={item.id} className="text-center relative group">
                    <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-2 relative">
                      <img 
                        src={item.imageUrl} 
                        alt={item.name}
                        className="w-full h-full object-cover" 
                      />
                      
                      {isCustomizing && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                          <button
                            onClick={() => setShowItemSelector({ outfitIndex: index, itemType: item.type })}
                            className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white hover:bg-blue-600"
                            title="Replace item"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removeItemFromOutfit(index, item.id)}
                            className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600"
                            title="Remove item"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                    </p>
                  </div>
                ))}
                
                {isCustomizing && (
                  <div className="text-center">
                    <button
                      onClick={() => setShowItemSelector({ outfitIndex: index, itemType: 'any' })}
                      className="aspect-square bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg mb-2 flex items-center justify-center hover:border-gray-400 hover:bg-gray-100 transition-colors w-full"
                    >
                      <Plus className="w-8 h-8 text-gray-400" />
                    </button>
                    <p className="text-sm font-medium text-gray-600">Add Item</p>
                    <p className="text-xs text-gray-500">From wardrobe</p>
                  </div>
                )}
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
          );
        })}

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

      {/* Item Selector Dialog */}
      <Dialog open={!!showItemSelector} onOpenChange={() => setShowItemSelector(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {showItemSelector?.itemType === 'any' 
                ? 'Add Item to Outfit' 
                : `Replace ${showItemSelector?.itemType || 'item'}`
              }
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto">
            {showItemSelector && (
              <div className="space-y-4">
                {showItemSelector.itemType === 'any' ? (
                  // Show all available items grouped by type
                  <div className="space-y-6">
                    {['top', 'bottom', 'outerwear', 'shoes', 'accessories'].map(itemType => {
                      const availableItems = getAvailableItemsForType(itemType);
                      if (availableItems.length === 0) return null;
                      
                      return (
                        <div key={itemType}>
                          <h4 className="font-medium text-gray-900 mb-3 capitalize">
                            {itemType}s ({availableItems.length})
                          </h4>
                          <div className="grid grid-cols-4 gap-3">
                            {availableItems.map(item => (
                              <div key={item.id} className="text-center cursor-pointer group">
                                <div 
                                  className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-2 hover:ring-2 hover:ring-blue-500"
                                  onClick={() => addItemToOutfit(showItemSelector.outfitIndex, item)}
                                >
                                  <img
                                    src={item.imageUrl}
                                    alt={item.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                  />
                                </div>
                                <p className="text-xs font-medium text-gray-900 truncate">{item.name}</p>
                                <p className="text-xs text-gray-500">{item.color}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  // Show items that can replace the current item
                  <div>
                    <p className="text-sm text-gray-600 mb-4">
                      Choose a replacement {showItemSelector.itemType}:
                    </p>
                    <div className="grid grid-cols-4 gap-3">
                      {getReplaceableItems(
                        getCurrentOutfitItems(showItemSelector.outfitIndex)
                          .find(item => item.type === showItemSelector.itemType)!
                      ).map(item => (
                        <div key={item.id} className="text-center cursor-pointer group">
                          <div 
                            className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-2 hover:ring-2 hover:ring-blue-500"
                            onClick={() => {
                              const currentItem = getCurrentOutfitItems(showItemSelector.outfitIndex)
                                .find(i => i.type === showItemSelector.itemType);
                              if (currentItem) {
                                replaceItemInOutfit(showItemSelector.outfitIndex, currentItem.id, item);
                              }
                            }}
                          >
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          </div>
                          <p className="text-xs font-medium text-gray-900 truncate">{item.name}</p>
                          <p className="text-xs text-gray-500">{item.color}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {showItemSelector && (
                  showItemSelector.itemType === 'any' 
                    ? getAvailableItemsForType('top').length === 0 && 
                      getAvailableItemsForType('bottom').length === 0 &&
                      getAvailableItemsForType('outerwear').length === 0 &&
                      getAvailableItemsForType('shoes').length === 0 &&
                      getAvailableItemsForType('accessories').length === 0
                    : getReplaceableItems(
                        getCurrentOutfitItems(showItemSelector.outfitIndex)
                          .find(item => item.type === showItemSelector.itemType)!
                      ).length === 0
                ) && (
                  <div className="text-center py-8">
                    <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <AlertTriangle className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Items Available</h3>
                    <p className="text-gray-500">
                      {showItemSelector.itemType === 'any' 
                        ? "No available items in your wardrobe to add."
                        : `No alternative ${showItemSelector.itemType}s available for replacement.`
                      }
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
