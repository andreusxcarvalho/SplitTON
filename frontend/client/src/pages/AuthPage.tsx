import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Coins, Wallet, TrendingUp, Users, Mail, Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, saveSession } from "@/lib/api";
import WebApp from "@twa-dev/sdk";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [telegramId, setTelegramId] = useState<number | null>(null);

  // Extract Telegram ID from Telegram Mini App
  useEffect(() => {
    try {
      // Log everything for debugging
      console.log("🔍 Full WebApp object:", WebApp);
      console.log("🔍 WebApp.initDataUnsafe:", WebApp.initDataUnsafe);
      console.log("🔍 WebApp.initData:", WebApp.initData);
      
      // Try multiple ways to get telegram ID
      const tgUser = WebApp.initDataUnsafe?.user;
      console.log("🔍 Extracted user object:", tgUser);
      
      if (tgUser?.id) {
        setTelegramId(tgUser.id);
        console.log("✅ Telegram User ID:", tgUser.id);
        console.log("✅ Telegram Username:", tgUser.username);
        console.log("✅ Telegram First Name:", tgUser.first_name);
      } else {
        // Fallback for testing outside Telegram (use timestamp as fake ID)
        const fallbackId = Date.now() % 1000000000;
        setTelegramId(fallbackId);
        console.warn("⚠️ Running outside Telegram, using fallback ID:", fallbackId);
        console.warn("⚠️ WebApp.initDataUnsafe.user was:", tgUser);
      }
    } catch (error) {
      console.error("❌ Failed to get Telegram data:", error);
      // Use timestamp as fallback
      setTelegramId(Date.now() % 1000000000);
    }
  }, []);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await apiRequest("POST", "/register", { email });
      
      toast({
        title: "OTP Sent!",
        description: "Check your email for the verification code",
      });
      
      setOtpSent(true);
      console.log("📧 OTP sent to:", email);
    } catch (error: any) {
      toast({
        title: "Failed to send OTP",
        description: error.message || "Please try again",
        variant: "destructive",
      });
      console.error("❌ Error sending OTP:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      console.log("📤 Sending to backend:", { email, otp: "***", telegram_id: telegramId });
      
      const response = await apiRequest<{ message: string; user_id: string }>(
        "POST",
        "/verify",
        { 
          email, 
          otp,
          telegram_id: telegramId // Send Telegram ID to backend
        }
      );
      
      // Save session to localStorage (persists across refreshes!)
      saveSession(response.user_id, email, telegramId || undefined);
      
      console.log("✅ User verified:", { email, userId: response.user_id, telegramId });
      
      toast({
        title: "Welcome!",
        description: "Successfully logged in",
      });
      
      setLocation("/transactions");
    } catch (error: any) {
      toast({
        title: "Verification failed",
        description: error.message || "Invalid OTP",
        variant: "destructive",
      });
      console.error("❌ Error verifying OTP:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Column - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Coins className="h-10 w-10 text-primary" />
              <h1 className="text-3xl font-bold">Money AI Splitter</h1>
            </div>
            <p className="text-muted-foreground">Smart expense splitting for groups</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                {otpSent ? "Verify OTP" : "Sign in with Email"}
              </CardTitle>
              <CardDescription>
                {otpSent 
                  ? "Enter the 6-digit code sent to your email" 
                  : "We'll send you a one-time password"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!otpSent ? (
                <form onSubmit={handleSendOTP} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      data-testid="input-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      You'll receive a verification code
                    </p>
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    data-testid="button-send-otp"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Send OTP"
                    )}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOTP} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="email-display">Email</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="email-display"
                        type="email"
                        value={email}
                        disabled
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setOtpSent(false);
                          setOtp("");
                        }}
                        data-testid="button-change-email"
                      >
                        Change
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="otp">Verification Code</Label>
                    <div className="flex justify-center">
                      <InputOTP
                        maxLength={6}
                        value={otp}
                        onChange={(value) => setOtp(value)}
                        data-testid="input-otp"
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      Enter the 6-digit code
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={otp.length !== 6 || isLoading}
                      data-testid="button-verify-otp"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        "Verify & Continue"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={handleSendOTP}
                      disabled={isLoading}
                      data-testid="button-resend-otp"
                    >
                      Resend OTP
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground mt-4">
            🔐 Your email will be used for Supabase authentication
          </p>
        </div>
      </div>

      {/* Right Column - Hero Section */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary/20 via-chart-1/20 to-chart-2/20 items-center justify-center p-12">
        <div className="max-w-lg space-y-8">
          <div>
            <h2 className="text-4xl font-bold mb-4">Split expenses effortlessly with AI</h2>
            <p className="text-lg text-muted-foreground">
              Upload receipts, let AI parse the details, and settle up with friends using cryptocurrency
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Smart Receipt Scanning</h3>
                <p className="text-sm text-muted-foreground">
                  AI-powered OCR extracts amounts, items, and categories from photos
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="h-12 w-12 rounded-lg bg-chart-1/10 flex items-center justify-center flex-shrink-0">
                <Users className="h-6 w-6 text-chart-1" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Equal Split Calculation</h3>
                <p className="text-sm text-muted-foreground">
                  Automatically divide expenses among participants with clear breakdowns
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="h-12 w-12 rounded-lg bg-chart-2/10 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-6 w-6 text-chart-2" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Analytics & Insights</h3>
                <p className="text-sm text-muted-foreground">
                  Track spending patterns, category breakdowns, and settlement history
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="h-12 w-12 rounded-lg bg-chart-3/10 flex items-center justify-center flex-shrink-0">
                <Coins className="h-6 w-6 text-chart-3" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">TON Cryptocurrency Settlement</h3>
                <p className="text-sm text-muted-foreground">
                  Mock crypto payments flow for instant, secure settlements
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// TypeScript: Add email to window object
declare global {
  interface Window {
    userEmail?: string;
  }
}
