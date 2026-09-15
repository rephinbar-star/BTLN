import { forwardRef } from "react";
import { GROUP_CATEGORY_LABEL, type GroupCategory } from "@/lib/group/types";

type OverallProps = {
  title: string;
  subtitle: string;
  category: GroupCategory;
  roles: { label: string; role: string }[];
  participantCount: number;
};

/** 9:16 overall group card. Contains no raw conversation text. */
export const GroupOverallCard = forwardRef<HTMLDivElement, OverallProps>(
  ({ title, subtitle, category, roles, participantCount }, ref) => (
    <div
      ref={ref}
      style={{ width: 1080, height: 1920 }}
      className="flex flex-col justify-between bg-card p-20 text-foreground"
    >
      <div>
        <p className="text-[34px] uppercase tracking-[0.3em] text-muted-foreground">
          Group Read · {GROUP_CATEGORY_LABEL[category]}
        </p>
        <h2 className="mt-10 text-[86px] font-medium leading-[1.05] tracking-tight">{title}</h2>
        <p className="mt-10 text-[40px] leading-relaxed text-muted-foreground">{subtitle}</p>
      </div>

      <ul className="space-y-8">
        {roles.slice(0, 8).map((r, i) => (
          <li
            key={`${r.label}-${i}`}
            className="flex items-center justify-between gap-8 rounded-3xl border border-border px-10 py-8"
          >
            <span className="text-[42px] font-medium">{r.label}</span>
            <span className="text-[38px] text-muted-foreground">{r.role}</span>
          </li>
        ))}
      </ul>

      <div>
        <p className="text-[36px] text-muted-foreground">
          {participantCount} people · What's your group?
        </p>
        <p className="mt-4 text-[44px] font-medium">betweenthelines.app</p>
      </div>
    </div>
  ),
);
GroupOverallCard.displayName = "GroupOverallCard";

type RoleProps = {
  label: string;
  role: string;
  headline: string;
  category: GroupCategory;
};

/** 1080×1080 single role card. */
export const GroupRoleShareCard = forwardRef<HTMLDivElement, RoleProps>(
  ({ label, role, headline, category }, ref) => (
    <div
      ref={ref}
      style={{ width: 1080, height: 1080 }}
      className="flex flex-col justify-between bg-card p-20 text-foreground"
    >
      <p className="text-[32px] uppercase tracking-[0.3em] text-muted-foreground">
        Group Read · {GROUP_CATEGORY_LABEL[category]}
      </p>
      <div>
        <p className="text-[44px] text-muted-foreground">{label} is the</p>
        <h2 className="mt-6 text-[104px] font-medium leading-[1.02] tracking-tight">{role}</h2>
        <p className="mt-10 text-[42px] leading-relaxed text-muted-foreground">{headline}</p>
      </div>
      <p className="text-[40px] font-medium">betweenthelines.app</p>
    </div>
  ),
);
GroupRoleShareCard.displayName = "GroupRoleShareCard";
