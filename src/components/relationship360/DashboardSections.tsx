import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

/** Presentation shared by fictional examples and source-backed account summaries. */
export function DashboardScope({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return <div className="flex gap-2 overflow-x-auto py-2" role="group" aria-label="Relationship scope">{options.map((option) => <Button key={option.value} type="button" variant={value === option.value ? "secondary" : "outline"} aria-pressed={value === option.value} onClick={() => onChange(option.value)} className="min-h-11 shrink-0 rounded-full">{option.label}</Button>)}</div>;
}
export function DashboardPanel({ heading, children, className = "" }: { heading: string; children: ReactNode; className?: string }) {
  return <section className={`min-w-0 rounded-lg border border-border bg-card p-4 sm:p-5 ${className}`}><h2 className="font-display text-lg font-bold">{heading}</h2><div className="mt-3 min-w-0 text-sm leading-relaxed">{children}</div></section>;
}
export function DashboardPattern({ title, statement, sources, children }: { title: string; statement: string; sources: { id: string; label: string; date?: string; href?: string }[]; children?: ReactNode }) {
  return <DashboardPanel heading="What keeps showing up"><h3 className="font-semibold text-prism-lavender">{title}</h3><p className="mt-2 text-muted-foreground">{statement}</p><p className="mt-4 text-xs text-muted-foreground">{sources.length ? `Supported by ${sources.length} included read${sources.length === 1 ? "" : "s"} with explicit references` : "Source incidence is not established for this pattern."}</p>{sources.length > 0 && <ul className="mt-2 grid gap-2 sm:grid-cols-3">{sources.slice(0, 3).map((source) => <li key={source.id} className="min-w-0 rounded-md border border-border bg-muted/30 p-2 text-xs">{source.href ? <Link to={source.href} className="block min-h-11 content-center break-words underline underline-offset-4">{source.label}</Link> : <span className="block break-words">{source.label}</span>}{source.date && <span className="block text-muted-foreground">{source.date}</span>}</li>)}</ul>}{children}</DashboardPanel>;
}
export function AddReadLinks({ className = "" }: { className?: string }) {
  return <div className={className}><h2 className="font-display text-lg font-bold">Add a conversation</h2><p className="mt-1 text-sm text-muted-foreground">A completed saved read with your identity confirmed can join your profile.</p><div className="mt-3 grid gap-2 sm:grid-cols-3"><Button asChild variant="outline" className="min-h-11"><Link to="/quick?from=relationship360">Quick Take</Link></Button><Button asChild variant="outline" className="min-h-11"><Link to="/deep?from=relationship360">Deep Read</Link></Button><Button asChild variant="outline" className="min-h-11"><Link to="/group-roast?from=relationship360">Group Roast</Link></Button></div></div>;
}
