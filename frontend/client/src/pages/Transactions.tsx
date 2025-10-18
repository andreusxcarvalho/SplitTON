import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Receipt, Image, Mic, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, getInitials, getColorFromString, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Split, Expense } from "@shared/schema";

// For demo purposes - in real app, get this from auth context
const CURRENT_USER = "You";

interface SettledDebtWithExpense extends Split {
  expense: Expense;
}

export default function Transactions() {
  const { data: splits } = useQuery<Split[]>({
    queryKey: ["/api/splits"],
  });

  const { data: expenses } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  // Join splits with expenses - only show SETTLED debts
  const settledDebtsWithExpenses: SettledDebtWithExpense[] = (splits || [])
    .map((split) => ({
      ...split,
      expense: expenses?.find((e) => e.id === split.expenseId)!,
    }))
    .filter((d) => d.expense && d.settled === d.amount) // Only fully settled debts
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const renderSettledDebtCard = (debt: SettledDebtWithExpense) => {
    const hasImage = !!debt.expense.imageUrl;
    const youPaid = debt.from === CURRENT_USER;
    const otherPerson = youPaid ? debt.to : debt.from;

    return (
      <Card key={debt.id} className="hover-elevate" data-testid={`transaction-card-${debt.id}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <Avatar className={cn("h-12 w-12 mt-1", getColorFromString(otherPerson))}>
                <AvatarFallback className="text-white font-semibold">
                  {getInitials(otherPerson)}
                </AvatarFallback>
              </Avatar>
              
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold truncate">
                    {youPaid ? `You paid ${otherPerson}` : `${otherPerson} paid you`}
                  </p>
                  <div className="flex-shrink-0">
                    {hasImage ? (
                      <Image className="h-4 w-4 text-muted-foreground" data-testid="icon-image" />
                    ) : (
                      <Mic className="h-4 w-4 text-muted-foreground" data-testid="icon-voice" />
                    )}
                  </div>
                </div>
                
                <p className="text-sm font-medium text-foreground truncate mb-1">
                  {debt.expense.description || debt.expense.category}
                </p>
                
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatDate(debt.expense.createdAt)}</span>
                  <span>•</span>
                  <span>{debt.expense.category}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <div className="text-right">
                <p className={cn(
                  "text-xl font-bold font-mono tabular-nums",
                  youPaid ? "text-destructive" : "text-chart-2"
                )} data-testid={`text-amount-${debt.id}`}>
                  {youPaid ? '-' : '+'}{formatCurrency(debt.amount)}
                </p>
              </div>
              
              <Badge variant="secondary" className="text-xs bg-chart-2/20 text-chart-2">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Settled
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3" data-testid="text-page-title">
            <Receipt className="h-8 w-8 text-primary" />
            Transactions
          </h1>
          <p className="text-muted-foreground">Your payment history</p>
        </div>

        {/* Transactions List */}
        {settledDebtsWithExpenses.length > 0 ? (
          <div className="space-y-3">
            {settledDebtsWithExpenses.map((debt) => renderSettledDebtCard(debt))}
          </div>
        ) : (
          <Card className="text-center py-16">
            <CardContent>
              <div className="text-6xl mb-4">📋</div>
              <h3 className="text-2xl font-bold mb-2">No Transactions Yet</h3>
              <p className="text-muted-foreground mb-6">
                Your settled expenses will appear here
              </p>
              <Receipt className="h-16 w-16 text-muted-foreground mx-auto opacity-20" />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
