import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

const client = postgres(process.env.DATABASE_URL);
export const db = drizzle(client, { schema });

// Initialize database tables
async function initializeDatabase() {
  try {
    // Run database migrations to ensure tables exist
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        age INTEGER NOT NULL,
        height INTEGER NOT NULL,
        body_type TEXT NOT NULL,
        skin_tone TEXT NOT NULL,
        gender TEXT NOT NULL
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS clothing_items (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        color TEXT NOT NULL,
        image_url TEXT NOT NULL,
        image_hash TEXT,
        demographic TEXT,
        material TEXT,
        pattern TEXT,
        occasion TEXT,
        usage_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS outfits (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        occasion TEXT NOT NULL,
        item_ids INTEGER[] NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Ensure demo user exists
    const demoUser = await db.execute(`
      INSERT INTO users (username, password, name, age, height, body_type, skin_tone, gender)
      VALUES ('demo', 'demo123', 'Demo User', 25, 170, 'average', 'medium', 'female')
      ON CONFLICT (username) DO NOTHING
    `);

    console.log("Database tables initialized successfully");
  } catch (error) {
    console.error("Error initializing database:", error);
  }
}

// Initialize database on startup
initializeDatabase();