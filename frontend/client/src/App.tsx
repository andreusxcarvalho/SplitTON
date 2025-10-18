import { Switch, Route, Redirect } from "wouter";
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
import "./lib/tg";

function Router() {
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
