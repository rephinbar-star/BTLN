import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { useLayoutEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Processing from "./pages/Processing.tsx";
import Report from "./pages/Report.tsx";
import ErrorPage from "./pages/ErrorPage.tsx";
import Admin from "./pages/Admin.tsx";
import AdminCards from "./pages/AdminCards.tsx";
import Auth from "./pages/Auth.tsx";
import Account from "./pages/Account.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import AuthCallback from "./pages/AuthCallback.tsx";
import CheckoutReturn from "./pages/CheckoutReturn";
import Trust from "./pages/Trust";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import OAuthConsent from "./pages/OAuthConsent";
import { AuthProvider } from "./hooks/useAuth";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { PaymentTestModeBanner } from "./components/PaymentTestModeBanner";
import { ConsentBanner } from "./components/ConsentBanner";

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    // Use "instant" to bypass the global `scroll-behavior: smooth` rule,
    // which can otherwise be interrupted by focus changes on the new page.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);
  return null;
};

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <AuthProvider>
        <PaymentTestModeBanner />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/processing/:analysisId" element={<Processing />} />
          <Route path="/report/:analysisId" element={<Report />} />
          <Route path="/checkout/return" element={<CheckoutReturn />} />
          <Route path="/error" element={<ErrorPage />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/cards" element={<AdminCards />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/auth/reset-password" element={<ResetPassword />} />
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <Account />
              </ProtectedRoute>
            }
          />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/trust" element={<Trust />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        <ConsentBanner />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
