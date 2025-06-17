from typing import List, Optional, Tuple

def merge_code(original: str, changes: List[Tuple[str, str, str]]) -> str:
    """Merges the original code with the changes provided.

    Args:
        original: The original code as a string.
        changes: A list of tuples, where each tuple contains:
            - old_str: The string to be replaced.
            - new_str: The string to replace with.

    Returns:
        The merged code as a string.
    """

    merged_code = original
    for old_str, new_str, _ in changes:
        merged_code = merged_code.replace(old_str, new_str)
    return merged_code

original = """
import type { 
  IStorage, 
  User, 
  InsertUser, 
  ClothingItem, 
  InsertClothingItem, 
  Outfit, 
  InsertOutfit 
} from "@shared/schema";

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
      createdAt: new Date()
    };
    this.outfits.set(id, outfit);
    return outfit;
  }
}

export const storage = new MemStorage();
"""

changes = [
    (
        """async updateClothingItem(id: number, updates: Partial<Omit<ClothingItem, 'id' | 'userId' | 'imageUrl' | 'imageHash' | 'createdAt'>>): Promise<ClothingItem> {
    const item = this.clothingItems.get(id);
    if (!item) {
      throw new Error("Item not found");
    }

    const updatedItem = { ...item, ...updates };
    this.clothingItems.set(id, updatedItem);
    return updatedItem;
  }""",
        """async updateClothingItem(id: number, updates: Partial<Omit<ClothingItem, 'id' | 'userId' | 'imageUrl' | 'imageHash' | 'createdAt'>>): Promise<ClothingItem> {
    const item = this.clothingItems.get(id);
    if (!item) {
      throw new Error("Item not found");
    }

    const updatedItem = { ...item, ...updates };
    this.clothingItems.set(id, updatedItem);
    return updatedItem;
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
  }""",
        "Add outfit storage methods",
    ),
    (
        """async updateClothingItem(id: number, updates: Partial<Omit<ClothingItem, 'id' | 'userId' | 'imageUrl' | 'imageHash' | 'createdAt'>>): Promise<ClothingItem> {
    const item = this.clothingItems.get(id);
    if (!item) {
      throw new Error("Item not found");
    }

    const updatedItem = { ...item, ...updates };
    this.clothingItems.set(id, updatedItem);
    return updatedItem;
  }""",
        """async updateClothingItem(id: number, updates: Partial<Omit<ClothingItem, 'id' | 'userId' | 'imageUrl' | 'imageHash' | 'createdAt'>>): Promise<ClothingItem> {
    const item = this.clothingItems.get(id);
    if (!item) {
      throw new Error("Item not found");
    }

    const updatedItem = { ...item, ...updates };
    this.clothingItems.set(id, updatedItem);
    return updatedItem;
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
  }""",
        "Add outfit storage methods",
    ),
    (
        """import type { 
  IStorage, 
  User, 
  InsertUser, 
  ClothingItem, 
  InsertClothingItem, 
  Outfit, 
  InsertOutfit 
} from "@shared/schema";""",
        """import type { 
  IStorage, 
  User, 
  InsertUser, 
  ClothingItem, 
  InsertClothingItem,
  Outfit,
  InsertOutfit
} from "@shared/schema";""",
        "Add missing import for outfits and desc",
    ),
]

merged_code = merge_code(original, changes)

```

```tool_code
print(merged_code)
`