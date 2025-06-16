import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Ruler, Dumbbell, Palette } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { User as UserType } from "@shared/schema";

export function ProfileCard() {
  const { data: user, isLoading } = useQuery<UserType>({
    queryKey: ["/api/profile"],
  });

  if (isLoading) {
    return (
      <Card className="p-6 mb-8">
        <div className="animate-pulse">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gray-200 rounded-full"></div>
            <div className="space-y-2">
              <div className="h-6 bg-gray-200 rounded w-32"></div>
              <div className="h-4 bg-gray-200 rounded w-48"></div>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <Card className="p-6 mb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-100 to-amber-200 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-amber-700" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Profile Summary</h2>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
              <span className="flex items-center">
                <User className="w-4 h-4 text-blue-500 mr-1" />
                {user.gender.charAt(0).toUpperCase() + user.gender.slice(1)}, {user.age} years
              </span>
              <span className="flex items-center">
                <Ruler className="w-4 h-4 text-green-500 mr-1" />
                {user.height}cm
              </span>
              <span className="flex items-center">
                <Dumbbell className="w-4 h-4 text-purple-500 mr-1" />
                {user.bodyType.charAt(0).toUpperCase() + user.bodyType.slice(1)}
              </span>
              <span className="flex items-center">
                <Palette className="w-4 h-4 text-orange-500 mr-1" />
                {user.skinTone.charAt(0).toUpperCase() + user.skinTone.slice(1)} skin
              </span>
            </div>
          </div>
        </div>
        <Button variant="outline" className="text-gray-700">
          Edit Profile
        </Button>
      </div>
    </Card>
  );
}
