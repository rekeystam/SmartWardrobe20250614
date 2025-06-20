import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  age: integer("age").notNull(),
  height: integer("height").notNull(), // in cm
  bodyType: text("body_type").notNull(),
  skinTone: text("skin_tone").notNull(),
  gender: text("gender").notNull(),
});

export const clothingItems = pgTable("clothing_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // top, bottom, outerwear, shoes, accessories
  color: text("color").notNull(),
  imageUrl: text("image_url").notNull(),
  imageHash: text("image_hash"),
  demographic: text("demographic"), // men, women, unisex, kids
  material: text("material"), // cotton, denim, leather, wool, etc.
  pattern: text("pattern"), // solid, striped, checkered, etc.
  occasion: text("occasion"), // casual, formal, business, sporty, party
  usageCount: integer("usage_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const outfits = pgTable("outfits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  occasion: text("occasion").notNull(),
  itemIds: integer("item_ids").array().notNull(), // array of clothing item IDs
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

export const insertClothingItemSchema = createInsertSchema(clothingItems).omit({
  id: true,
  createdAt: true,
});

export const insertOutfitSchema = createInsertSchema(outfits).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertClothingItem = z.infer<typeof insertClothingItemSchema>;
export type ClothingItem = typeof clothingItems.$inferSelect;
export type InsertOutfit = z.infer<typeof insertOutfitSchema>;
export type Outfit = typeof outfits.$inferSelect;

export const clothingTypes = [
  "top",
  "bottom",
  "outerwear",
  "shoes",
  "accessories",
  "socks",
  "underwear",
] as const;

export const occasions = [
  "casual",
  "smart-casual",
  "formal",
  "party",
  "business",
  "athletic",
] as const;

// Storage interface
export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(insertUser: InsertUser): Promise<User>;

  // Clothing item operations
  getClothingItem(id: number): Promise<ClothingItem | undefined>;
  getClothingItemsByUser(userId: number): Promise<ClothingItem[]>;
  getClothingItemsByType(userId: number, type: string): Promise<ClothingItem[]>;
  createClothingItem(insertItem: InsertClothingItem): Promise<ClothingItem>;
  updateClothingItemUsage(id: number, usageCount: number): Promise<void>;
  getClothingItemByHash(userId: number, hash: string): Promise<ClothingItem | undefined>;
  deleteClothingItem(id: number): Promise<void>;
  updateClothingItem(id: number, updates: Partial<Omit<ClothingItem, 'id' | 'userId' | 'imageUrl' | 'imageHash' | 'createdAt'>>): Promise<ClothingItem>;

  // Outfit operations
  getOutfit(id: number): Promise<Outfit | undefined>;
  getOutfitsByUser(userId: number): Promise<Outfit[]>;
  createOutfit(insertOutfit: InsertOutfit): Promise<Outfit>;
  deleteOutfit(id: number): Promise<void>;
  updateOutfit(id: number, updates: Partial<Omit<Outfit, 'id' | 'userId' | 'createdAt'>>): Promise<Outfit>;
}