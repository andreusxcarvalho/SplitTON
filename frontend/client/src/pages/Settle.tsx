import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Coins, CheckCircle2, Image, Mic, Send, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ConfirmModal } from "@/components/ConfirmModal";
import { formatCurrency, getInitials, getColorFromString, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Split, Expense } from "@shared/schema";

// For demo purposes - in real app, get this from auth context
const CURRENT_USER = "You";

interface DebtWithExpense extends Split {
  expense: Expense;
}

export default function Settle() {
  const { toast } = useToast();
  const [selectedDebt, setSelectedDebt] = useState<DebtWithExpense | null>(null);
  const [showTonModal, setShowTonModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);

  const { data: splits } = useQuery<Split[]>({
    queryKey: ["/api/splits"],
  });

  const { data: expenses } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  // Join splits with expenses
  const debtsWithExpenses: DebtWithExpense[] = (splits || [])
    .map((split) => ({
      ...split,
      expense: expenses?.find((e) => e.id === split.expenseId)!,
    }))
    .filter((d) => d.expense && d.amount - d.settled > 0); // Only unsettled debts

  // Separate "You Owe" and "You're Owed"
  const youOwe = debtsWithExpenses.filter((d) => d.from === CURRENT_USER);
  const youAreOwed = debtsWithExpenses.filter((d) => d.to === CURRENT_USER);

  // Settlement mutation
  const settleMutation = useMutation({
    mutationFn: async ({ splitId, amount }: { splitId: string; amount: number }) => {
      return await apiRequest("PATCH", `/api/splits/${splitId}`, { settled: amount });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/splits"] });
      toast({
        title: "Payment completed!",
        description: "Your settlement has been recorded",
      });
    },
    onError: () => {
      toast({
        title: "Settlement failed",
        description: "Please try again",
        variant: "destructive",
      });
    },
  });

  const handlePayment = (debt: DebtWithExpense) => {
    setSelectedDebt(debt);
    setShowTonModal(true);
  };

  const handleRequest = (debt: DebtWithExpense) => {
    setSelectedDebt(debt);
    setShowRequestModal(true);
  };

  const confirmPayment = async () => {
    if (!selectedDebt) return;

    await settleMutation.mutateAsync({
      splitId: selectedDebt.id,
      amount: selectedDebt.amount,
    });

    setSelectedDebt(null);
    setShowTonModal(false);
  };

  const confirmRequest = () => {
    if (!selectedDebt) return;

    toast({
      title: "Payment request sent!",
      description: `Request sent to ${selectedDebt.from} for ${formatCurrency(selectedDebt.amount - selectedDebt.settled)}`,
    });

    setSelectedDebt(null);
    setShowRequestModal(false);
  };

  const totalYouOwe = youOwe.reduce((sum, d) => sum + (d.amount - d.settled), 0);
  const totalOwedToYou = youAreOwed.reduce((sum, d) => sum + (d.amount - d.settled), 0);

  const renderDebtCard = (debt: DebtWithExpense, isOwed: boolean) => {
    const unsettled = debt.amount - debt.settled;
    const hasImage = !!debt.expense.imageUrl;
    const otherPerson = isOwed ? debt.from : debt.to;

    return (
      <Card key={debt.id} className="hover-elevate" data-testid={`debt-card-${debt.id}`}>
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
                  <p className="font-semibold truncate">{otherPerson}</p>
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
                  isOwed ? "text-chart-2" : "text-destructive"
                )} data-testid={`text-amount-${debt.id}`}>
                  {formatCurrency(unsettled)}
                </p>
              </div>
              
              {isOwed ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRequest(debt)}
                  className="w-full"
                  data-testid={`button-request-${debt.id}`}
                >
                  <Send className="h-3 w-3 mr-1" />
                  Request
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => handlePayment(debt)}
                  className="w-full"
                  data-testid={`button-pay-${debt.id}`}
                >
                  <Wallet className="h-3 w-3 mr-1" />
                  Pay
                </Button>
              )}
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
            <Coins className="h-8 w-8 text-primary" />
            Settle Up
          </h1>
          <p className="text-muted-foreground">Pay debts or request payments</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground mb-1">You Owe</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-destructive" data-testid="text-total-you-owe">
                {formatCurrency(totalYouOwe)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {youOwe.length} {youOwe.length === 1 ? 'debt' : 'debts'}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-chart-2/10 to-chart-2/5 border-chart-2/20">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground mb-1">You're Owed</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-chart-2" data-testid="text-total-owed-to-you">
                {formatCurrency(totalOwedToYou)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {youAreOwed.length} {youAreOwed.length === 1 ? 'payment' : 'payments'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* You Owe Section */}
        {youOwe.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              You Owe
              <Badge variant="destructive" className="text-xs">
                {youOwe.length}
              </Badge>
            </h2>
            <div className="space-y-3">
              {youOwe.map((debt) => renderDebtCard(debt, false))}
            </div>
          </div>
        )}

        {/* You're Owed Section */}
        {youAreOwed.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              You're Owed
              <Badge variant="secondary" className="text-xs bg-chart-2/20 text-chart-2">
                {youAreOwed.length}
              </Badge>
            </h2>
            <div className="space-y-3">
              {youAreOwed.map((debt) => renderDebtCard(debt, true))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {youOwe.length === 0 && youAreOwed.length === 0 && (
          <Card className="text-center py-16">
            <CardContent>
              <div className="text-6xl mb-4">✨</div>
              <h3 className="text-2xl font-bold mb-2">All Settled!</h3>
              <p className="text-muted-foreground mb-6">
                You have no outstanding debts or payments
              </p>
              <CheckCircle2 className="h-16 w-16 text-chart-2 mx-auto" />
            </CardContent>
          </Card>
        )}

        {/* TON Integration Info */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-primary" />
              About TON Payments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              TON (The Open Network) is a fast and secure blockchain platform. Settlements via TON are:
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-chart-2 flex-shrink-0" />
                <span>Instant and low-cost</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-chart-2 flex-shrink-0" />
                <span>Secure and transparent</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-chart-2 flex-shrink-0" />
                <span>Integrated with Telegram</span>
              </li>
            </ul>
            <div className="mt-4 p-3 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground">
                <strong>Note:</strong> TON wallet connection is a mock feature in this demo. 
                Full integration coming soon!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* TON Payment Modal */}
      <ConfirmModal
        open={showTonModal}
        onOpenChange={setShowTonModal}
        title="Pay with TON"
        description={
          selectedDebt
            ? `You are about to pay ${formatCurrency(selectedDebt.amount - selectedDebt.settled)} to ${selectedDebt.to} for "${selectedDebt.expense.description || selectedDebt.expense.category}" using TON cryptocurrency.`
            : ""
        }
        confirmLabel="Confirm Payment"
        onConfirm={confirmPayment}
      />

      {/* Request Payment Modal */}
      <ConfirmModal
        open={showRequestModal}
        onOpenChange={setShowRequestModal}
        title="Request Payment"
        description={
          selectedDebt
            ? `Request ${formatCurrency(selectedDebt.amount - selectedDebt.settled)} from ${selectedDebt.from} for "${selectedDebt.expense.description || selectedDebt.expense.category}"?`
            : ""
        }
        confirmLabel="Send Request"
        onConfirm={confirmRequest}
      />
    </div>
  );
}
