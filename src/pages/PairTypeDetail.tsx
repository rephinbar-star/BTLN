import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Footer } from "@/components/chemistry/Footer";
import { Header } from "@/components/chemistry/Header";
import { DecorativeElement } from "@/components/chemistry/DecorativeElement";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import {
  fetchPairType,
  fetchPairTypes,
  fieldsFor,
  ID_BY_SLUG,
  isRelationship,
  RELATIONSHIPS,
  RELATIONSHIP_LABELS,
  SLUG_BY_ID,
  type PairTypeRow,
  type RelationshipType,
} from "@/lib/pairTypes";

const hexToRgba = (hex: string, alpha: number) => {
  const v = hex.replace("#", "");
  const full = v.length === 3 ? v.split("").map((c) => c + c).join("") : v;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const PairTypeDetail = () => {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const relParam = params.get("as");
  const relationship: RelationshipType = isRelationship(relParam) ? relParam : "romantic";
  const id = ID_BY_SLUG[slug];

  const [row, setRow] = useState<PairTypeRow | null>(null);
  const [others, setOthers] = useState<PairTypeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      navigate("/types", { replace: true });
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchPairType(id), fetchPairTypes()])
      .then(([one, all]) => {
        if (cancelled) return;
        setRow(one);
        setOthers(all.filter((r) => r.id !== id).slice(0, 3));
      })
      .catch(() => {
        if (!cancelled) setRow(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  useEffect(() => {
    if (id) track("pair_type_page_viewed", { id, relationship });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const f = row ? fieldsFor(row, relationship) : null;
  const canonical = `https://betweenthelines.app/types/${slug}`;

  const jsonLd = useMemo(
    () =>
      row && f
        ? {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: `${f.name} — BetweenTheLines pair type`,
            description: f.description,
            url: canonical,
            isPartOf: {
              "@type": "WebSite",
              name: "BetweenTheLines",
              url: "https://betweenthelines.app",
            },
          }
        : null,
    [row, f, canonical],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>{f ? `${f.name} — BetweenTheLines™ pair type` : "Pair type — BetweenTheLines™"}</title>
        <meta
          name="description"
          content={
            f
              ? `${f.tagline} What ${f.name} looks like in everyday messages, its superpower, and where it gets stuck.`
              : "Explore the BetweenTheLines pair types."
          }
        />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={f ? `${f.name} — BetweenTheLines™` : "BetweenTheLines™"} />
        <meta property="og:description" content={f?.tagline ?? ""} />
        <meta property="og:url" content={canonical} />
        {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
      </Helmet>
      <Header />
      <main>
        <nav className="mx-auto max-w-4xl px-5 pt-6 text-[14px] text-muted-foreground sm:px-8">
          <Link to="/types" className="hover:text-foreground">
            ← All pair types
          </Link>
        </nav>

        <section className="px-5 pt-6 pb-16 sm:px-8">
          {loading || !row || !f ? (
            <div className="mx-auto max-w-4xl space-y-4">
              <Skeleton className="h-[420px] w-full rounded-[24px]" />
            </div>
          ) : (
            <div className="mx-auto max-w-4xl">
              <article
                className="relative overflow-hidden rounded-[24px] px-6 py-12 text-center shadow-[var(--shadow-card)] sm:px-10 sm:py-14"
                style={{ backgroundColor: row.background_color, color: row.text_color }}
              >
                <DecorativeElement type={row.decorative_element} color={row.text_color} />
                <h1 className="text-[34px] font-medium leading-tight tracking-tight sm:text-[44px]">
                  {f.name}
                </h1>
                <div
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium uppercase tracking-wide"
                  style={{ backgroundColor: hexToRgba(row.text_color, 0.08) }}
                >
                  <span aria-hidden>⚡</span>
                  <span>{f.superpower}</span>
                </div>
                {f.image && (
                  <div className="mx-auto mt-8 aspect-square w-full max-w-[360px] overflow-hidden rounded-[16px]">
                    <img
                      src={f.image}
                      alt={`${f.name} illustration`}
                      className="h-full w-full object-cover"
                      loading="eager"
                    />
                  </div>
                )}
                <p className="mx-auto mt-8 max-w-[480px] text-[18px] italic leading-snug sm:text-[20px]">
                  {f.tagline}
                </p>
                <p
                  className="mx-auto mt-5 max-w-[540px] text-[15px] leading-relaxed sm:text-[16px]"
                  style={{ color: hexToRgba(row.text_color, 0.75) }}
                >
                  {f.description}
                </p>
              </article>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                <span className="text-[13px] text-muted-foreground">Read this type as:</span>
                {RELATIONSHIPS.map((rel) => (
                  <button
                    key={rel}
                    onClick={() => {
                      setParams(rel === "romantic" ? {} : { as: rel }, { replace: true });
                      track("pair_type_relationship_switch", { id: row.id, relationship: rel });
                    }}
                    aria-pressed={rel === relationship}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
                      rel === relationship
                        ? "border-foreground/20 bg-muted font-medium text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {RELATIONSHIP_LABELS[rel]}
                  </button>
                ))}
              </div>

              <div className="mt-12 rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
                <h2 className="text-[22px] font-medium tracking-tight sm:text-[26px]">
                  Is this your pair type?
                </h2>
                <p className="mx-auto mt-2 max-w-[460px] text-[15px] leading-relaxed text-muted-foreground">
                  Paste a real conversation and we&apos;ll read what&apos;s actually going on — and
                  tell you which of the 13 types you are.
                </p>
                <Button
                  asChild
                  size="lg"
                  className="mt-6"
                  onClick={() => track("pair_type_cta_click", { id: row.id, relationship })}
                >
                  <Link to="/">Read my chat</Link>
                </Button>
              </div>

              {others.length > 0 && (
                <div className="mt-14">
                  <h2 className="text-[18px] font-medium tracking-tight">More pair types</h2>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {others.map((o) => {
                      const of_ = fieldsFor(o, relationship);
                      return (
                        <Link
                          key={o.id}
                          to={`/types/${SLUG_BY_ID[o.id]}${relationship === "romantic" ? "" : `?as=${relationship}`}`}
                          className="rounded-2xl border border-border p-5 transition-transform hover:-translate-y-0.5"
                          style={{ backgroundColor: o.background_color, color: o.text_color }}
                        >
                          <div className="text-[16px] font-medium">{of_.name}</div>
                          <div className="mt-1 text-[13px] italic opacity-80">{of_.tagline}</div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default PairTypeDetail;
