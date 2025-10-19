import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { User, UserPlus, Trash2, ArrowLeft, Mail, LogOut } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { apiRequest as herokuApiRequest, getCurrentUserId, getCurrentUserEmail, clearSession } from "@/lib/api";
import { getInitials, getColorFromString, cn } from "@/lib/utils";

interface Friend {
  id: string;
  user_id: string;
  friend_user_id: string;
  nickname: string;
  created_at?: string;
}

export default function Profile() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");

  // Get current user from window (set during auth)
  const userId = getCurrentUserId();
  const userEmail = getCurrentUserEmail() || "user@example.com";

  const { data: friends, isLoading } = useQuery<Friend[]>({
    queryKey: ["friends", userId],
    queryFn: async () => {
      if (!userId) return [];
      return await herokuApiRequest<Friend[]>("GET", `/friends/${userId}`);
    },
    enabled: !!userId,
    refetchOnWindowFocus: true,  // Auto-refresh when Mini App reopens
    staleTime: 60000,  // Friends list changes less often, fresh for 1 minute
  });

  const addFriendMutation = useMutation({
    mutationFn: async (data: { nickname: string; email: string }) => {
      if (!userId) throw new Error("User not authenticated");
      return await herokuApiRequest("POST", `/friends/${userId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends", userId] });
      setNickname("");
      setEmail("");
      toast({
        title: "Friend added!",
        description: "You can now split expenses with them",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add friend",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const deleteFriendMutation = useMutation({
    mutationFn: async (friendId: string) => {
      if (!userId) throw new Error("User not authenticated");
      return await herokuApiRequest("DELETE", `/friends/${friendId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends", userId] });
      toast({
        title: "Friend removed",
        description: "They've been removed from your friends list",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove friend",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleAddFriend = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nickname.trim() || !email.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter both nickname and email",
        variant: "destructive",
      });
      return;
    }

    addFriendMutation.mutate({
      nickname: nickname.trim(),
      email: email.trim(),
    });
  };

  const handleDeleteFriend = (friendId: string) => {
    deleteFriendMutation.mutate(friendId);
  };

  const handleLogout = () => {
    clearSession();
    toast({
      title: "Logged out",
      description: "You've been successfully logged out",
    });
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/transactions">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold flex items-center gap-3" data-testid="text-page-title">
              <User className="h-8 w-8 text-primary" />
              Profile
            </h1>
            <p className="text-muted-foreground">Manage your account and friends</p>
          </div>
        </div>

        {/* User Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Your Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 bg-primary">
                <AvatarFallback className="text-white text-xl font-bold">
                  {getInitials(userEmail)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Mail className="h-4 w-4" />
                  <span className="text-sm">Email</span>
                </div>
                <p className="text-lg font-semibold" data-testid="text-user-email">
                  {userEmail}
                </p>
              </div>
            </div>
            
            <Button
              variant="outline"
              className="w-full"
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Log Out
            </Button>
          </CardContent>
        </Card>

        {/* Add Friend Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Add Friend
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Add friends to easily split expenses with them
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddFriend} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nickname">Nickname</Label>
                <Input
                  id="nickname"
                  placeholder="e.g. Alice, Bob"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  data-testid="input-nickname"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="friend@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="input-friend-email"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={addFriendMutation.isPending}
                data-testid="button-add-friend"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add Friend
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Friends List */}
        <Card>
          <CardHeader>
            <CardTitle>Your Friends</CardTitle>
            <p className="text-sm text-muted-foreground">
              {friends?.length || 0} {friends?.length === 1 ? 'friend' : 'friends'}
            </p>
          </CardHeader>
          <CardContent>
            {friends && friends.length > 0 ? (
              <div className="space-y-3">
                {friends.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-card-border hover-elevate"
                    data-testid={`friend-card-${friend.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Avatar className={cn("h-10 w-10", getColorFromString(friend.nickname))}>
                        <AvatarFallback className="text-white font-semibold">
                          {getInitials(friend.nickname)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{friend.nickname}</p>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteFriend(friend.id)}
                      disabled={deleteFriendMutation.isPending}
                      data-testid={`button-delete-${friend.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <UserPlus className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-20" />
                <p className="text-muted-foreground">No friends added yet</p>
                <p className="text-sm text-muted-foreground">
                  Add friends above to start splitting expenses
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
