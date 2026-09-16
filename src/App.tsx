import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { useLayoutEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Processing from "./pages/Processing.tsx";
import DecodeResult from "./pages/DecodeResult.tsx";
import GroupRead from "./pages/GroupRead.tsx";
import GroupResult from "./pages/GroupResult.tsx";
import GroupShareView from "./pages/GroupShareView.tsx";
import RoastStart from "./pages/RoastStart.tsx";
import RoastResult from "./pages/RoastResult.tsx";
import RoastShareView from "./pages/RoastShareView.tsx";
import AnalysisShareView from "./pages/AnalysisShareView.tsx";
import Report from "./pages/Report.tsx";
import ErrorPage from "./pages/ErrorPage.tsx";
import Admin from "./pages/Admin.tsx";
import AdminCards from "./pages/AdminCards.tsx";
import AdminCompare from "./pages/AdminCompare.tsx";
import Auth from "./pages/Auth.tsx";
import Account from "./pages/Account.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import AuthCallback from "./pages/AuthCallback.tsx";
import CheckoutReturn from "./pages/CheckoutReturn";
import Pricing from "./pages/Pricing";
import PairTypes from "./pages/PairTypes";
import PairTypeDetail from "./pages/PairTypeDetail";
import PairTypeLegacyRedirect from "./pages/PairTypeLegacyRedirect";

import Trust from "./pages/Trust";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import About from "./pages/About";
import WhatsAppGuide from "./pages/guides/WhatsApp";
import IMessageGuide from "./pages/guides/IMessage";
import Sample from "./pages/Sample";
import MixedSignalsGuide from "./pages/guides/MixedSignals";
import GroupCommunicationGuide from "./pages/guides/GroupCommunication";
import ChatGPTCompare from "./pages/compare/ChatGPTCompare";
import RizzCompare from "./pages/compare/RizzCompare";
import BrandonCompare from "./pages/compare/BrandonCompare";

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
          <Route path="/decode/:decodeId" element={<DecodeResult />} />
          <Route path="/group" element={<GroupRead />} />
          <Route path="/group/:groupId" element={<GroupResult />} />
          <Route path="/g/:token" element={<GroupShareView />} />
          <Route path="/roast" element={<RoastStart />} />
          <Route path="/roast/:roastId" element={<RoastResult />} />
          <Route path="/r/:token" element={<RoastShareView />} />
          <Route path="/d/:token" element={<AnalysisShareView />} />
          <Route path="/report/:analysisId" element={<Report />} />
          <Route path="/checkout/return" element={<CheckoutReturn />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/types" element={<PairTypes />} />
          <Route path="/types/:category/:slug" element={<PairTypeDetail />} />
          <Route path="/types/:slug" element={<PairTypeLegacyRedirect />} />

          <Route path="/error" element={<ErrorPage />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/cards" element={<AdminCards />} />
          <Route path="/admin/compare" element={<AdminCompare />} />
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
          <Route path="/about" element={<About />} />
          <Route path="/guides/whatsapp" element={<WhatsAppGuide />} />
          <Route path="/guides/imessage" element={<IMessageGuide />} />
          <Route path="/sample" element={<Sample />} />
          <Route path="/guides/mixed-signal-texts" element={<MixedSignalsGuide />} />
          <Route path="/guides/group-chat-communication" element={<GroupCommunicationGuide />} />
          <Route path="/compare/chatgpt-vs-betweenthelines" element={<ChatGPTCompare />} />
          <Route path="/compare/rizz-vs-betweenthelines" element={<RizzCompare />} />
          <Route path="/compare/whatbrandonthinks-vs-betweenthelines" element={<BrandonCompare />} />

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
