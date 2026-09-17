import { forwardRef } from "react";
import { BrandWordmark } from "@/components/chemistry/BrandWordmark";
import type { GroupRoastRole } from "@/lib/groupRoast/types";

type Props = {
  format: "square" | "story";
  label: string;
  role: GroupRoastRole;
};

export const GroupRoastShareCard = forwardRef<HTMLDivElement, Props>(
  ({ format, label, role }, ref) => (
    <div
      ref={ref}
      style={{ width: 1080, height: format === "square" ? 1080 : 1920 }}
      className="flex flex-col justify-between overflow-hidden bg-btln-paper p-20 text-btln-ink"
    >
      <div>
        <BrandWordmark className="origin-top-left scale-[2]" />
        <p className="mt-20 text-[30px] font-semibold uppercase tracking-wider text-muted-foreground">
          Group Roast · {label}
        </p>
      </div>
      <div>
        <h2 className={format === "square" ? "text-[76px] font-semibold leading-tight" : "text-[94px] font-semibold leading-tight"}>
          {role.role}
        </h2>
        <p className="mt-8 text-[38px] leading-snug">{role.headline}</p>
        <p className="mt-8 text-[29px] leading-relaxed text-muted-foreground">
          {role.observed_behavior}
        </p>
        {role.evidence && (
          <p className="mt-8 border-l-4 border-btln-leaf pl-6 text-[27px] italic leading-relaxed text-muted-foreground">
            “{role.evidence}”
          </p>
        )}
      </div>
      <p className="text-[30px] text-muted-foreground">For group chats with 3 or more people · betweenthelines.app</p>
    </div>
  ),
);
GroupRoastShareCard.displayName = "GroupRoastShareCard";