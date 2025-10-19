import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Coins, Send, Wallet, CheckCircle2, UtensilsCrossed, Car, Home, Zap, HeartPulse, Popcorn, ShoppingBag, GraduationCap, Plane, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ConfirmModal } from "@/components/ConfirmModal";
import { formatCurrency, getInitials, getColorFromString, getCategoryIcon, getCategoryColor } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { apiRequest as herokuApiRequest, getCurrentUserId } from "@/lib/api";
import WebApp from "@twa-dev/sdk";

interface Settlement {
  id: string;
  payer_id: string;
  payee_id: string;
  amount: number;
  status: string;
  transaction_id: string;
  item?: string;
  category?: string;
  created_at?: string;
}

interface GroupedSettlement {
  personId: string;
  personName: string;
  netAmount: number; // Positive = they owe me, Negative = I owe them
  items: Array<{
    id: string;
    name: string;
    category: string;
    amount: number;
    direction: 'owed_to_me' | 'i_owe'; // For individual item tracking
  }>;
  settlementIds: string[]; // All settlement IDs to settle at once
}

// Map icon names to actual Lucide components
const iconComponents: Record<string, any> = {
  UtensilsCrossed,
  Car,
  Home,
  Zap,
  HeartPulse,
  Popcorn,
  ShoppingBag,
  GraduationCap,
  Plane,
  MoreHorizontal,
};

