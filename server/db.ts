import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "@shared/schema";

const client = createClient({
  url: "file:./local.db",
});

export const db = drizzle(client, { schema });

// Initialize database tables
async function initializeDatabase() {
  try {
    // Create tables if they don't exist
    await db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS clothing_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        color TEXT NOT NULL,
        material TEXT,
        pattern TEXT,
        occasion TEXT,
        image_url TEXT,
        image_hash TEXT,
        usage_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS outfits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        occasion TEXT,
        season TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    await db.run(`
      CREATE TABLE IF NOT EXISTS outfit_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        outfit_id INTEGER NOT NULL,
        clothing_item_id INTEGER NOT NULL,
        FOREIGN KEY (outfit_id) REFERENCES outfits(id),
        FOREIGN KEY (clothing_item_id) REFERENCES clothing_items(id)
      )
    `);

    console.log("Database tables initialized successfully");
  } catch (error) {
    console.error("Error initializing database:", error);
  }
}

// Initialize database on startup
initializeDatabase();