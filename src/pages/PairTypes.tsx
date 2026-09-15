import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useSearchParams } from "react-router-dom";
import { Footer } from "@/components/chemistry/Footer";
import { Header } from "@/components/chemistry/Header";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import {
  fetchPairTypes,
  fieldsFor,
  isRelationship,
  pairTypePath,
  pairTypeUrl,
  RELATIONSHIPS,
  RELATIONSHIP_LABELS,
  type PairTypeRow,
  type RelationshipType,
} from "@/lib/pairTypes";


const PairTypes = () => {
  const [params, setParams] = useSearchParams();
  const relParam = params.get("as");
  const relationship: RelationshipType = isRelationship(relParam) ? relParam : "romantic";
  const [rows, setRows] = useState<PairTypeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchPairTypes()
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    track("pair_types_viewed", { relationship });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const jsonLd = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "The 13 BetweenTheLines pair types",
      itemListElement: rows.map((row, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: fieldsFor(row, relationship).name,
        url: pairTypeUrl(row.id, relationship),
      })),
    }),
    [rows, relationship],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>The 13 Pair Types — BetweenTheLines™</title>
        <meta
          name="description"
          content="Explore the 13 BetweenTheLines pair types — from Solid Bond to Fire Pair — and see how each one shows up in romantic, friend, and family chats."
        />
        <link rel="canonical" href="https://betweenthelines.app/types" />
        <meta property="og:title" content="The 13 Pair Types — BetweenTheLines™" />
        <meta
          property="og:description"
          content="Thirteen ways two people connect. Find the one that sounds like your chat."
        />
        <meta property="og:url" content="https://betweenthelines.app/types" />
        {rows.length > 0 && (
          <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
        )}
      </Helmet>
      <Header />
      <main>
        <section className="px-5 pt-14 pb-8 sm:px-8 sm:pt-20">
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-sm text-muted-foreground">The pair types</p>
            <h1 className="mt-3 text-[32px] font-medium tracking-tight sm:text-[44px]">
              Thirteen ways two people connect.
            </h1>
            <p className="mx-auto mt-4 max-w-[620px] text-[16px] leading-relaxed text-muted-foreground">
              Every read ends with one of these. Browse them all, then paste a chat to find yours.
            </p>

            <div
              role="tablist"
              aria-label="Relationship type"
              className="mx-auto mt-8 inline-flex rounded-full border border-border bg-muted/40 p-1"
            >
              {RELATIONSHIPS.map((rel) => (
                <button
                  key={rel}
                  role="tab"
                  aria-selected={rel === relationship}
                  onClick={() => {
                    setParams(rel === "romantic" ? {} : { as: rel }, { replace: true });
                    track("pair_types_filter", { relationship: rel });
                  }}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-[14px] transition-colors",
                    rel === relationship
                      ? "bg-card font-medium text-foreground shadow-[var(--shadow-card)]"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {RELATIONSHIP_LABELS[rel]}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 pb-20 sm:px-8">
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-[300px] w-full rounded-2xl" />
                ))
              : rows.map((row) => {
                  const f = fieldsFor(row, relationship);
                  return (
                    <Link
                      key={row.id}
                      to={pairTypePath(row.id, relationship)}

                      onClick={() => track("pair_type_card_click", { id: row.id, relationship })}
                      className="group overflow-hidden rounded-2xl border border-border shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5"
                      style={{ backgroundColor: row.background_color, color: row.text_color }}
                    >
                      {f.image && (
                        <img
                          src={f.image}
                          alt={`${f.name} illustration`}
                          loading="lazy"
                          className="block h-auto w-full"
                        />
                      )}

                      <div className="p-5">
                        <h2 className="text-[20px] font-medium tracking-tight">{f.name}</h2>
                        <p className="mt-1.5 text-[14px] italic leading-snug opacity-80">
                          {f.tagline}
                        </p>
                      </div>
                    </Link>
                  );
                })}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default PairTypes;
