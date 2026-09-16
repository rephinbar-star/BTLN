import { Helmet } from "react-helmet-async";
import { Header } from "@/components/chemistry/Header";
import { Footer } from "@/components/chemistry/Footer";

const About = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>About BetweenTheLines™ — AI Relationship Analysis</title>
        <meta
          name="description"
          content="BetweenTheLines is a tool for understanding your relationships through AI-powered chat analysis. We look at communication patterns, attachment styles, and more."
        />
      </Helmet>
      <Header />
      <main className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
        <h1 className="text-4xl font-medium tracking-tight sm:text-5xl">About BetweenTheLines™</h1>
        <div className="mt-10 space-y-6 text-[17px] leading-relaxed text-muted-foreground">
          <p>
            BetweenTheLines is built to give you a fresh perspective on your communication. By
            analyzing the nuances of your digital conversations, we provide insights that help you
            understand how you connect with the people who matter most.
          </p>
          <p>
            Our AI models are trained to identify patterns in tone, frequency, and sentiment—uncovering
            the underlying dynamics of romantic, platonic, and familial relationships.
          </p>
          <p>
            Whether you're looking for reassurance, a way to improve your communication, or just a fun
            way to see your "pair type," BetweenTheLines is here to help you read between the lines.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default About;
