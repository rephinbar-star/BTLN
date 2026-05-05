import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Processing from "./pages/Processing.tsx";
import Report from "./pages/Report.tsx";
import ErrorPage from "./pages/ErrorPage.tsx";
import Admin from "./pages/Admin.tsx";
import Auth from "./pages/Auth.tsx";
import Account from "./pages/Account.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import { AuthProvider } from "./hooks/useAuth";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/processing/:analysisId" element={<Processing />} />
          <Route path="/report/:analysisId" element={<Report />} />
          <Route path="/error" element={<ErrorPage />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <Account />
              </ProtectedRoute>
            }
          />
          <Route path="/reset-password" element={<ResetPassword />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
