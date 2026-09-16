import { Helmet } from "react-helmet-async";
import { Header } from "@/components/chemistry/Header";
import { Footer } from "@/components/chemistry/Footer";

const WhatsAppGuide = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>How to Export WhatsApp Chats — BetweenTheLines™</title>
        <meta
          name="description"
          content="Learn how to export your WhatsApp chat history to get an AI relationship analysis with BetweenTheLines™."
        />
      </Helmet>
      <Header />
      <main className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
        <h1 className="text-4xl font-medium tracking-tight sm:text-5xl">How to Export WhatsApp Chats</h1>
        <div className="mt-10 space-y-8 text-[17px] leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-xl font-medium text-foreground">On iOS</h2>
            <ol className="mt-4 list-decimal space-y-3 pl-5">
              <li>Open the chat you want to analyze.</li>
              <li>Tap on the contact's name at the top.</li>
              <li>Scroll down and tap <strong>Export Chat</strong>.</li>
              <li>Choose <strong>Without Media</strong>.</li>
              <li>Save the .txt file to your phone or send it to yourself.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-medium text-foreground">On Android</h2>
            <ol className="mt-4 list-decimal space-y-3 pl-5">
              <li>Open the chat you want to analyze.</li>
              <li>Tap the three dots (menu) in the top right.</li>
              <li>Tap <strong>More</strong>, then <strong>Export Chat</strong>.</li>
              <li>Choose <strong>Without Media</strong>.</li>
              <li>Save the .txt file to your device.</li>
            </ol>
          </section>

          <p className="mt-8">
            Once you have your file, simply return to the homepage and upload it to get your analysis.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default WhatsAppGuide;
