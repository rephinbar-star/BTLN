import { Helmet } from "react-helmet-async";
import { Header } from "@/components/chemistry/Header";
import { Footer } from "@/components/chemistry/Footer";

const IMessageGuide = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>How to Export iMessage Chats — BetweenTheLines™</title>
        <meta
          name="description"
          content="Learn how to export your iMessage chat history to get an AI relationship analysis with BetweenTheLines™."
        />
      </Helmet>
      <Header />
      <main className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
        <h1 className="text-4xl font-medium tracking-tight sm:text-5xl">How to Export iMessage Chats</h1>
        <div className="mt-10 space-y-8 text-[17px] leading-relaxed text-muted-foreground">
          <p>
            Apple doesn't provide a direct "Export Chat" button for iMessage on iPhone, but there are a
            few simple ways to get your messages into BetweenTheLines™.
          </p>

          <section>
            <h2 className="text-xl font-medium text-foreground">Option 1: Copy and Paste (Recommended)</h2>
            <p className="mt-2">
              The easiest way is to select the messages you want to analyze, copy them, and paste them
              directly into our input field on the homepage.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-medium text-foreground">Option 2: Using a Mac</h2>
            <ol className="mt-4 list-decimal space-y-3 pl-5">
              <li>Open the Messages app on your Mac.</li>
              <li>Select the conversation you want to export.</li>
              <li>Go to <strong>File > Print...</strong></li>
              <li>Click the PDF dropdown in the bottom left and select <strong>Save as PDF</strong>.</li>
              <li>You can then upload this PDF to our site.</li>
            </ol>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default IMessageGuide;
