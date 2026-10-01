/**
 * One shared button style for first-party pricing controls (Prism theme):
 * violet gradient with dark midnight text, a soft glow, and a small hover
 * lift on fine-pointer devices only. Reduced motion disables movement;
 * disabled buttons lose the glow so they never look clickable.
 */
export const PRICING_BTN =
  "inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-prism-violet to-prism-lavender px-5 py-2.5 text-[15px] font-semibold text-background shadow-glow-violet transition-[transform,filter] [transition-duration:160ms] ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-px [@media(hover:hover)_and_(pointer:fine)]:hover:brightness-110 active:!translate-y-0 motion-reduce:transition-none motion-reduce:[@media(hover:hover)_and_(pointer:fine)]:hover:!translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none [&_svg]:text-background";
