import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/chemistry/Header";
import { Footer } from "@/components/chemistry/Footer";
import type { AnalysisResult } from "@/lib/analysis-types";

type AnalysisRow = {
  id: string;
  created_at: string;
  status: string;
  result_json: AnalysisResult | null;
};

const Account = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [rows, setRows] = useState<AnalysisRow[] | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("analyses")
        .select("id, created_at, status, result_json")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setRows((data ?? []) as AnalysisRow[]);
    })();
  }, [user]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-5 py-12 sm:px-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-medium tracking-tight">Your reports</h1>
            <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
          </div>
          <Button variant="outline" onClick={() => signOut().then(() => navigate("/"))}>
            Sign out
          </Button>
        </div>

        {rows === null ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">No reports yet.</p>
            <Link
              to="/#input-section"
              className="mt-4 inline-flex rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background"
            >
              Run your first analysis
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((r) => {
              const score = r.result_json?.headline?.score;
              const tier = r.result_json?.headline?.tier_label;
              return (
                <li key={r.id}>
                  <Link
                    to={`/report/${r.id}`}
                    className="flex items-center justify-between rounded-xl border border-border p-4 transition-colors hover:bg-muted/40"
                  >
                    <div>
                      <div className="text-sm font-medium">
                        {tier ?? (r.status === "complete" ? "Report" : r.status)}
                        {typeof score === "number" && (
                          <span className="ml-2 text-muted-foreground">{score}/100</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">View →</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Account;