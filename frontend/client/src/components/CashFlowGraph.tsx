import { ArrowRight } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatCurrency, getInitials, getColorFromString } from "@/lib/utils";
import type { CashFlowArrow } from "@shared/schema";
import { cn } from "@/lib/utils";

interface CashFlowGraphProps {
  arrows: CashFlowArrow[];
}

export function CashFlowGraph({ arrows }: CashFlowGraphProps) {
  if (arrows.length === 0) {
    return (
      <div className="text-center py-12" data-testid="empty-cashflow">
        <p className="text-muted-foreground">All settled up! 🎉</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="cashflow-graph">
      {arrows.map((arrow, idx) => (
        <div
          key={idx}
          className="flex items-center gap-4 p-4 rounded-xl bg-card border border-card-border hover-elevate"
          data-testid={`cashflow-arrow-${idx}`}
        >
          <Avatar className={cn("h-12 w-12", getColorFromString(arrow.from))}>
            <AvatarFallback className="text-white font-semibold">
              {getInitials(arrow.from)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 flex items-center gap-2">
            <div className="h-0.5 flex-1 bg-gradient-to-r from-destructive to-chart-2" />
            <ArrowRight className="h-5 w-5 text-destructive" />
          </div>

          <div className="text-center px-3">
            <p className="text-xl font-bold font-mono tabular-nums text-destructive" data-testid={`text-amount-${idx}`}>
              {formatCurrency(arrow.amount)}
            </p>
            <p className="text-xs text-muted-foreground">owes</p>
          </div>

          <div className="flex-1 flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-chart-2" />
            <div className="h-0.5 flex-1 bg-gradient-to-r from-chart-2 to-chart-2" />
          </div>

          <Avatar className={cn("h-12 w-12", getColorFromString(arrow.to))}>
            <AvatarFallback className="text-white font-semibold">
              {getInitials(arrow.to)}
            </AvatarFallback>
          </Avatar>
        </div>
      ))}
    </div>
  );
}
