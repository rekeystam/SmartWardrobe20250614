import { pgTable, text, serial, integer, boolean, real, timestamp } from "drizzle-orm/pg-core";
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
  type: text("type").notNull(), // top, bottom, outerwear, shoes, accessories, etc.
  color: text("color").notNull(),
  imageUrl: text("image_url").notNull(),
  imageHash: text("image_hash").notNull(), // perceptual hash for duplicate detection
  usageCount: integer("usage_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const outfits = pgTable("outfits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  occasion: text("occasion").notNull(),
  temperature: real("temperature").notNull(),
  timeOfDay: text("time_of_day").notNull(),
  season: text("season").notNull(),
  itemIds: text("item_ids").array().notNull(), // array of clothing item IDs
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

export const insertClothingItemSchema = createInsertSchema(clothingItems).omit({
  id: true,
  createdAt: true,
}).extend({
  usageCount: z.number().default(0),
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
  'top', 'bottom', 'outerwear', 'shoes', 'accessories', 'socks', 'underwear'
] as const;

export const occasions = [
  'casual', 'smart-casual', 'formal', 'party', 'business', 'athletic'
] as const;

export const seasons = ['spring', 'summer', 'fall', 'winter'] as const;
export const timesOfDay = ['morning', 'afternoon', 'evening', 'night'] as const;
