import { 
  users, 
  clothingItems, 
  outfits,
  type User, 
  type InsertUser,
  type ClothingItem,
  type InsertClothingItem,
  type Outfit,
  type InsertOutfit
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Clothing Items
  getClothingItem(id: number): Promise<ClothingItem | undefined>;
  getClothingItemsByUser(userId: number): Promise<ClothingItem[]>;
  getClothingItemsByType(userId: number, type: string): Promise<ClothingItem[]>;
  createClothingItem(item: InsertClothingItem): Promise<ClothingItem>;
  updateClothingItemUsage(id: number, usageCount: number): Promise<void>;
  getClothingItemByHash(userId: number, hash: string): Promise<ClothingItem | undefined>;
  deleteClothingItem(id: number): Promise<void>;
  updateClothingItem(id: number, updates: Partial<Omit<ClothingItem, 'id' | 'userId' | 'imageUrl' | 'imageHash' | 'createdAt'>>): Promise<ClothingItem>;
  
  // Outfits
  getOutfit(id: number): Promise<Outfit | undefined>;
  getOutfitsByUser(userId: number): Promise<Outfit[]>;
  createOutfit(outfit: InsertOutfit): Promise<Outfit>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private clothingItems: Map<number, ClothingItem>;
  private outfits: Map<number, Outfit>;
  private currentUserId: number;
  private currentClothingItemId: number;
  private currentOutfitId: number;

  constructor() {
    this.users = new Map();
    this.clothingItems = new Map();
    this.outfits = new Map();
    this.currentUserId = 1;
    this.currentClothingItemId = 1;
    this.currentOutfitId = 1;

    // Create demo user
    const demoUser: User = {
      id: 1,
      username: "demo",
      password: "demo",
      name: "Michael",
      age: 40,
      height: 177,
      bodyType: "athletic",
      skinTone: "burant tan",
      gender: "male"
    };
    this.users.set(1, demoUser);
    this.currentUserId = 2;

    // Add some sample clothing items for the demo user
    this.addSampleClothingItems();
  }

  private addSampleClothingItems() {
    const sampleItems: Omit<ClothingItem, 'id'>[] = [
      {
        userId: 1,
        name: "Navy Cotton T-Shirt",
        type: "top",
        color: "navy blue",
        imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=400",
        imageHash: "hash_navy_tshirt",
        demographic: "men",
        material: "cotton",
        pattern: "solid",
        occasion: "casual",
        usageCount: 2,
        createdAt: new Date()
      },
      {
        userId: 1,
        name: "Dark Blue Denim Jeans",
        type: "bottom",
        color: "dark blue",
        imageUrl: "https://images.unsplash.com/photo-1542272604-787c3835535d?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=400",
        imageHash: "hash_dark_jeans",
        demographic: "unisex",
        material: "denim",
        pattern: "solid",
        occasion: "casual",
        usageCount: 1,
        createdAt: new Date()
      },
      {
        userId: 1,
        name: "Black Leather Jacket",
        type: "outerwear",
        color: "black",
        imageUrl: "https://images.unsplash.com/photo-1551028719-00167b16eac5?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=400",
        imageHash: "hash_black_jacket",
        demographic: "unisex",
        material: "leather",
        pattern: "solid",
        occasion: "casual",
        usageCount: 0,
        createdAt: new Date()
      },
      {
        userId: 1,
        name: "White Button-Down Shirt",
        type: "top",
        color: "white",
        imageUrl: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=400",
        imageHash: "hash_white_shirt",
        demographic: "men",
        material: "cotton",
        pattern: "solid",
        occasion: "business",
        usageCount: 3,
        createdAt: new Date()
      },
      {
        userId: 1,
        name: "Brown Leather Boots",
        type: "shoes",
        color: "brown",
        imageUrl: "https://images.unsplash.com/photo-1549298916-b41d501d3772?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=400",
        imageHash: "hash_brown_boots",
        demographic: "unisex",
        material: "leather",
        pattern: "solid",
        occasion: "casual",
        usageCount: 1,
        createdAt: new Date()
      },
      {
        userId: 1,
        name: "Gray Wool Sweater",
        type: "top",
        color: "gray",
        imageUrl: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=400",
        imageHash: "hash_gray_sweater",
        demographic: "unisex",
        material: "wool",
        pattern: "solid",
        occasion: "casual",
        usageCount: 2,
        createdAt: new Date()
      }
    ];

    sampleItems.forEach(item => {
      const newItem: ClothingItem = { ...item, id: this.currentClothingItemId++ };
      this.clothingItems.set(newItem.id, newItem);
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getClothingItem(id: number): Promise<ClothingItem | undefined> {
    return this.clothingItems.get(id);
  }

  async getClothingItemsByUser(userId: number): Promise<ClothingItem[]> {
    return Array.from(this.clothingItems.values()).filter(
      (item) => item.userId === userId,
    );
  }

  async getClothingItemsByType(userId: number, type: string): Promise<ClothingItem[]> {
    return Array.from(this.clothingItems.values()).filter(
      (item) => item.userId === userId && item.type === type,
    );
  }

  async createClothingItem(insertItem: InsertClothingItem): Promise<ClothingItem> {
    const id = this.currentClothingItemId++;
    const item: ClothingItem = { 
      ...insertItem, 
      id,
      usageCount: insertItem.usageCount ?? 0,
      createdAt: new Date()
    };
    this.clothingItems.set(id, item);
    return item;
  }

  async updateClothingItemUsage(id: number, usageCount: number): Promise<void> {
    const item = this.clothingItems.get(id);
    if (item) {
      item.usageCount = usageCount;
      this.clothingItems.set(id, item);
    }
  }

  async getClothingItemByHash(userId: number, hash: string): Promise<ClothingItem | undefined> {
    return Array.from(this.clothingItems.values()).find(
      (item) => item.userId === userId && item.imageHash === hash,
    );
  }

  async deleteClothingItem(id: number): Promise<void> {
    this.clothingItems.delete(id);
  }

  async updateClothingItem(id: number, updates: Partial<Omit<ClothingItem, 'id' | 'userId' | 'imageUrl' | 'imageHash' | 'createdAt'>>): Promise<ClothingItem> {
    const item = this.clothingItems.get(id);
    if (!item) {
      throw new Error("Item not found");
    }

    const updatedItem = { ...item, ...updates };
    this.clothingItems.set(id, updatedItem);
    return updatedItem;
  }

  async getOutfit(id: number): Promise<Outfit | undefined> {
    return this.outfits.get(id);
  }

  async getOutfitsByUser(userId: number): Promise<Outfit[]> {
    return Array.from(this.outfits.values()).filter(
      (outfit) => outfit.userId === userId,
    );
  }

  async createOutfit(insertOutfit: InsertOutfit): Promise<Outfit> {
    const id = this.currentOutfitId++;
    const outfit: Outfit = { 
      ...insertOutfit, 
      id,
      createdAt: new Date()
    };
    this.outfits.set(id, outfit);
    return outfit;
  }
}

export const storage = new MemStorage();
