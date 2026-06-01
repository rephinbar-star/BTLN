import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const ADMIN_AUTH_KEY = "chemistry_admin_authed";
const BUCKET = "couple_types";
const RELATIONSHIPS = ["romantic", "friend", "family"] as const;
type Relationship = (typeof RELATIONSHIPS)[number];

// Maps the numeric type id (1..13) to the slug used inside filenames.
const slugToId: Record<string, number> = {
  power_couple: 1,
  steady_anchors: 2,
  slow_burners: 3,
  deep_feelers: 4,
  independent_duo: 5,
  magnet_moon: 6,
  support_system: 7,
  builders: 8,
  duet: 9,
  brave_duo: 10,
  solo_climbers: 11,
  quiet_companions: 12,
  fire_pair: 13,
};

type CoupleTypeRow = {
  id: number;
  romantic_name: string;
  friend_name: string;
  family_name: string;
  image_url_romantic: string | null;
  image_url_friend: string | null;
  image_url_family: string | null;
};

type UploadResult = {
  filename: string;
  status: "success" | "failed" | "skipped";
  reason?: string;
  publicUrl?: string;
};

const FILENAME_RE = /^t(\d{2})_([a-z_]+)_(romantic|friend|family)\.(png|jpe?g|webp)$/i;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const publicUrlFor = (filename: string) =>
  `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filename}`;

