import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import * as htmlToImage from "html-to-image";
import { Check, Download, Loader2, Share2 } from "lucide-react";
import logoUrl from "@/assets/logo.png";
import { Footer } from "@/components/chemistry/Footer";
import { Header } from "@/components/chemistry/Header";
import { DecorativeElement } from "@/components/chemistry/DecorativeElement";
import {
  PairTypeShareCard,
  SHARE_SIZES,
  type ShareFormat,
} from "@/components/pairtype/PairTypeShareCard";
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
  SLUG_BY_ID,
  pairTypePath,
  pairTypeUrl,
  RELATIONSHIP_BY_SEGMENT,
  RELATIONSHIPS,
  RELATIONSHIP_LABELS,

  type PairTypeRow,
  type RelationshipType,
} from "@/lib/pairTypes";


/** Fetch a remote image and inline it as a data URL (avoids canvas CORS taint). */
const toDataUrl = async (url: string): Promise<string | null> => {
  try {
    const res = await fetch(url, { mode: "cors", cache: "no-cache" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

const hexToRgba = (hex: string, alpha: number) => {
  const v = hex.replace("#", "");
  const full = v.length === 3 ? v.split("").map((c) => c + c).join("") : v;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const PairTypeDetail = () => {
  const { slug = "", category = "" } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const relParam = params.get("as");
  // Category comes from the URL path, so a fresh browser hitting a Family
  // link renders Family straight away — no stored state involved.
  const relationship: RelationshipType =
    RELATIONSHIP_BY_SEGMENT[category] ?? (isRelationship(relParam) ? relParam : "romantic");
  const id = ID_BY_SLUG[slug];


  const [row, setRow] = useState<PairTypeRow | null>(null);
  const [others, setOthers] = useState<PairTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [imgFailed, setImgFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busyFormat, setBusyFormat] = useState<ShareFormat | null>(null);
  const shareRef = useRef<HTMLDivElement>(null);
  const [renderFormat, setRenderFormat] = useState<ShareFormat | null>(null);
  const [shareArt, setShareArt] = useState<{ image: string | null; logo: string | null }>({
    image: null,
    logo: null,
  });

  useEffect(() => {
    if (!id) {
      navigate("/types", { replace: true });
      return;
    }
    // Unknown category segment, or a retired slug alias → canonical URL.
    if (!RELATIONSHIP_BY_SEGMENT[category] || SLUG_BY_ID[id] !== slug) {
      navigate(pairTypePath(id, relationship), { replace: true });
      return;
    }


    let cancelled = false;
    setLoading(true);
    setImgFailed(false);
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
  }, [id, navigate, category, relationship]);

  useEffect(() => {
    if (id) track("pair_type_page_viewed", { id, relationship });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, relationship]);

  useEffect(() => setImgFailed(false), [relationship]);

  const f = row ? fieldsFor(row, relationship) : null;
  const canonical = id ? pairTypeUrl(id, relationship) : "https://betweenthelines.app/types";
  // Public page URL only — never a report id or anything personal.
  const shareUrl = canonical;


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

  const handleShare = useCallback(async () => {
    if (!row || !f) return;
    const nav = navigator as Navigator;
    const text = `${f.name} — ${f.tagline}`;
    if (typeof nav.share === "function") {
      try {
        await nav.share({ title: `${f.name} — BetweenTheLines™`, text, url: shareUrl });
        track("pair_type_share_click", { id: row.id, relationship, method: "web_share" });
        return;
      } catch {
        // fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      track("pair_type_share_click", { id: row.id, relationship, method: "copy_link" });
    } catch {
      // clipboard unavailable — nothing else we can do silently
    }
  }, [row, f, relationship, shareUrl]);

  const handleDownload = useCallback(
    async (format: ShareFormat) => {
      if (!row || !f || busyFormat) return;
      setBusyFormat(format);
      try {
        const [image, logo] = await Promise.all([
          f.image ? toDataUrl(f.image) : Promise.resolve(null),
          toDataUrl(logoUrl),
        ]);
        setShareArt({ image, logo });
        setRenderFormat(format);
        // Let the offscreen card mount and decode its inlined artwork.
        await new Promise((r) => window.setTimeout(r, 300));
        const node = shareRef.current;
        if (!node) return;
        const { width, height } = SHARE_SIZES[format];
        const dataUrl = await htmlToImage.toPng(node, {
          width,
          height,
          pixelRatio: 1,
          cacheBust: true,
        });
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `betweenthelines-${slug}-${relationship}-${format === "story" ? "9x16" : "1x1"}.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        track("pair_type_image_download", { id: row.id, relationship, format });
      } catch (e) {
        console.warn("pair type image export failed", e);
      } finally {
        setBusyFormat(null);
        setRenderFormat(null);
      }
    },
    [row, f, busyFormat, relationship, slug],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>
          {f
            ? `${f.name} — ${RELATIONSHIP_LABELS[relationship]} pair type | BetweenTheLines™`
            : "Pair type — BetweenTheLines™"}
        </title>
        <meta
          name="description"
          content={
            f
              ? `${f.tagline} What ${f.name} looks like in ${RELATIONSHIP_LABELS[relationship].toLowerCase()} messages — its superpower, where it gets stuck, and what helps.`
              : "Explore the BetweenTheLines pair types."
          }
        />
        <link rel="canonical" href={canonical} />
        <meta
          property="og:title"
          content={
            f ? `${f.name} — ${RELATIONSHIP_LABELS[relationship]} | BetweenTheLines™` : "BetweenTheLines™"
          }
        />
        <meta property="og:description" content={f?.tagline ?? ""} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="article" />
        {f?.image && <meta property="og:image" content={f.image} />}
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content={
            f ? `${f.name} — ${RELATIONSHIP_LABELS[relationship]} | BetweenTheLines™` : "BetweenTheLines™"
          }
        />
        <meta name="twitter:description" content={f?.tagline ?? ""} />
        {f?.image && <meta name="twitter:image" content={f.image} />}
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
                <div className="mx-auto mt-8 w-full max-w-[420px] overflow-visible rounded-[16px]">
                  {f.image && !imgFailed ? (
                    <img
                      src={f.image}
                      alt={`${f.name} illustration`}
                      className="block h-auto w-full rounded-[16px]"
                      loading="eager"
                      onError={() => setImgFailed(true)}
                    />
                  ) : (
                    <div
                      className="flex aspect-[3/4] w-full items-center justify-center rounded-[16px] px-6 text-center text-[18px] font-medium"
                      style={{ backgroundColor: hexToRgba(row.text_color, 0.08) }}
                    >
                      {f.name}
                    </div>
                  )}
                </div>

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
                  <Link
                    key={rel}
                    to={pairTypePath(row.id, rel)}
                    onClick={() =>
                      track("pair_type_relationship_switch", { id: row.id, relationship: rel })
                    }
                    aria-current={rel === relationship ? "page" : undefined}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      rel === relationship
                        ? "border-foreground/20 bg-muted font-medium text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {RELATIONSHIP_LABELS[rel]}
                  </Link>
                ))}

              </div>

              {/* Share this pair type — public page only, nothing personal */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleShare}>
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" /> Link copied
                    </>
                  ) : (
                    <>
                      <Share2 className="h-4 w-4" /> Share this type
                    </>
                  )}
                </Button>
                {(["square", "story"] as ShareFormat[]).map((fmt) => (
                  <Button
                    key={fmt}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busyFormat !== null}
                    onClick={() => handleDownload(fmt)}
                  >
                    {busyFormat === fmt ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {SHARE_SIZES[fmt].label} image
                  </Button>
                ))}
              </div>

              <div className="mt-12 grid gap-4 sm:grid-cols-2">
                {f.friction && (
                  <section className="rounded-2xl border border-border bg-card p-6">
                    <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Where it gets stuck
                    </h2>
                    <p className="mt-3 text-[15px] leading-relaxed">{f.friction}</p>
                  </section>
                )}
                {f.advice && (
                  <section className="rounded-2xl border border-border bg-card p-6">
                    <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      What helps
                    </h2>
                    <p className="mt-3 text-[15px] leading-relaxed">{f.advice}</p>
                  </section>
                )}
              </div>

              {f.examples.length > 0 && (
                <section className="mt-4 rounded-2xl border border-border bg-card p-6">
                  <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    You&apos;ll recognise this if…
                  </h2>
                  <ul className="mt-3 space-y-2">
                    {f.examples.map((ex) => (
                      <li key={ex} className="flex gap-2 text-[15px] leading-relaxed">
                        <span aria-hidden className="text-muted-foreground">
                          •
                        </span>
                        <span>{ex}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

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
                  <Link to="/#input-section">Read my chat</Link>
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
                          to={pairTypePath(o.id, relationship)}
                          className="rounded-2xl border border-border p-5 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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

        {/* Offscreen render target for downloadable share images */}
        {row && renderFormat && (
          <div
            aria-hidden
            style={{ position: "fixed", left: -20000, top: 0, pointerEvents: "none" }}
          >
            <PairTypeShareCard
              ref={shareRef}
              row={row}
              relationship={relationship}
              format={renderFormat}
              imageDataUrl={shareArt.image}
              logoDataUrl={shareArt.logo}
            />
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default PairTypeDetail;
