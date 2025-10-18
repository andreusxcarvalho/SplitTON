import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

export function getInitials(name: string): string {
  const cleaned = name.replace('@', '');
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

export function getColorFromString(str: string): string {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-yellow-500',
    'bg-indigo-500',
    'bg-red-500',
    'bg-teal-500',
  ];
  
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

export function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    "Food & Drinks": "🍽️",
    "Transport": "🚗",
    "Entertainment": "🎬",
    "Shopping": "🛍️",
    "Bills": "📄",
    "Other": "📌",
  };
  return icons[category] || "📌";
}

export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    "Food & Drinks": "hsl(var(--chart-3))",
    "Transport": "hsl(var(--chart-1))",
    "Entertainment": "hsl(var(--chart-4))",
    "Shopping": "hsl(var(--chart-5))",
    "Bills": "hsl(var(--chart-2))",
    "Other": "hsl(var(--muted))",
  };
  return colors[category] || "hsl(var(--muted))";
}
