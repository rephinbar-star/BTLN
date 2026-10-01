---
name: Spectral Decryption
colors:
  surface: '#11131b'
  surface-dim: '#11131b'
  surface-bright: '#373942'
  surface-container-lowest: '#0c0e16'
  surface-container-low: '#191b24'
  surface-container: '#1d1f28'
  surface-container-high: '#282a33'
  surface-container-highest: '#32343e'
  on-surface: '#e1e1ee'
  on-surface-variant: '#cbc3d7'
  inverse-surface: '#e1e1ee'
  inverse-on-surface: '#2e3039'
  outline: '#958ea0'
  outline-variant: '#494454'
  surface-tint: '#d0bcff'
  primary: '#d0bcff'
  on-primary: '#3c0091'
  primary-container: '#a078ff'
  on-primary-container: '#340080'
  inverse-primary: '#6d3bd7'
  secondary: '#ffb2b7'
  on-secondary: '#67001b'
  secondary-container: '#b50036'
  on-secondary-container: '#ffc2c4'
  tertiary: '#ffb95f'
  on-tertiary: '#472a00'
  tertiary-container: '#ca8100'
  on-tertiary-container: '#3e2400'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e9ddff'
  primary-fixed-dim: '#d0bcff'
  on-primary-fixed: '#23005c'
  on-primary-fixed-variant: '#5516be'
  secondary-fixed: '#ffdadb'
  secondary-fixed-dim: '#ffb2b7'
  on-secondary-fixed: '#40000d'
  on-secondary-fixed-variant: '#92002a'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#11131b'
  on-background: '#e1e1ee'
  surface-variant: '#32343e'
  midnight: '#080a12'
  obsidian: '#0d111d'
  obsidian-card: '#131728'
  obsidian-elevated: '#1a2035'
  violet-glow: '#8b5cf6'
  coral-glow: '#f43f5e'
  amber-glow: '#f59e0b'
  emerald-glow: '#10b981'
  text-primary: '#edf2f7'
  text-secondary: '#94a3b8'
  border-subtle: rgba(255, 255, 255, 0.08)
typography:
  headline-lg:
    fontFamily: Syne
    fontSize: 28px
    fontWeight: '800'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Syne
    fontSize: 17px
    fontWeight: '700'
    lineHeight: 22px
    letterSpacing: -0.01em
  title-sm:
    fontFamily: Syne
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 18px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 17px
  body-quote:
    fontFamily: Newsreader
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: '0'
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.08em
  label-code:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 12px
    letterSpacing: 0.05em
  label-micro:
    fontFamily: JetBrains Mono
    fontSize: 9px
    fontWeight: '500'
    lineHeight: 11px
    letterSpacing: 0.2em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 0.625rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.875rem
  space-lg: 1.25rem
  space-xl: 1.5rem
---

## Brand & Style
BetweenTheLines is an interpersonal psychological intelligence tool designed to decode subtle emotional subtexts, micro-tensions, and hidden motives in communication. The aesthetic balances deep-space cyberpunk telemetry with hyper-refined editorial precision—merging **Glassmorphism**, **Kinetic Glow**, and futuristic cyber-noir utility.

The atmosphere is dark, intimate, and cryptographic: users feel like they are operating an advanced emotional radar or neural prism. High-translucency obsidian materials, chromatic diffraction glows (violet, rose, amber, emerald), and pinpoint monospaced telemetry sit comfortably beside bold, avant-garde typography.

## Colors
The palette is built upon a profound void base (`#080a12` Midnight and `#131728` Obsidian Card) overlaid with four distinctive spectral frequency channels:

- **Truth Channel (Primary - Violet `#8B5CF6`):** Dedicated to core deconstructions, psychological insight, and analytical calibration.
- **Shield Mode (Secondary - Rose/Coral `#F43F5E`):** Represents emotional defense, passive-aggression deflection, and hardened boundaries.
- **Chemistry Gauge (Tertiary - Amber `#F59E0B`):** Measures playful friction, flirtation signals, and attraction dynamics.
- **Attachment Decryptor (Quaternary - Emerald `#10B981`):** Applied to relational security, avoidant/anxious dynamics, and cryptographic verification badges.

Text follows high-legibility slate tiers, grounding intense colored glows with neutral `#EDF2F7` (primary titles) and `#94A3B8` (analytical commentary).