const AdminCards = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<CoupleTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [replaceMode, setReplaceMode] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sessionStorage.getItem(ADMIN_AUTH_KEY) !== "true") {
      navigate(`/admin?return_to=${encodeURIComponent("/admin/cards")}`, { replace: true });
    }
  }, [navigate]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("couple_types")
      .select(
        "id, romantic_name, friend_name, family_name, image_url_romantic, image_url_friend, image_url_family",
      )
      .order("id");
    setRows((data ?? []) as CoupleTypeRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const rowsById = useMemo(() => {
    const m = new Map<number, CoupleTypeRow>();
    rows.forEach((r) => m.set(r.id, r));
    return m;
  }, [rows]);

  const filledCount = rows.reduce(
    (n, r) =>
      n +
      (r.image_url_romantic ? 1 : 0) +
      (r.image_url_friend ? 1 : 0) +
      (r.image_url_family ? 1 : 0),
    0,
  );

  const processFiles = async (files: File[]) => {
    setUploading(true);
    const out: UploadResult[] = [];

    for (const file of files) {
      const filename = file.name;
      const m = filename.match(FILENAME_RE);
      if (!m) {
        out.push({ filename, status: "failed", reason: "Invalid filename pattern" });
        continue;
      }
      const [, numStr, slug, relRaw] = m;
      const typeNumber = parseInt(numStr, 10);
      const relationship = relRaw.toLowerCase() as Relationship;
      const slugId = slugToId[slug.toLowerCase()];
      const row = rowsById.get(typeNumber);

      if (!row) {
        out.push({
          filename,
          status: "failed",
          reason: `No couple_types row for type_number ${numStr}`,
        });
        continue;
      }
      if (slugId && slugId !== typeNumber) {
        out.push({
          filename,
          status: "failed",
          reason: `Slug "${slug}" does not match type_number ${numStr}`,
        });
        continue;
      }

      const existingUrl =
        relationship === "romantic"
          ? row.image_url_romantic
          : relationship === "friend"
            ? row.image_url_friend
            : row.image_url_family;

      if (existingUrl && !replaceMode) {
        out.push({
          filename,
          status: "skipped",
          reason: "Already uploaded (enable Replace mode to overwrite)",
        });
        continue;
      }

      const upload = await supabase.storage
        .from(BUCKET)
        .upload(filename, file, { upsert: true, contentType: file.type });

      if (upload.error) {
        out.push({ filename, status: "failed", reason: upload.error.message });
        continue;
      }

      const publicUrl = publicUrlFor(filename);
      const updateCol = `image_url_${relationship}` as const;
      const { error: updateErr } = await supabase
        .from("couple_types")
        .update({ [updateCol]: publicUrl })
        .eq("id", typeNumber);

      if (updateErr) {
        out.push({ filename, status: "failed", reason: `DB update: ${updateErr.message}` });
        continue;
      }

      out.push({ filename, status: "success", publicUrl });
    }

    setResults(out);
    setUploading(false);
    await loadRows();
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    void processFiles(Array.from(fileList));
  };

  const succeeded = results.filter((r) => r.status === "success");
  const failed = results.filter((r) => r.status === "failed");
  const skipped = results.filter((r) => r.status === "skipped");

  const cellUrl = (row: CoupleTypeRow | undefined, rel: Relationship) => {
    if (!row) return null;
    return rel === "romantic"
      ? row.image_url_romantic
      : rel === "friend"
        ? row.image_url_friend
        : row.image_url_family;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl space-y-8 px-5 py-8 sm:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Card uploads</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload the 39 couple-type illustrations. Filenames must follow the pattern{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                t{"{NN}"}_{"{type_slug}"}_{"{relationship_type}"}.png
              </code>
              .
            </p>
          </div>
          <Link to="/admin" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            ← Back to dashboard
          </Link>
        </header>

        <div className="flex items-center gap-3 rounded-md border border-border bg-card p-4">
          <Switch id="replace-mode" checked={replaceMode} onCheckedChange={setReplaceMode} />
          <Label htmlFor="replace-mode" className="cursor-pointer">
            Replace mode {replaceMode ? "ON (overwrites existing)" : "OFF (skips already uploaded)"}
          </Label>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center transition-colors",
            dragOver ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/40",
            uploading && "pointer-events-none opacity-60",
          )}
        >
          <p className="text-base font-medium">
            {uploading ? "Uploading…" : "Drop PNG / JPG / WebP files here"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            or click to browse — multiple files supported
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {/* Results summary */}
        {results.length > 0 && (
          <Card>
            <CardContent className="space-y-3 p-5">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span className="font-medium">Last batch:</span>
                <span>Total {results.length}</span>
                <span className="text-emerald-600">✓ {succeeded.length} succeeded</span>
                {skipped.length > 0 && (
                  <span className="text-muted-foreground">↺ {skipped.length} skipped</span>
                )}
                {failed.length > 0 && (
                  <span className="text-destructive">✗ {failed.length} failed</span>
                )}
              </div>
              <ul className="max-h-60 overflow-y-auto rounded-md border border-border bg-muted/30 p-3 text-xs">
                {results.map((r) => (
                  <li
                    key={r.filename}
                    className={cn(
                      "py-0.5",
                      r.status === "success" && "text-emerald-700",
                      r.status === "failed" && "text-destructive",
                      r.status === "skipped" && "text-muted-foreground",
                    )}
                  >
                    {r.status === "success" ? "✓" : r.status === "skipped" ? "↺" : "✗"}{" "}
                    <span className="font-mono">{r.filename}</span>
                    {r.reason ? ` — ${r.reason}` : ""}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Status grid */}
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">
              Status — {filledCount} / 39 uploaded
            </h2>
            <Button size="sm" variant="outline" onClick={() => void loadRows()} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="p-3">#</th>
                    <th className="p-3">Type</th>
                    {RELATIONSHIPS.map((rel) => (
                      <th key={rel} className="p-3 text-center capitalize">
                        {rel}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 13 }, (_, i) => i + 1).map((id) => {
                    const row = rowsById.get(id);
                    return (
                      <tr key={id} className="border-b border-border last:border-b-0">
                        <td className="p-3 font-mono text-xs text-muted-foreground">
                          {String(id).padStart(2, "0")}
                        </td>
                        <td className="p-3">{row?.romantic_name ?? "—"}</td>
                        {RELATIONSHIPS.map((rel) => {
                          const url = cellUrl(row, rel);
                          const fname = url ? url.split("/").pop() : "Missing";
                          return (
                            <td key={rel} className="p-3 text-center" title={fname ?? ""}>
                              {url ? (
                                <span className="text-emerald-600">✓</span>
                              ) : (
                                <span className="text-muted-foreground/50">✗</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
};

export default AdminCards;