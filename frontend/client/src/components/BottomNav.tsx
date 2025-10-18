import { Receipt, Coins, BarChart3 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const [location] = useLocation();

  const navItems = [
    { path: "/transactions", icon: Receipt, label: "Transactions" },
    { path: "/settle", icon: Coins, label: "Settle" },
    { path: "/analytics", icon: BarChart3, label: "Stats" },
  ];

  // Hide bottom nav on auth page
  if (location === "/") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-card-border">
      <div className="max-w-2xl mx-auto px-2 py-2">
        <div className="flex items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;

            return (
              <Link key={item.path} href={item.path}>
                <button
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-colors",
                    "hover-elevate active-elevate-2",
                    isActive && "text-primary"
                  )}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{item.label}</span>
                  {isActive && (
                    <div className="absolute -top-1 w-1 h-1 rounded-full bg-primary" />
                  )}
                </button>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
