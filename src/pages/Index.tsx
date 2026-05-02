import { FinalCta } from "@/components/chemistry/FinalCta";
import { Footer } from "@/components/chemistry/Footer";
import { Header } from "@/components/chemistry/Header";
import { Hero } from "@/components/chemistry/Hero";
import { HowItWorks } from "@/components/chemistry/HowItWorks";
import { InputSection } from "@/components/chemistry/InputSection";
import { MobileStickyCta } from "@/components/chemistry/MobileStickyCta";
import { WhatYouGet } from "@/components/chemistry/WhatYouGet";

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
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
