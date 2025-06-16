import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Grid3X3, Grid2X2, Heart, Trash2, Edit, AlertTriangle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ClothingItem } from "@shared/schema";

const categoryFilters = ['All', 'Tops', 'Bottoms', 'Outerwear', 'Shoes', 'Accessories'];

export function WardrobeGrid() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'large'>('grid');
  const [editingItem, setEditingItem] = useState<ClothingItem | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    type: '',
    color: '',
    material: '',
    pattern: '',
    occasion: ''
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery<ClothingItem[]>({
    queryKey: ["/api/wardrobe"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (itemId: number) => {
      const response = await apiRequest('DELETE', `/api/clothing/${itemId}`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Item Deleted",
        description: `${data.deletedItem.name} has been removed from your wardrobe.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/wardrobe"] });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete item",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ itemId, updates }: { itemId: number; updates: any }) => {
      const response = await apiRequest('PUT', `/api/clothing/${itemId}`, updates);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Item Updated",
        description: `${data.item.name} has been updated successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/wardrobe"] });
      setEditingItem(null);
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update item",
        variant: "destructive",
      });
    },
  });

  const handleDelete = async (item: ClothingItem) => {
    if (window.confirm(`Are you sure you want to delete "${item.name}"? This action cannot be undone.`)) {
      deleteMutation.mutate(item.id);
    }
  };

  const handleEdit = (item: ClothingItem) => {
    setEditingItem(item);
    setEditForm({
      name: item.name,
      type: item.type,
      color: item.color,
      material: item.material || '',
      pattern: item.pattern || '',
      occasion: item.occasion || ''
    });
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    
    updateMutation.mutate({
      itemId: editingItem.id,
      updates: editForm
    });
  };

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

              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col gap-1">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(item);
                  }}
                  className="w-8 h-8 bg-blue-500 bg-opacity-90 rounded-full flex items-center justify-center hover:bg-opacity-100 text-white"
                  title="Edit item details"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(item);
                  }}
                  className="w-8 h-8 bg-red-500 bg-opacity-90 rounded-full flex items-center justify-center hover:bg-opacity-100 text-white"
                  title="Delete item"
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
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

      {/* Edit Item Dialog */}
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Correct AI Analysis
            </DialogTitle>
          </DialogHeader>
          
          {editingItem && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                  <img
                    src={editingItem.imageUrl}
                    alt={editingItem.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-600 mb-2">
                    The AI analyzed this item. Please correct any mistakes:
                  </p>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="edit-name">Item Name</Label>
                      <Input
                        id="edit-name"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        placeholder="e.g., Blue Cotton T-Shirt"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="edit-type">Type</Label>
                        <Select value={editForm.type} onValueChange={(value) => setEditForm({ ...editForm, type: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="top">Top</SelectItem>
                            <SelectItem value="bottom">Bottom</SelectItem>
                            <SelectItem value="outerwear">Outerwear</SelectItem>
                            <SelectItem value="shoes">Shoes</SelectItem>
                            <SelectItem value="accessories">Accessories</SelectItem>
                            <SelectItem value="socks">Socks</SelectItem>
                            <SelectItem value="underwear">Underwear</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="edit-color">Color</Label>
                        <Input
                          id="edit-color"
                          value={editForm.color}
                          onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                          placeholder="e.g., navy blue"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="edit-material">Material</Label>
                        <Input
                          id="edit-material"
                          value={editForm.material}
                          onChange={(e) => setEditForm({ ...editForm, material: e.target.value })}
                          placeholder="e.g., cotton, wool"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="edit-pattern">Pattern</Label>
                        <Input
                          id="edit-pattern"
                          value={editForm.pattern}
                          onChange={(e) => setEditForm({ ...editForm, pattern: e.target.value })}
                          placeholder="e.g., solid, striped"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="edit-occasion">Occasion</Label>
                      <Select value={editForm.occasion} onValueChange={(value) => setEditForm({ ...editForm, occasion: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select occasion" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="casual">Casual</SelectItem>
                          <SelectItem value="formal">Formal</SelectItem>
                          <SelectItem value="business">Business</SelectItem>
                          <SelectItem value="athletic">Athletic</SelectItem>
                          <SelectItem value="party">Party</SelectItem>
                          <SelectItem value="smart-casual">Smart Casual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setEditingItem(null)}
                  disabled={updateMutation.isPending}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSaveEdit}
                  disabled={updateMutation.isPending || !editForm.name.trim()}
                >
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}