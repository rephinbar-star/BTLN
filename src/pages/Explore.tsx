import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Header } from "@/components/chemistry/Header";
import { Footer } from "@/components/chemistry/Footer";
import { BottomNav } from "@/components/nav/BottomNav";
import { useAuth } from "@/hooks/useAuth";

type Item = { to: string; title: string; body: string };

const items: Item[] = [
  {
    to: "/group",
    title: "Group Read",
    body: "The serious look at a group chat: who carries it, who drifts, how it changes.",
  },
  {
    to: "/roast",
    title: "Roast Us",
    body: "The playful take on a two-person chat. Opt-in, and you choose what to share.",
  },
  {
    to: "/wrapped",
    title: "Relationship Wrapped",
    body: "Counted figures for a month, quarter or year you actually imported.",
  },
  {
    to: "/types",
    title: "Pair types",
    body: "The thirteen pair types and what each one tends to get right and wrong.",
  },
  {
    to: "/sample",
    title: "See a sample read",
    body: "A full example report, before you bring your own chat.",
  },
  {
    to: "/pricing",
    title: "Plans and pricing",
    body: "What's free, what a single report costs, and what a plan includes.",
  },
];

const Explore = () => {
  const { user } = useAuth();
  const all = user
    ? [
        ...items,
        {
          to: "/journey",
          title: "Relationship Journey",
          body: "Your private, opt-in view across your own reads. Early — timelines are still being built.",
        },
      ]
    : items;

  return (
    <div className="min-h-screen bg-btln-paper text-foreground">
      <Helmet>
        <title>Explore BetweenTheLines — group reads, wrapped, pair types</title>
        <meta
          name="description"
          content="Everything beyond the three main modes: Group Read, Roast Us, Relationship Wrapped, pair types, samples and plans."
        />
        <link rel="canonical" href="https://betweenthelines.app/explore" />
      </Helmet>
      <Header />
      <main className="mx-auto max-w-2xl px-5 pb-28 pt-4 sm:px-8 md:pb-16">
        <h1 className="text-[33px] font-medium leading-[1.08] tracking-[-1.15px] sm:text-[40px]">
          Explore
        </h1>
        <p className="mt-3 text-[15px] text-muted-foreground">
          Everything else BetweenTheLines can do with a conversation.
        </p>
        <ul className="mt-6 flex flex-col gap-3">
          {all.map((i) => (
            <li key={i.to}>
              <Link
                to={i.to}
                className="flex min-h-[88px] items-center justify-between gap-3 rounded-[20px] border border-btln-line bg-card p-[18px] hover:bg-muted/40"
              >
                <span>
                  <span className="block text-[16px] font-medium">{i.title}</span>
                  <span className="mt-1 block text-[14px] leading-relaxed text-muted-foreground">
                    {i.body}
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
};

export default Explore;
