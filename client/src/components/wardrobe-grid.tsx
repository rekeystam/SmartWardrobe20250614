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
    
    // Map display category names to item types
    const categoryMap: { [key: string]: string } = {
      'Tops': 'top',
      'Bottoms': 'bottom',
      'Outerwear': 'outerwear',
      'Shoes': 'shoes',
      'Accessories': 'accessories',
      'Socks': 'socks',
      'Underwear': 'underwear'
    };
    
    return item.type === categoryMap[selectedCategory];
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

      <div className={`grid gap-3 sm:gap-4 ${
        viewMode === 'grid' 
          ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6' 
          : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
      }`}>
        {filteredItems.map((item) => (
          <div key={item.id} className="group cursor-pointer">
            <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden relative">
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
              
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                <div className="text-white space-y-1.5">
                  <p className="font-semibold text-sm leading-tight break-words item-label">{item.name}</p>
                  <div className="metadata-grid gap-1">
                    <span className="tag-badge tag-type">
                      {item.type}
                    </span>
                    <span className="tag-badge tag-color">
                      {item.color}
                    </span>
                    {item.material && item.material !== 'unknown' && (
                      <span className="tag-badge tag-material">
                        {item.material}
                      </span>
                    )}
                    {item.pattern && item.pattern !== 'solid' && (
                      <span className="tag-badge tag-pattern">
                        {item.pattern}
                      </span>
                    )}
                    {item.occasion && item.occasion !== 'casual' && (
                      <span className="tag-badge tag-occasion">
                        {item.occasion}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-white">
                  <div className="flex items-center justify-between">
                    <p className="text-xs">Used {item.usageCount || 0}/3 times</p>
                    <div className="flex w-6 h-1 bg-white/30 rounded-full overflow-hidden">
                      <div 
                        className="bg-white rounded-full transition-all duration-300"
                        style={{ width: `${((item.usageCount || 0) / 3) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button className="w-8 h-8 bg-white bg-opacity-90 rounded-full flex items-center justify-center hover:bg-opacity-100">
                  <Heart className={`w-4 h-4 ${item.usageCount > 0 ? 'text-red-500 fill-current' : 'text-gray-600'}`} />
                </button>
              </div>
            </div>
            <div className="mt-2 space-y-1.5">
              <p className="text-sm font-medium text-gray-900 leading-tight break-words item-label">{item.name}</p>
              <div className="flex flex-wrap gap-1 items-center text-xs">
                <span className="tag-badge tag-type bg-gray-100 text-gray-700">
                  {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                </span>
                <span className="tag-badge tag-color bg-blue-50 text-blue-700">
                  {item.color}
                </span>
                {item.material && item.material !== 'unknown' && (
                  <span className="tag-badge tag-material bg-green-50 text-green-700">
                    {item.material}
                  </span>
                )}
                {item.occasion && item.occasion !== 'casual' && (
                  <span className="tag-badge tag-occasion bg-orange-50 text-orange-700">
                    {item.occasion}
                  </span>
                )}
              </div>
              <div className="usage-indicator">
                <p className="text-xs text-gray-400 flex-shrink-0">{item.usageCount}/3 uses</p>
                <div className="flex w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`rounded-full transition-all duration-300 ${
                      (item.usageCount || 0) >= 3 ? 'bg-red-400' : 
                      (item.usageCount || 0) >= 2 ? 'bg-yellow-400' : 'bg-green-400'
                    }`}
                    style={{ width: `${((item.usageCount || 0) / 3) * 100}%` }}
                  />
                </div>
              </div>
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