## Typography
Typography creates a sharp triad between human expression and automated intelligence:
- **Display / Headers (Syne):** Sculptural, geometric, and unapologetically bold. Gives structural weight to macro headings and primary identifiers.
- **Body & Dialogue (Plus Jakarta Sans & Newsreader):** Jakarta Sans provides ultra-clean humanistic clarity for descriptions and UI copy. For literal quotation inputs (messages undergoing analysis), an italicized literary serif (`Newsreader`) is introduced to isolate the raw human voice from the system's machine telemetry.
- **Telemetry & Labels (JetBrains Mono):** Applied to badges, accuracy ratios, engine metrics, timestamps, and confidence outputs to reinforce precision and cryptographic security.

## Layout & Spacing
The layout follows a mobile-first, single-column command terminal pattern constrained to a maximum width of `512px` (32rem) centered in view.
- **Rhythm & Safe Insets:** Native top and bottom notches are protected by `pt-safe` and `pb-safe`. Floating fixed navigation frames (top bar at 64px, bottom nav at 64px) necessitate an 80px top padding and 112px bottom padding on the main viewport.
- **Grid Structure:** Section items utilize 2-column symmetric grids (`gap-2.5`) for compact selector matrices and action modules.
- **Vertical Spacing:** Modules stack with a strict 24px (`space-y-6`) gap, while internal card components maintain an 8px to 14px spatial interval.

## Elevation & Depth
Depth in this system is driven by darkness hierarchy, glassmorphism, and colored photonic blooms rather than traditional drop shadows:

1. **Base Plate (Level 0):** Pure abyssal `#080a12`, illuminated only by a diffuse fixed radial gradient (`aurora-blur`) at the top edge emitting soft violet (`rgba(139, 92, 246, 0.18)`) and rose (`rgba(244, 63, 94, 0.08)`).
2. **Surface Panels (Level 1):** `#131728` with thin, low-contrast ghost borders (`rgba(255, 255, 255, 0.08)`).
3. **Elevated Elements (Level 2):** `#1a2035` framed with `backdrop-blur-xl` and nested bevel insets (`inset 0 1px 1px 0 rgba(255, 255, 255, 0.2)`).
4. **Photonic Lens Glows:** Active interactables emit 25px outer radiance tuned to their lens frequency (e.g. `0 0 25px -4px rgba(139, 92, 246, 0.5)` for Truth, coral for Shield, etc.).
5. **Fixed Glass Rails:** Top header and bottom dock use 80-85% alpha midnight fills with heavy `backdrop-blur-2xl` and a subtle 1px divider.

## Shapes
The design embraces a modern rounded geometry balanced by tech-forward contours:
- **Standard Cards & Containers:** `rounded-2xl` (1rem / 16px) for tactile, palm-friendly card modules.
- **Interactive Action Elements:** `rounded-xl` (0.75rem / 12px) on buttons, icon badges, and simulated message containers.
- **System Badges & Telemetry Pills:** Full pill contour (`rounded-full`) to clearly demarcate status readouts, confidence indexes, and tags from interactive surfaces.
- **Divider Strokes:** Extremely crisp 1px borders with translucencies ranging between 6% and 12% white.

## Components

### Buttons & Action Triggers
- **Primary Kinetic Action:** Solid vibrant gradient (e.g., `from-violet-600 to-indigo-600`) accompanied by an outer photonic shadow (`0 0 20px rgba(139, 92, 246, 0.35)`), active scale feedback (`scale-95`), and uppercase/medium weight typography.
- **Secondary Glass Trigger:** Translucent fill (`rgba(255, 255, 255, 0.07)`), soft border (`rgba(255, 255, 255, 0.1)`), and highlighted icon accents.

### Lens Selector Cards
- Bipartite micro-dashboard cards featuring an icon chamber, status pill, bold title, and two-line micro-copy.
- Selected state activates a 1px colored border matching the lens type, inner top bevel light, and ambient outer glow. Unselected states sit in quiet obsidian with hover transitions.

### Simulator & Output Console
- **Chat Quotation Bubble:** Inset dark terminal with delicate white borders (`border-white/[0.07]`) holding high-contrast serif italic text.
- **Barometric Progress Indicators:** Track containers with subtle slate backing (`bg-white/[0.06]`, height 6px) filled with rounded horizontal kinetic gradient fills reflecting intensity.
- **Tactical Action Banner:** High-contrast tint panel matching the active lens hue (e.g., `bg-violet-950/30 border-violet-500/25`) with a 1-tap quick copy trigger.

### Range / Calibration Slider
- Minimalist track (`h-1.5 bg-slate-800`), accent-colored thumb (`18px` diameter) equipped with an energetic outer glow (`0 0 10px rgba(139, 92, 246, 0.8)`) and high-contrast center.

### Navigation Dock
- Floating 5-slot bottom bar with translucent background, micro mono labels (`10px`), and illuminated icon pods with soft ambient squares behind active states.
