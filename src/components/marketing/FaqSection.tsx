import type { FaqItem } from "@/lib/seo/faqs";

export function FaqSection({ items }: { items: FaqItem[] }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-medium">Frequently asked questions</h2>
      <div className="mt-4 space-y-6">
        {items.map((item) => (
          <div key={item.question}>
            <h3 className="text-[16px] font-medium">{item.question}</h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">{item.answer}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
