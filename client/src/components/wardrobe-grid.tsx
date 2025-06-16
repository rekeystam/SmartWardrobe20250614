import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Grid3X3, Grid2X2, Heart } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { ClothingItem } from "@shared/schema";

const categoryFilters = ['All', 'Tops', 'Bottoms', 'Outerwear', 'Shoes', 'Accessories'];

export function WardrobeGrid() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'large'>('grid');

  const { data: items = [], isLoading } = useQuery<ClothingItem[]>({
    queryKey: ["/api/wardrobe"],
  });

  const filteredItems = items.filter(item => {
    if (selectedCategory === 'All') return true;
    return item.type === selectedCategory.toLowerCase().slice(0, -1);
  });

  if (isLoading) {
    return (
      <Card className="p-6 mb-8">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-square bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">My Wardrobe</h2>
          <p className="text-sm text-gray-500 mt-1">
            {filteredItems.length} items • Last updated today
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            {categoryFilters.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  selectedCategory === category
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('large')}
              className={`p-2 transition-colors ${
                viewMode === 'large' ? 'text-gray-900 bg-white rounded shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Grid2X2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${
                viewMode === 'grid' ? 'text-gray-900 bg-white rounded shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className={`grid gap-4 ${
        viewMode === 'grid' 
          ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6' 
          : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
      }`}>
        {filteredItems.map((item) => (
          <div key={item.id} className="group cursor-pointer">
            <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden relative">
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <Heart className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button className="w-8 h-8 bg-white bg-opacity-90 rounded-full flex items-center justify-center hover:bg-opacity-100">
                  <Heart className={`w-4 h-4 ${item.usageCount > 0 ? 'text-red-500 fill-current' : 'text-gray-600'}`} />
                </button>
              </div>
            </div>
            <div className="mt-2">
              <p className="text-sm font-medium text-gray-900">{item.name}</p>
              <p className="text-xs text-gray-500">
                {item.type.charAt(0).toUpperCase() + item.type.slice(1)} • {item.usageCount}/3 uses
              </p>
            </div>
          </div>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Grid3X3 className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No items found</h3>
          <p className="text-gray-500">
            {selectedCategory === 'All' 
              ? "Start by uploading some clothing items to your wardrobe."
              : `No ${selectedCategory.toLowerCase()} found in your wardrobe.`
            }
          </p>
        </div>
      )}

      {filteredItems.length > 0 && (
        <div className="text-center mt-6">
          <Button variant="outline" className="text-gray-700">
            Load More Items
          </Button>
        </div>
      )}
    </Card>
  );
}
