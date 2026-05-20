import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { FinalCta } from "@/components/chemistry/FinalCta";
import { Footer } from "@/components/chemistry/Footer";
import { Header } from "@/components/chemistry/Header";
import { Hero } from "@/components/chemistry/Hero";
import { HowItWorks } from "@/components/chemistry/HowItWorks";
import { InputSection } from "@/components/chemistry/InputSection";
import { MobileStickyCta } from "@/components/chemistry/MobileStickyCta";
import { WhatYouGet } from "@/components/chemistry/WhatYouGet";
import { logEvent } from "@/lib/session";

const SESSION_KEY = "chemistry_landing_viewed";

const Index = () => {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");
    logEvent("landing_viewed");
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Chemistry — AI relationship analysis from your texts</title>
        <meta name="description" content="Paste your texts and get a detailed AI report on your communication style, attachment patterns, and relationship dynamics. No signup, results in 90 seconds." />
        <link rel="canonical" href="https://couplechemistry1.lovable.app/" />
        <meta property="og:title" content="Chemistry — AI relationship analysis from your texts" />
        <meta property="og:description" content="Paste your texts and get a detailed AI report on your communication style, attachment patterns, and relationship dynamics." />
        <meta property="og:url" content="https://couplechemistry1.lovable.app/" />
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
      <MobileStickyCta />
    </div>
  );
};

export default Index;
