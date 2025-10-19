import { useQuery } from "@tanstack/react-query";
import { Receipt, UtensilsCrossed, Car, Home, Zap, HeartPulse, Popcorn, ShoppingBag, GraduationCap, Plane, MoreHorizontal } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDate, formatCurrency, getInitials, getColorFromString, getCategoryIcon, getCategoryColor } from "@/lib/utils";
import { apiRequest as herokuApiRequest, getCurrentUserId } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  payer_id: string;
  payee_id: string;
  amount: number;
  status: string;
  item: string;
  category: string;
  created_at: string;
  paid_at?: string;
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

export default function Transactions() {
  const userId = getCurrentUserId();

  // Fetch ALL transaction participants (both pending and paid)
  const { data: transactions, isLoading } = useQuery<Transaction[]>({
    queryKey: ["transactions", userId],
    queryFn: async () => {
      if (!userId) return [];
      return await herokuApiRequest<Transaction[]>("GET", `/transactions/${userId}`);
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

  // Sort transactions by date (latest first)
  const sortedTransactions = [...(transactions || [])].sort(
    (a, b) => {
      const dateA = new Date(a.paid_at || a.created_at || 0).getTime();
      const dateB = new Date(b.paid_at || b.created_at || 0).getTime();
      return dateB - dateA;
    }
  );

  const renderTransactionCard = (transaction: Transaction, index: number) => {
    const category = transaction.category || "Other";
    const iconName = getCategoryIcon(category);
    const IconComponent = iconComponents[iconName] || MoreHorizontal;
    const categoryColor = getCategoryColor(category);

    // Determine if user is payer or payee
    const userIsPayer = transaction.payer_id === userId;
    
    // Determine direction: if I'm the payer, they owe me (green +)
    // if I'm the payee, I owe them (red -)
    const isOwedToMe = userIsPayer;
    
    // Get the other person's ID and name
    const otherPersonId = userIsPayer ? transaction.payee_id : transaction.payer_id;
    const personName = otherPersonId ? (friendIdToNickname[otherPersonId] || `User ${otherPersonId.substring(0, 8)}`) : "Unknown";

    // Determine if settled
    const isSettled = transaction.status === "paid";
    const displayDate = transaction.paid_at || transaction.created_at;

    return (
      <Card key={transaction.id || index} className="hover-elevate" data-testid={`transaction-card-${index}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              {/* Category Icon */}
              <div 
                className="flex-shrink-0 mt-1 h-10 w-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: categoryColor + '20' }}
              >
                <IconComponent className="h-5 w-5" style={{ color: categoryColor }} />
              </div>
              
              <div className="min-w-0 flex-1">
                {/* Person Name */}
                <div className="flex items-center gap-2 mb-1">
                  <Avatar className={cn("h-6 w-6", getColorFromString(personName))}>
                    <AvatarFallback className="text-white text-xs font-semibold">
                      {getInitials(personName)}
                    </AvatarFallback>
                  </Avatar>
                  <p className="font-semibold truncate">{personName}</p>
                </div>
                
                {/* Item Name */}
                {transaction.item && (
                  <p className="text-sm text-muted-foreground mb-1 truncate">
                    {transaction.item}
                  </p>
                )}
                
                {/* Date & Category */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {displayDate && <span>{formatDate(displayDate)}</span>}
                  {displayDate && category && <span>•</span>}
                  <span>{category}</span>
                </div>
              </div>
            </div>

            {/* Amount & Status */}
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <div className="text-right">
                <p className={cn(
                  "text-lg font-bold font-mono tabular-nums",
                  isOwedToMe ? "text-chart-2" : "text-destructive"
                )}>
                  {isOwedToMe ? "+" : "-"}{formatCurrency(transaction.amount)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isOwedToMe ? "Owed to you" : "You owe"}
                </p>
              </div>
              
              <Badge 
                variant={isSettled ? "secondary" : "outline"}
                className={cn(
                  "text-xs",
                  isSettled && "bg-chart-2/20 text-chart-2"
                )}
              >
                {isSettled ? "Settled" : "Pending"}
              </Badge>
            </div>
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
            <p className="text-muted-foreground">Loading transactions...</p>
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
            <Receipt className="h-8 w-8 text-primary" />
            Transactions
          </h1>
          <p className="text-muted-foreground">All your expense history</p>
        </div>

        {/* Transactions List */}
        {sortedTransactions && sortedTransactions.length > 0 ? (
          <div className="space-y-3">
            {sortedTransactions.map((transaction, index) => renderTransactionCard(transaction, index))}
          </div>
        ) : (
          <Card className="text-center py-16">
            <CardContent>
              <div className="text-6xl mb-4">📋</div>
              <h3 className="text-2xl font-bold mb-2">No Transactions Yet</h3>
              <p className="text-muted-foreground mb-6">
                Start sending transactions via the Telegram bot
              </p>
              <Receipt className="h-16 w-16 text-muted-foreground mx-auto opacity-20" />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
