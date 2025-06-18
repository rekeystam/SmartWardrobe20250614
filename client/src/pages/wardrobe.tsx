import { ProfileCard } from "@/components/profile-card";
import { UnifiedUpload } from "@/components/unified-upload";
import { WardrobeGrid } from "@/components/wardrobe-grid";
import { OutfitGenerator } from "@/components/outfit-generator";
import { TagBasedOutfit } from "@/components/tag-based-outfit";

export default function Wardrobe() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                  </svg>
                </div>
                <span className="ml-2 text-xl font-bold text-gray-900">StyleAI</span>
              </div>
              <nav className="hidden md:block ml-10">
                <div className="flex space-x-8">
                  <a href="#" className="text-primary border-b-2 border-primary px-1 pb-4 text-sm font-medium">
                    My Wardrobe
                  </a>
                  <a href="#" className="text-gray-500 hover:text-gray-700 px-1 pb-4 text-sm font-medium">
                    Outfits
                  </a>
                  <a href="#" className="text-gray-500 hover:text-gray-700 px-1 pb-4 text-sm font-medium">
                    Style Guide
                  </a>
                </div>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                Hello, <span className="font-medium">Michael</span>
              </span>
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">M</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ProfileCard />
        <UnifiedUpload />
        <OutfitGenerator />
        <TagBasedOutfit />
        <WardrobeGrid />
      </main>
    </div>
  );
}