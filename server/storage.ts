import { 
  users,
  clothingItems,
  outfits,
  type IStorage, 
  type User, 
  type InsertUser, 
  type ClothingItem, 
  type InsertClothingItem,
  type Outfit,
  type InsertOutfit
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

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

    // Create demo user - Female profile
    const demoUser: User = {
      id: 1,
      username: "demo",
      password: "demo", 
      name: "Emma",
      age: 25,
      height: 165,
      bodyType: "apple",
      skinTone: "fair",
      gender: "female"
    };
    this.users.set(1, demoUser);
    this.currentUserId = 2;
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
      itemIds: insertOutfit.itemIds.map(itemId => 
        typeof itemId === 'string' ? parseInt(itemId, 10) : itemId
      ),
      createdAt: new Date()
    };
    this.outfits.set(id, outfit);
    return outfit;
  }

  async deleteOutfit(id: number): Promise<void> {
    this.outfits.delete(id);
  }

  async updateOutfit(id: number, updates: Partial<Omit<Outfit, 'id' | 'userId' | 'createdAt'>>): Promise<Outfit> {
    const outfit = this.outfits.get(id);
    if (!outfit) {
      throw new Error("Outfit not found");
    }

    const updatedOutfit = { ...outfit, ...updates };
    this.outfits.set(id, updatedOutfit);
    return updatedOutfit;
  }
}

// Database Storage Implementation
export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getClothingItem(id: number): Promise<ClothingItem | undefined> {
    const [item] = await db.select().from(clothingItems).where(eq(clothingItems.id, id));
    return item || undefined;
  }

  async getClothingItemsByUser(userId: number): Promise<ClothingItem[]> {
    return await db.select().from(clothingItems).where(eq(clothingItems.userId, userId));
  }

  async getClothingItemsByType(userId: number, type: string): Promise<ClothingItem[]> {
    return await db.select().from(clothingItems)
      .where(and(eq(clothingItems.userId, userId), eq(clothingItems.type, type)));
  }

  async createClothingItem(insertItem: InsertClothingItem): Promise<ClothingItem> {
    const [item] = await db
      .insert(clothingItems)
      .values(insertItem)
      .returning();
    return item;
  }

  async updateClothingItemUsage(id: number, usageCount: number): Promise<void> {
    await db
      .update(clothingItems)
      .set({ usageCount })
      .where(eq(clothingItems.id, id));
  }

  async getClothingItemByHash(userId: number, hash: string): Promise<ClothingItem | undefined> {
    const items = await db.select().from(clothingItems)
      .where(and(eq(clothingItems.userId, userId), eq(clothingItems.imageHash, hash)));
    return items[0] || undefined;
  }

  async deleteClothingItem(id: number): Promise<void> {
    await db.delete(clothingItems).where(eq(clothingItems.id, id));
  }

  async updateClothingItem(id: number, updates: Partial<Omit<ClothingItem, 'id' | 'userId' | 'imageUrl' | 'imageHash' | 'createdAt'>>): Promise<ClothingItem> {
    const [item] = await db
      .update(clothingItems)
      .set(updates)
      .where(eq(clothingItems.id, id))
      .returning();
    return item;
  }

  async getOutfit(id: number): Promise<Outfit | undefined> {
    const [outfit] = await db.select().from(outfits).where(eq(outfits.id, id));
    return outfit || undefined;
  }

  async getOutfitsByUser(userId: number): Promise<Outfit[]> {
    return await db.select().from(outfits).where(eq(outfits.userId, userId));
  }

  async createOutfit(insertOutfit: InsertOutfit): Promise<Outfit> {
    const [outfit] = await db
      .insert(outfits)
      .values(insertOutfit)
      .returning();
    return outfit;
  }

  async deleteOutfit(id: number): Promise<void> {
    await db.delete(outfits).where(eq(outfits.id, id));
  }

  async updateOutfit(id: number, updates: Partial<Omit<Outfit, 'id' | 'userId' | 'createdAt'>>): Promise<Outfit> {
    const [outfit] = await db
      .update(outfits)
      .set(updates)
      .where(eq(outfits.id, id))
      .returning();
    return outfit;
  }
}

export const storage = new DatabaseStorage();