export default function Settle() {
  const { toast } = useToast();
  const [selectedGroup, setSelectedGroup] = useState<GroupedSettlement | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);

  const userId = getCurrentUserId();

  const { data: settlements, isLoading } = useQuery<Settlement[]>({
    queryKey: ["settlements", userId],
    queryFn: async () => {
      if (!userId) return [];
      return await herokuApiRequest<Settlement[]>("GET", `/settlements/${userId}`);
    },
    enabled: !!userId,
    refetchOnWindowFocus: true,
    staleTime: 30000,
  });

  // Fetch friends to map user IDs to nicknames
  const { data: friends } = useQuery<Array<{ id: string; nickname: string; friend_user_id?: string }>>({
    queryKey: ["friends", userId],
    queryFn: async () => {
      if (!userId) return [];
      return await herokuApiRequest<Array<{ id: string; nickname: string; friend_user_id?: string }>>("GET", `/friends/${userId}`);
    },
    enabled: !!userId,
    refetchOnWindowFocus: true,
    staleTime: 60000,
  });

  // Create mapping from friend_user_id to nickname
  const friendIdToNickname = (friends || []).reduce((acc, friend) => {
    if (friend.friend_user_id) {
      acc[friend.friend_user_id] = friend.nickname;
    }
    return acc;
  }, {} as Record<string, string>);

  // Group settlements by person and calculate net amounts
  const groupedSettlements: GroupedSettlement[] = (() => {
    if (!settlements || !userId) return [];

    const personMap = new Map<string, GroupedSettlement>();

    settlements.forEach((settlement) => {
      const userIsPayer = settlement.payer_id === userId;
      const otherPersonId = userIsPayer ? settlement.payee_id : settlement.payer_id;
      const personName = friendIdToNickname[otherPersonId] || `User ${otherPersonId.substring(0, 8)}`;

      // Get or create person group
      if (!personMap.has(otherPersonId)) {
        personMap.set(otherPersonId, {
          personId: otherPersonId,
          personName,
          netAmount: 0,
          items: [],
          settlementIds: [],
        });
      }

      const group = personMap.get(otherPersonId)!;

      // If I'm the payer, they owe me (+amount to net)
      // If I'm the payee, I owe them (-amount to net)
      const amountDelta = userIsPayer ? settlement.amount : -settlement.amount;
      group.netAmount += amountDelta;

      // Add item details (backend returns 'item' not 'item_name')
      group.items.push({
        id: settlement.id,
        name: settlement.item || "Item",
        category: settlement.category || "Other",
        amount: settlement.amount,
        direction: userIsPayer ? 'owed_to_me' : 'i_owe',
      });

      // Track settlement IDs
      group.settlementIds.push(settlement.id);
    });

    return Array.from(personMap.values());
  })();

  // Separate into "You Owe" (net negative) and "You're Owed" (net positive)
  const youOwe = groupedSettlements.filter(g => g.netAmount < 0);
  const youAreOwed = groupedSettlements.filter(g => g.netAmount > 0);

  const totalYouOwe = youOwe.reduce((sum, g) => sum + Math.abs(g.netAmount), 0);
  const totalOwedToYou = youAreOwed.reduce((sum, g) => sum + g.netAmount, 0);

  // Payment mutation (creates payment link and opens it)
  const paymentMutation = useMutation({
    mutationFn: async (data: { userId: string; amount: number; settlementIds: string[] }) => {
      // Call payment_notification to get payment URL
      const response = await herokuApiRequest<{ payment_url: string }>(
        "POST",
        "/payment_notification",
        { user_id: data.userId, amount: data.amount }
      );
      
      // Open payment URL in Telegram
      if (response.payment_url) {
        WebApp.openLink(response.payment_url);
      }
      
      // Mark all settlements as paid
      await Promise.all(
        data.settlementIds.map(id => 
          herokuApiRequest("POST", `/settle/${id}`)
        )
      );
      
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settlements", userId] });
      queryClient.invalidateQueries({ queryKey: ["transactions", userId] });
      toast({
        title: "Payment link opened!",
        description: "Complete payment in the new tab and transaction will be marked as settled",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Payment failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handlePayment = async (group: GroupedSettlement) => {
    if (!userId) return;
    
    await paymentMutation.mutateAsync({
      userId,
      amount: Math.abs(group.netAmount),
      settlementIds: group.settlementIds,
    });
  };

  const handleRequest = (group: GroupedSettlement) => {
    setSelectedGroup(group);
    setShowRequestModal(true);
  };

  const confirmRequest = () => {
    if (!selectedGroup) return;

    toast({
      title: "Payment request sent!",
      description: `Request sent for ${formatCurrency(Math.abs(selectedGroup.netAmount))}`,
    });

    setSelectedGroup(null);
    setShowRequestModal(false);
  };

  const renderGroupCard = (group: GroupedSettlement, isOwed: boolean) => {
    const netAmount = Math.abs(group.netAmount);

    return (
      <Card key={group.personId} className="hover-elevate" data-testid={`settlement-card-${group.personId}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Avatar className={cn("h-10 w-10", getColorFromString(group.personName))}>
                <AvatarFallback className="text-white font-semibold">
                  {getInitials(group.personName)}
                </AvatarFallback>
              </Avatar>
              
              <div className="min-w-0 flex-1">
                <p className="font-bold text-lg truncate">{group.personName}</p>
                <p className="text-xs text-muted-foreground">
                  {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                </p>
              </div>
            </div>

            {/* Net Amount */}
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <p className={cn(
                "text-2xl font-bold font-mono tabular-nums",
                isOwed ? "text-chart-2" : "text-destructive"
              )} data-testid={`text-net-amount-${group.personId}`}>
                {formatCurrency(netAmount)}
              </p>
              
              {isOwed ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRequest(group)}
                  className="w-full"
                  data-testid={`button-request-${group.personId}`}
                >
                  <Send className="h-3 w-3 mr-1" />
                  Request
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => handlePayment(group)}
                  className="w-full"
                  disabled={paymentMutation.isPending}
                  data-testid={`button-pay-${group.personId}`}
                >
                  <Wallet className="h-3 w-3 mr-1" />
                  Pay
                </Button>
              )}
            </div>
          </div>

          <Separator className="mb-3" />

          {/* Item Breakdown */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Items
            </p>
            {group.items.map((item) => {
              const iconName = getCategoryIcon(item.category);
              const IconComponent = iconComponents[iconName] || MoreHorizontal;
              const categoryColor = getCategoryColor(item.category);

              return (
                <div key={item.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div 
                      className="flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: categoryColor + '20' }}
                    >
                      <IconComponent className="h-3 w-3" style={{ color: categoryColor }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.category}</p>
                    </div>
                  </div>
                  <p className={cn(
                    "text-sm font-mono tabular-nums flex-shrink-0",
                    item.direction === 'owed_to_me' ? "text-chart-2" : "text-destructive"
                  )}>
                    {item.direction === 'owed_to_me' ? '+' : '-'}{formatCurrency(item.amount)}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="text-center py-16">
            <p className="text-muted-foreground">Loading settlements...</p>
          </div>
        </div>
      </div>
    );
  }

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
                {youOwe.length} {youOwe.length === 1 ? 'person' : 'people'}
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
                {youAreOwed.length} {youAreOwed.length === 1 ? 'person' : 'people'}
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
              {youOwe.map((group) => renderGroupCard(group, false))}
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
              {youAreOwed.map((group) => renderGroupCard(group, true))}
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

      {/* Request Payment Modal */}
      <ConfirmModal
        open={showRequestModal}
        onOpenChange={setShowRequestModal}
        title="Request Payment"
        description={
          selectedGroup
            ? `Request ${formatCurrency(Math.abs(selectedGroup.netAmount))} from ${selectedGroup.personName}?`
            : ""
        }
        confirmLabel="Send Request"
        onConfirm={confirmRequest}
      />
    </div>
  );
}
