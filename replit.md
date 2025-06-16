# StyleAI Wardrobe Manager

## Overview

StyleAI is a modern web application that helps users organize their wardrobe and generate outfit suggestions using AI. The application allows users to upload photos of clothing items, automatically categorize them, and receive personalized outfit recommendations based on weather, occasion, and personal preferences.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack Query (React Query) for server state management
- **UI Components**: Radix UI primitives with custom Tailwind CSS styling (shadcn/ui)
- **Styling**: Tailwind CSS with CSS variables for theming
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Style**: RESTful JSON API
- **File Upload**: Multer for multipart form handling
- **Image Processing**: Sharp for image manipulation and hash generation
- **Development**: tsx for TypeScript execution in development

### Data Storage Solutions
- **Database**: PostgreSQL with Drizzle ORM
- **Connection**: Neon Database serverless PostgreSQL
- **Schema Management**: Drizzle Kit for migrations
- **Development Storage**: In-memory storage implementation for development/testing

## Key Components

### Database Schema
- **Users**: Profile information including physical characteristics (height, body type, skin tone, gender)
- **Clothing Items**: Individual pieces with metadata (type, color, usage count, perceptual hash for duplicates)
- **Outfits**: Saved outfit combinations with contextual information (occasion, weather, season)

### AI-Powered Features
- **Image Analysis**: Automatic clothing type and color detection from uploaded photos
- **Duplicate Detection**: Perceptual hashing to prevent duplicate clothing items
- **Outfit Generation**: Smart algorithm considering weather, occasion, and usage patterns
- **Style Recommendations**: Context-aware outfit suggestions

### User Interface Components
- **Upload Zone**: Drag-and-drop interface for bulk clothing uploads
- **Wardrobe Grid**: Visual organization of clothing items with filtering
- **Profile Card**: User characteristics display and management
- **Outfit Generator**: Interactive tool for creating outfit suggestions

## Data Flow

1. **Image Upload**: Users drag/drop clothing photos → Multer processes files → Sharp generates perceptual hashes
2. **AI Analysis**: Images are analyzed (mock implementation) to determine type, color, and name
3. **Storage**: Processed items are stored with metadata and duplicate checking
4. **Outfit Generation**: Algorithm considers user profile, weather, occasion, and item usage to suggest outfits
5. **Real-time Updates**: React Query manages cache invalidation and optimistic updates

## External Dependencies

### Core Technologies
- **Database**: Neon PostgreSQL (serverless)
- **Image Processing**: Sharp library for server-side image manipulation
- **UI Framework**: Radix UI for accessible component primitives
- **Styling**: Tailwind CSS for utility-first styling

### Development Tools
- **Build**: Vite with React plugin and TypeScript support
- **Database**: Drizzle ORM with PostgreSQL dialect
- **Deployment**: Replit with auto-scaling configuration

## Deployment Strategy

### Environment Configuration
- **Development**: `npm run dev` - tsx server with Vite middleware
- **Production**: `npm run build && npm run start` - optimized Vite build with esbuild server bundle
- **Database**: Drizzle migrations with `npm run db:push`

### Platform Setup
- **Replit Configuration**: Node.js 20, PostgreSQL 16, web modules
- **Port Configuration**: Local 5000 → External 80
- **Build Process**: Vite frontend build + esbuild server bundle
- **Auto-scaling**: Configured for dynamic resource allocation

### File Structure
```
├── client/          # React frontend application
├── server/          # Express.js backend API
├── shared/          # Shared TypeScript types and schemas
├── migrations/      # Database migration files
└── dist/           # Production build output
```

## Recent Changes

**June 16, 2025 - Migration and AI Enhancement Complete**
- ✓ Successfully migrated from Replit Agent to standard Replit environment
- ✓ Enhanced duplicate detection with pre-upload perceptual hash comparison (85% threshold)
- ✓ Improved AI classification accuracy with detailed Gemini prompts for shorts vs blazers
- ✓ Implemented resource-efficient duplicate prevention before AI analysis
- ✓ Fixed all TypeScript compilation errors and server stability issues
- ✓ Integrated robust rate limit handling with deterministic fallback system

**June 14, 2025 - Full Implementation Complete**
- ✓ Built complete AI wardrobe assistant with all requested features
- ✓ Implemented robust duplicate detection using perceptual image hashing
- ✓ Created deterministic AI analysis system (ready for real API integration)
- ✓ Added comprehensive outfit generation with personalized rules
- ✓ Deployed responsive UI with drag-and-drop upload functionality
- ✓ Validated all core features: upload, analysis, duplicate prevention, outfit suggestions

## Changelog

- June 14, 2025. Initial setup and full feature implementation

## User Preferences

Preferred communication style: Simple, everyday language.