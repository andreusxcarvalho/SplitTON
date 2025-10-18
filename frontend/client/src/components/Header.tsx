import { User } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export function Header() {
  const [location] = useLocation();

  // Hide header on auth page
  if (location === "/") return null;

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-card-border">
      <div className="max-w-2xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex-1" />
          
          <Link href="/profile">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              data-testid="button-profile"
            >
              <User className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
