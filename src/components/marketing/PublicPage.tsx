import type { ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { Header } from "@/components/chemistry/Header";
import { Footer } from "@/components/chemistry/Footer";

export function PublicPage({ title, description, path, children }: { title: string; description: string; path: string; children: ReactNode }) {
  const url = `https://betweenthelines.app${path}`;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
      </Helmet>
      <Header />
      <main className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">{children}</main>
      <Footer />
    </div>
  );
}
