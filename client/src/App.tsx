import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

// Pages
import Home from "./pages/Home";
import SubscriberDashboard from "./pages/subscriber/Dashboard";
import SubmitLetter from "./pages/subscriber/SubmitLetter";
import MyLetters from "./pages/subscriber/MyLetters";
import LetterDetail from "./pages/subscriber/LetterDetail";
import EmployeeDashboard from "./pages/employee/Dashboard";
import ReviewQueue from "./pages/employee/ReviewQueue";
import ReviewDetail from "./pages/employee/ReviewDetail";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminUsers from "./pages/admin/Users";
import AdminJobs from "./pages/admin/Jobs";
import AdminAllLetters from "./pages/admin/AllLetters";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={SubscriberDashboard} />
      <Route path="/submit" component={SubmitLetter} />
      <Route path="/letters" component={MyLetters} />
      <Route path="/letters/:id" component={LetterDetail} />
      <Route path="/review" component={EmployeeDashboard} />
      <Route path="/review/queue" component={ReviewQueue} />
      <Route path="/review/:id" component={ReviewDetail} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/jobs" component={AdminJobs} />
      <Route path="/admin/letters" component={AdminAllLetters} />
      <Route path="/admin/letters/:id" component={ReviewDetail} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
