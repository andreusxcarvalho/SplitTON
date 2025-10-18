import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatCurrency, formatDate, getCategoryIcon, getCategoryColor, getInitials, getColorFromString } from "@/lib/utils";
import type { Expense } from "@shared/schema";
import { cn } from "@/lib/utils";

interface ReceiptCardProps {
  expense: Expense;
  onClick?: () => void;
}

export function ReceiptCard({ expense, onClick }: ReceiptCardProps) {
  const categoryColor = getCategoryColor(expense.category);
  
  return (
    <Card
      className={cn(
        "hover-elevate active-elevate-2 cursor-pointer",
        "border-l-4 transition-all duration-200"
      )}
      style={{ borderLeftColor: categoryColor }}
      onClick={onClick}
      data-testid={`card-expense-${expense.id}`}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="text-3xl" data-testid="text-category-icon">
            {getCategoryIcon(expense.category)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-lg leading-tight" data-testid="text-expense-description">
              {expense.description || expense.category}
            </h3>
            <p className="text-sm text-muted-foreground" data-testid="text-expense-date">
              {formatDate(expense.createdAt)}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold font-mono tabular-nums" data-testid={`text-total-${expense.id}`}>
            {formatCurrency(expense.total)}
          </p>
          <p className="text-xs text-muted-foreground">
            Paid by {expense.payer}
          </p>
        </div>
      </CardHeader>
      
      <CardContent>
        {expense.items && expense.items.length > 0 && (
          <div className="mb-3 space-y-1">
            {expense.items.slice(0, 3).map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-muted-foreground truncate flex-1">{item.name}</span>
                <span className="font-mono tabular-nums ml-2">{formatCurrency(item.price)}</span>
              </div>
            ))}
            {expense.items.length > 3 && (
              <p className="text-xs text-muted-foreground">
                +{expense.items.length - 3} more items
              </p>
            )}
          </div>
        )}
        
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Split with:</span>
          <div className="flex -space-x-2">
            {expense.participants.slice(0, 5).map((participant, idx) => (
              <Avatar key={idx} className={cn("h-7 w-7 border-2 border-card", getColorFromString(participant))}>
                <AvatarFallback className="text-xs text-white">
                  {getInitials(participant)}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          {expense.participants.length > 5 && (
            <Badge variant="secondary" className="h-7">
              +{expense.participants.length - 5}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
