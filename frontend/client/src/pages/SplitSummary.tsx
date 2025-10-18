import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Edit2, ArrowLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CashFlowGraph } from "@/components/CashFlowGraph";
import { formatCurrency, getInitials, getColorFromString, getCategoryIcon, formatDate } from "@/lib/utils";
import { useExpenseStore } from "@/state/store";
import type { Expense, Split } from "@shared/schema";
import { cn } from "@/lib/utils";

export default function SplitSummary() {
  const [location] = useLocation();
  const searchParams = new URLSearchParams(location.split('?')[1]);
  const expenseId = searchParams.get('id');

  const { data: expenses } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const { data: splits } = useQuery<Split[]>({
    queryKey: ["/api/splits"],
  });

  const setExpenses = useExpenseStore((state) => state.setExpenses);
  const setSplits = useExpenseStore((state) => state.setSplits);
  const getCashFlowArrows = useExpenseStore((state) => state.getCashFlowArrows);

  // Sync API data to store
  useEffect(() => {
    if (expenses) setExpenses(expenses);
  }, [expenses, setExpenses]);

  useEffect(() => {
    if (splits) setSplits(splits);
  }, [splits, setSplits]);

  const expense = expenses?.find((e) => e.id === expenseId) || expenses?.[0];
  const cashFlowArrows = getCashFlowArrows();

  if (!expense) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pb-24">
        <Card className="text-center p-12">
          <CardContent>
            <p className="text-muted-foreground mb-4">No expense selected</p>
            <Link href="/">
              <Button>Go Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const splitAmount = expense.total / expense.participants.length;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Split Summary</h1>
            <p className="text-muted-foreground">Review and confirm the split</p>
          </div>
        </div>

        {/* Receipt Info Card */}
        <Card className="border-l-4" style={{ borderLeftColor: 'hsl(var(--chart-3))' }}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-4xl">{getCategoryIcon(expense.category)}</div>
                <div>
                  <CardTitle>{expense.description || expense.category}</CardTitle>
                  <p className="text-sm text-muted-foreground">{formatDate(expense.createdAt)}</p>
                </div>
              </div>
              <Link href="/add">
                <Button variant="ghost" size="icon" data-testid="button-edit">
                  <Edit2 className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Amount</p>
                <p className="text-4xl font-bold font-mono tabular-nums" data-testid="text-total">
                  {formatCurrency(expense.total)}
                </p>
              </div>

              {expense.imageUrl && (
                <div className="mt-4">
                  <img
                    src={expense.imageUrl}
                    alt="Receipt"
                    className="w-full rounded-lg border border-card-border"
                  />
                </div>
              )}

              <div>
                <p className="text-sm text-muted-foreground mb-2">Paid by</p>
                <Badge variant="default" className="text-base px-4 py-2">
                  {expense.payer}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Participants Card */}
        <Card>
          <CardHeader>
            <CardTitle>Split Breakdown</CardTitle>
            <p className="text-sm text-muted-foreground">
              {formatCurrency(splitAmount)} per person ({expense.participants.length} people)
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {expense.participants.map((participant, idx) => {
                const isPayer = participant === expense.payer;
                return (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-xl border-2 transition-all",
                      isPayer
                        ? "border-chart-2 bg-chart-2/10"
                        : "border-card-border"
                    )}
                    data-testid={`participant-card-${idx}`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className={cn("h-12 w-12", getColorFromString(participant))}>
                        <AvatarFallback className="text-white font-semibold">
                          {getInitials(participant)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold">{participant}</p>
                        <p className="text-xs text-muted-foreground">
                          {isPayer ? "Paid full amount" : "Owes share"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold font-mono tabular-nums" data-testid={`text-split-${idx}`}>
                        {formatCurrency(splitAmount)}
                      </p>
                      {isPayer && (
                        <Badge variant="secondary" className="mt-1">
                          Paid
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Cash Flow Visualization */}
        {cashFlowArrows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Who Owes Who</CardTitle>
              <p className="text-sm text-muted-foreground">
                Simplified payment flow
              </p>
            </CardHeader>
            <CardContent>
              <CashFlowGraph arrows={cashFlowArrows} />
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Link href="/settle" className="flex-1">
            <Button variant="default" className="w-full" size="lg" data-testid="button-settle">
              Settle in TON
            </Button>
          </Link>
          <Link href="/analytics" className="flex-1">
            <Button variant="outline" className="w-full" size="lg" data-testid="button-analytics">
              View Analytics
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
