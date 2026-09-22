/**
 * One shared button style for every first-party control on the pricing
 * surfaces: logo dark green background (#183B35, btln-ink) with white
 * (#FFFFFF) text/icons, a subtle shadow and a small hover lift on
 * hover-capable fine-pointer devices only. prefers-reduced-motion disables
 * the movement; disabled buttons keep no shadow so they never look clickable.
 */
export const PRICING_BTN =
  "inline-flex min-h-11 w-full items-center justify-center rounded-full bg-btln-ink px-5 py-2.5 text-[15px] font-medium text-white shadow-[0_2px_5px_rgba(24,59,53,0.15)] transition-[transform,box-shadow] [transition-duration:160ms] ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-px [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[0_5px_12px_rgba(24,59,53,0.22)] active:!translate-y-0 active:!shadow-[0_1px_3px_rgba(24,59,53,0.15)] motion-reduce:transition-none motion-reduce:[@media(hover:hover)_and_(pointer:fine)]:hover:!translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-btln-ink focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none [&_svg]:text-white";
