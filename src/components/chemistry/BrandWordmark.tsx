import { cn } from "@/lib/utils";

type BrandWordmarkProps = {
  className?: string;
};

export const BrandWordmark = ({ className }: BrandWordmarkProps) => (
  <span
    aria-label="BetweenTheLines"
    style={{ fontFeatureSettings: '"ss01", "cv11"' }}
    className={cn(
      "inline-flex whitespace-nowrap font-wordmark text-[17px] font-bold tracking-[-0.7px] text-btln-wordmark",
      className,
    )}
  >
    <span aria-hidden="true">Between</span>
    <span aria-hidden="true" className="text-btln-wordmark-accent">The</span>
    <span aria-hidden="true">Lines</span>
  </span>
);