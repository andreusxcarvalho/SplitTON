import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Users } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReceiptCard } from "@/components/ReceiptCard";
import { CashFlowGraph } from "@/components/CashFlowGraph";
import { useExpenseStore } from "@/state/store";
import { formatCurrency } from "@/lib/utils";
import type { Expense, Split } from "@shared/schema";

export default function Home() {
  const { data: expenses, isLoading } = useQuery<Expense[]>({
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

  const cashFlowArrows = getCashFlowArrows();
  const totalOwed = cashFlowArrows.reduce((sum, arrow) => sum + arrow.amount, 0);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Money Split AI</h1>
            <p className="text-muted-foreground">Track & split expenses effortlessly</p>
          </div>
          <Link href="/add">
            <Button size="icon" className="rounded-full h-14 w-14 shadow-lg" data-testid="button-add-expense">
              <Plus className="h-6 w-6" />
            </Button>
          </Link>
        </div>

        {/* Outstanding Balance Card */}
        {totalOwed > 0 && (
          <Card className="bg-gradient-to-br from-primary/10 to-chart-1/10 border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg">Outstanding Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold font-mono tabular-nums text-primary" data-testid="text-total-owed">
                {formatCurrency(totalOwed)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Total amount to be settled
              </p>
            </CardContent>
          </Card>
        )}

        {/* Cash Flow Section */}
        {cashFlowArrows.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Users className="h-5 w-5" />
                Who Owes Who
              </h2>
              <Link href="/settle">
                <Button variant="outline" size="sm" data-testid="button-settle-now">
                  Settle Now
                </Button>
              </Link>
            </div>
            <CashFlowGraph arrows={cashFlowArrows} />
          </div>
        )}

        {/* Recent Expenses */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Recent Expenses</h2>
            <Link href="/analytics">
              <Button variant="ghost" size="sm" data-testid="button-view-all">
                View All →
              </Button>
            </Link>
          </div>

          {isLoading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-6 bg-muted rounded w-3/4" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-4 bg-muted rounded w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!isLoading && expenses && expenses.length === 0 && (
            <Card className="text-center py-12">
              <CardContent>
                <div className="text-6xl mb-4">📝</div>
                <h3 className="text-xl font-semibold mb-2">No expenses yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start by adding your first expense
                </p>
                <Link href="/add">
                  <Button data-testid="button-get-started">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Expense
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {!isLoading && expenses && expenses.length > 0 && (
            <div className="space-y-3" data-testid="expense-list">
              {expenses.slice(0, 5).map((expense) => (
                <Link key={expense.id} href={`/summary?id=${expense.id}`}>
                  <ReceiptCard expense={expense} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
