import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Coins, Wallet, TrendingUp, Users, Mail } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  const handleSendOTP = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("📧 Sending OTP to email:", email);
    setOtpSent(true);
    // TODO: Wire up Supabase email sending here
  };

  const handleVerifyOTP = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("✅ Verifying OTP for email:", email);
    console.log("🔢 OTP Code:", otp);
    
    // Output email for Supabase integration
    window.userEmail = email;
    console.log("💾 Email stored in window.userEmail:", window.userEmail);
    
    // TODO: Wire up Supabase verification here
    // For now, just navigate to the app
    setLocation("/transactions");
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
                  >
                    Send OTP
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
                      disabled={otp.length !== 6}
                      data-testid="button-verify-otp"
                    >
                      Verify & Continue
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={handleSendOTP}
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
