import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import logoAsset from "@/assets/logo.png.asset.json";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Privacy Policy — BetweenTheLines™</title>
        <meta name="description" content="Read the BetweenTheLines Privacy Policy to understand how we collect, use, and protect your information when you use our relationship coaching tool." />
        <link rel="canonical" href="https://betweenthelines.app/privacy" />
        <meta property="og:title" content="Privacy Policy — BetweenTheLines™" />
        <meta property="og:description" content="How BetweenTheLines collects, uses, and protects your information." />
        <meta property="og:url" content="https://betweenthelines.app/privacy" />
      </Helmet>
      <header className="border-b border-border px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link to="/" className="flex items-center">
            <img src={logoAsset.url} alt="BetweenTheLines" className="h-12 w-auto" />
          </Link>
          <Link to="/" className="text-[14px] text-muted-foreground hover:text-foreground">
            ← Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-16">
        <h1 className="text-[32px] font-medium tracking-tight sm:text-[40px]">
          Privacy Policy
        </h1>
        <p className="mt-3 text-[15px] text-muted-foreground">
          This Privacy Policy describes how BetweenTheLines collects, uses, and protects your information.
          This page is maintained by BetweenTheLines and may be updated as the product evolves.
        </p>

        <section className="mt-10 space-y-3">
          <h2 className="text-[20px] font-medium">Important Disclaimer</h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            BetweenTheLines is a relationship coaching tool. It does not provide psychotherapy, psychiatric
            advice, counseling, or any form of mental health treatment. The analysis and reports generated
            by this app are for informational and coaching purposes only. If you are experiencing a mental
            health crisis or need professional support, please contact a licensed mental health professional
            or emergency services.
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-[20px] font-medium">1. Information We Collect</h2>
          <ul className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-muted-foreground">
            <li>
              <strong>Conversation Content:</strong> Text you paste or screenshots you upload to generate
              a relationship report. This content is used solely to produce your analysis and is not used
              to train any AI models.
            </li>
            <li>
              <strong>Relationship Context:</strong> Optional information you provide such as relationship
              type and names you choose to enter.
            </li>
            <li>
              <strong>Account Information:</strong> If you create an account, we collect your email address
              and any display name you choose. We do not collect phone numbers, physical addresses, or government IDs.
            </li>
            <li>
              <strong>Usage Data:</strong> Anonymous, aggregated analytics about how the app is used to
              help us improve the product. This does not include personally identifiable information.
            </li>
            <li>
              <strong>Payment Information:</strong> We do not collect or store your payment card details.
              All payments are processed securely by Stripe, our payment processor.
            </li>
          </ul>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-[20px] font-medium">2. How We Use Your Information</h2>
          <ul className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-muted-foreground">
            <li>To generate the relationship analysis and report you request.</li>
            <li>To save your reports if you create an account.</li>
            <li>To communicate with you about your account, if applicable.</li>
            <li>To improve the app through anonymous usage analytics.</li>
            <li>To comply with legal obligations or protect our rights.</li>
          </ul>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-[20px] font-medium">3. Data Storage and Security</h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            Your data is stored in a secure, hosted database with row-level security enabled. We use
            industry-standard security practices including encrypted connections (TLS/SSL) and secure
            authentication tokens. While we take reasonable precautions, no system is 100% secure, and
            we cannot guarantee absolute security.
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-[20px] font-medium">4. Data Retention</h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            Anonymous reports are retained for the duration of your browser session and may be removed
            afterward. Signed-in users' reports are retained until you choose to delete them or delete
            your account. We may retain certain information as required by law or for legitimate business purposes.
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-[20px] font-medium">5. Your Rights</h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            You can delete individual reports from your Account page at any time. You may also request
            deletion of your account and associated data by contacting us. Depending on your jurisdiction,
            you may have additional rights regarding your personal data.
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-[20px] font-medium">6. Third-Party Services</h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            We rely on the following subprocessors to operate the app:
          </p>
          <ul className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-muted-foreground">
            <li><strong>Supabase</strong> — hosted database, authentication, and edge functions.</li>
            <li><strong>Stripe</strong> — payment processing.</li>
            <li><strong>OpenRouter / Lovable AI</strong> — model inference for the analysis itself.</li>
          </ul>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-[20px] font-medium">7. Cookies and Tracking</h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            We use minimal cookies and local storage to manage your session and preferences. We do not
            use third-party advertising cookies or trackers. Analytics data is collected anonymously.
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-[20px] font-medium">8. Changes to This Policy</h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            We may update this Privacy Policy from time to time. We will notify you of any material changes
            by posting the new policy on this page with an updated effective date.
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <h2 className="text-[20px] font-medium">9. Contact Us</h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            If you have questions about this Privacy Policy or your data, please contact us through the
            Feedback option in the footer.
          </p>
        </section>

        <p className="mt-12 text-[13px] text-muted-foreground">
          Last updated: June 2026. This page describes current practices and may be updated as the product evolves.
        </p>
      </main>
    </div>
  );
}
