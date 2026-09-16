import { Helmet } from "react-helmet-async";
import { Header } from "@/components/chemistry/Header";
import { Footer } from "@/components/chemistry/Footer";

const InstagramGuide = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>How to Export Instagram Messages — BetweenTheLines™</title>
        <meta
          name="description"
          content="Learn how to export your Instagram messages to get an AI relationship analysis with BetweenTheLines™."
        />
      </Helmet>
      <Header />
      <main className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
        <h1 className="text-4xl font-medium tracking-tight sm:text-5xl">How to Export Instagram Messages</h1>
        <div className="mt-10 space-y-8 text-[17px] leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-xl font-medium text-foreground">Copy and Paste</h2>
            <p className="mt-2">
              For quick analyses, you can simply copy and paste your messages directly into the
              analysis field on our homepage.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-medium text-foreground">Full Data Request</h2>
            <ol className="mt-4 list-decimal space-y-3 pl-5">
              <li>Go to your profile and tap the menu icon (three lines).</li>
              <li>Tap <strong>Your activity</strong>.</li>
              <li>Scroll down and tap <strong>Download your information</strong>.</li>
              <li>Tap <strong>Request a download</strong>.</li>
              <li>Select <strong>Messages</strong> only for a faster export.</li>
              <li>Choose <strong>JSON</strong> as the format.</li>
            </ol>
            <p className="mt-4">
              Once you receive the file from Instagram, you can upload the messages.json file to our
              tool.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default InstagramGuide;
