import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/utils";

interface CategoryChartProps {
  data: { name: string; value: number; color: string }[];
}

export function CategoryChart({ data }: CategoryChartProps) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12" data-testid="empty-categories">
        <p className="text-muted-foreground">No expenses yet</p>
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="w-full" data-testid="category-chart">
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--card-border))',
              borderRadius: '0.5rem',
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="mt-6 space-y-2">
        {data.map((category, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
            data-testid={`category-item-${idx}`}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-sm"
                style={{ backgroundColor: category.color }}
              />
              <span className="font-medium">{category.name}</span>
            </div>
            <div className="text-right">
              <p className="font-mono font-semibold tabular-nums">{formatCurrency(category.value)}</p>
              <p className="text-xs text-muted-foreground">
                {((category.value / total) * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
