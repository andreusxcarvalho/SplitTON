import { Switch, Route, Redirect, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import Transactions from "@/pages/Transactions";
import Settle from "@/pages/Settle";
import Analytics from "@/pages/Analytics";
import Profile from "@/pages/Profile";
import AuthPage from "@/pages/AuthPage";
import NotFound from "@/pages/not-found";
import { isAuthenticated, loadSession, validateSession } from "@/lib/api";
import "./lib/tg";

function Router() {
  const [location, setLocation] = useLocation();
  
  // Check session on mount and redirect if needed
  useEffect(() => {
    loadSession(); // Load session into window if it exists
    
    const checkAuth = async () => {
      const authenticated = isAuthenticated();
      const isAuthPage = location === "/";
      const isProtectedRoute = ["/transactions", "/settle", "/analytics", "/profile"].includes(location);
      
      // If user appears authenticated, validate against backend
      if (authenticated && isProtectedRoute) {
        const isValid = await validateSession();
        if (!isValid) {
          console.log("⚠️ Session invalid (user not in DB), redirecting to /");
          setLocation("/");
          return;
        }
      }
      
      if (authenticated && isAuthPage) {
        // If logged in and on auth page, redirect to transactions
        console.log("✅ Already authenticated, redirecting to /transactions");
        setLocation("/transactions");
      } else if (!authenticated && isProtectedRoute) {
        // If not logged in and trying to access protected route, redirect to auth
        console.log("⚠️ Not authenticated, redirecting to /");
        setLocation("/");
      }
    };
    
    checkAuth();
  }, [location, setLocation]);
  
  return (
    <Switch>
      <Route path="/" component={AuthPage} />
      <Route path="/home">{() => <Redirect to="/transactions" />}</Route>
      <Route path="/transactions" component={Transactions} />
      <Route path="/settle" component={Settle} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/profile" component={Profile} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="relative">
          <Header />
          <Router />
          <BottomNav />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
