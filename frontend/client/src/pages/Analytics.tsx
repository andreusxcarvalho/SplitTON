import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryChart } from "@/components/CategoryChart";
import { formatCurrency, getCategoryIcon } from "@/lib/utils";
import { apiRequest as herokuApiRequest, getCurrentUserId } from "@/lib/api";

type TimeFilter = "week" | "month" | "year";

interface CategoryBreakdown {
  [category: string]: number;
}

export default function Analytics() {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("month");
  const userId = getCurrentUserId();

  const { data: statsData, isLoading } = useQuery<CategoryBreakdown>({
    queryKey: ["stats", userId],
    queryFn: async () => {
      if (!userId) return {};
      return await herokuApiRequest<CategoryBreakdown>("GET", `/stats/${userId}`);
    },
    enabled: !!userId,
    refetchOnWindowFocus: true,  // Auto-refresh when Mini App reopens
    staleTime: 30000,  // Consider data fresh for 30 seconds
  });

  // Convert server data to chart format for CategoryChart
  const CATEGORY_COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ];
  
  const categoryData = Object.entries(statsData || {}).map(([category, amount], idx) => ({
    name: category,
    value: amount,
    color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
  }));

  const totalSpent = Object.values(statsData || {}).reduce((sum, amount) => sum + amount, 0);
  const averageExpense = categoryData.length > 0 ? totalSpent / categoryData.length : 0;

  // Mock trend data
  const trend = 12; // 12% increase

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3" data-testid="text-page-title">
            <TrendingUp className="h-8 w-8 text-primary" />
            Analytics
          </h1>
          <p className="text-muted-foreground">Track your spending patterns</p>
        </div>

        {/* Time Filter */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium mr-2">Period:</span>
              <div className="flex gap-2 flex-1">
                {(["week", "month", "year"] as TimeFilter[]).map((filter) => (
                  <Button
                    key={filter}
                    variant={timeFilter === filter ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTimeFilter(filter)}
                    className="flex-1"
                    data-testid={`button-filter-${filter}`}
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Spent Card */}
        <Card className="bg-gradient-to-br from-primary/10 to-chart-1/10 border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">Total Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-5xl font-bold font-mono tabular-nums mb-2" data-testid="text-total-spent">
              {formatCurrency(totalSpent)}
            </p>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-chart-2" />
              <span className="text-sm text-chart-2 font-semibold">
                +{trend}% from last {timeFilter}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Average Expense</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-mono tabular-nums" data-testid="text-avg-expense">
                {formatCurrency(averageExpense)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-mono tabular-nums" data-testid="text-expense-count">
                {categoryData.length || 0}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
            <p className="text-sm text-muted-foreground">
              See where your money goes
            </p>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <CategoryChart data={categoryData} />
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📊</div>
                <h3 className="text-xl font-semibold mb-2">No data yet</h3>
                <p className="text-muted-foreground">
                  Add some expenses to see your spending breakdown
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Categories */}
        {categoryData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Top Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {categoryData.slice(0, 5).map((category, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-lg hover-elevate"
                    data-testid={`top-category-${idx}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{getCategoryIcon(category.name)}</div>
                      <div>
                        <p className="font-semibold">{category.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {((category.value / totalSpent) * 100).toFixed(1)}% of total
                        </p>
                      </div>
                    </div>
                    <p className="text-xl font-bold font-mono tabular-nums" data-testid={`text-category-amount-${idx}`}>
                      {formatCurrency(category.value)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
