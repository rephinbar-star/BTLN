import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { FinalCta } from "@/components/chemistry/FinalCta";
import { Footer } from "@/components/chemistry/Footer";
import { Header } from "@/components/chemistry/Header";
import { Hero } from "@/components/chemistry/Hero";
import { HowItWorks } from "@/components/chemistry/HowItWorks";
import { InputSection } from "@/components/chemistry/InputSection";
import { WhatYouGet } from "@/components/chemistry/WhatYouGet";
import { ReturningHero } from "@/components/chemistry/ReturningHero";
import { useAuth } from "@/hooks/useAuth";
import { logEvent } from "@/lib/session";
import { track } from "@/lib/analytics";

const SESSION_KEY = "chemistry_landing_viewed";
const REF_KEY = "btln_ref_visit_fired";

const Index = () => {
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Referral attribution: PII-free, value comes from a fixed enum-ish tag.
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (ref && !sessionStorage.getItem(REF_KEY)) {
        sessionStorage.setItem(REF_KEY, "1");
        track("referred_visit", { ref });
      }
    } catch {
      // ignore
    }
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");
    logEvent("landing_viewed");
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Header />
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Helmet>
          <title>BetweenTheLines™ — Read another conversation</title>
          <meta name="description" content="Paste a new chat or thread and we'll show you what's really being said." />
          <link rel="canonical" href="https://betweenthelines.app/" />
          <meta property="og:url" content="https://betweenthelines.app/" />
        </Helmet>
        <Header />
        <main>
          <ReturningHero />
          <InputSection hideIntro />
          <section className="px-5 pb-16 text-center sm:px-8">
            <Link
              to="/account"
              className="text-[14px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Or revisit your past reads →
            </Link>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>BetweenTheLines™ — AI relationship analysis from your texts</title>
        <meta name="description" content="Paste your texts and get a detailed AI report on your communication style, attachment patterns, and relationship dynamics. No signup, results in 90 seconds." />
        <link rel="canonical" href="https://betweenthelines.app/" />
        <meta property="og:title" content="BetweenTheLines™ — AI relationship analysis from your texts" />
        <meta property="og:description" content="Paste your texts and get a detailed AI report on your communication style, attachment patterns, and relationship dynamics." />
        <meta property="og:url" content="https://betweenthelines.app/" />
      </Helmet>
      <Header />
      <main>
        <Hero />
        <InputSection />
        <HowItWorks />
        <WhatYouGet />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
