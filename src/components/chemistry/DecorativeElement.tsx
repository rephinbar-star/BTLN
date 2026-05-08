import type { FC, ReactNode } from "react";

type Props = {
  type: string;
  color?: string;
};

const Corner = ({ children, position }: { children: ReactNode; position: string }) => (
  <span
    aria-hidden
    className={`pointer-events-none absolute ${position} opacity-70`}
  >
    {children}
  </span>
);

const SVG_BY_TYPE: Record<string, (color: string) => ReactNode> = {
  hearts_sparkles: (c) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={c}>
      <path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" />
    </svg>
  ),
  stars: (c) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={c}>
      <path d="M12 2l2.39 6.95H22l-5.8 4.21 2.2 6.84L12 15.77l-6.4 4.23 2.2-6.84L2 8.95h7.61z" />
    </svg>
  ),
  flames_lightning: (c) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={c}>
      <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  ),
  circles: (c) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={c}>
      <circle cx="12" cy="12" r="10" />
    </svg>
  ),
  leaves: (c) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={c}>
      <path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3C7 19.5 8 19 9 19c5 0 8-4 9-12 0-1-1-1-1 1z" />
    </svg>
  ),
};

/**
 * Renders 4 small SVG icons in the corners of the parent container.
 * Parent must be `position: relative`.
 */
export const DecorativeElement: FC<Props> = ({ type, color = "currentColor" }) => {
  const renderer = SVG_BY_TYPE[type] ?? SVG_BY_TYPE.circles;
  const icon = renderer(color);
  return (
    <>
      <Corner position="top-4 left-4">{icon}</Corner>
      <Corner position="top-4 right-4">{icon}</Corner>
      <Corner position="bottom-4 left-4">{icon}</Corner>
      <Corner position="bottom-4 right-4">{icon}</Corner>
    </>
  );
};