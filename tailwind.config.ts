import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "-apple-system", "BlinkMacSystemFont", '"Segoe UI"', "system-ui", "sans-serif"],
        display: ["Syne", '"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        "glow-violet": "0 0 22px -6px hsl(var(--prism-violet) / 0.55)",
        "glow-emerald": "0 0 22px -6px hsl(var(--prism-emerald) / 0.5)",
        "glow-amber": "0 0 22px -6px hsl(var(--prism-amber) / 0.5)",
      },
      colors: {
        elevated: "hsl(var(--elevated) / <alpha-value>)",
        prism: {
          violet: "hsl(var(--prism-violet) / <alpha-value>)",
          cyan: "hsl(var(--prism-cyan) / <alpha-value>)",
          emerald: "hsl(var(--prism-emerald) / <alpha-value>)",
          "emerald-text": "hsl(var(--prism-emerald-text) / <alpha-value>)",
          amber: "hsl(var(--prism-amber) / <alpha-value>)",
          "amber-text": "hsl(var(--prism-amber-text) / <alpha-value>)",
          coral: "hsl(var(--prism-coral) / <alpha-value>)",
          lavender: "hsl(var(--prism-lavender) / <alpha-value>)",
        },
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        "section-soft": "hsl(var(--section-soft))",
        pastel: {
          "pink-bg": "hsl(var(--pastel-pink-bg))",
          "pink-fg": "hsl(var(--pastel-pink-fg))",
          "purple-bg": "hsl(var(--pastel-purple-bg))",
          "purple-fg": "hsl(var(--pastel-purple-fg))",
          "purple-fg-strong": "hsl(var(--pastel-purple-fg-strong))",
          "yellow-bg": "hsl(var(--pastel-yellow-bg))",
          "yellow-fg": "hsl(var(--pastel-yellow-fg))",
          "green-bg": "hsl(var(--pastel-green-bg))",
          "green-fg": "hsl(var(--pastel-green-fg))",
          "green-fg-strong": "hsl(var(--pastel-green-fg-strong))",
          "amber-bg": "hsl(var(--pastel-amber-bg))",
          "amber-fg": "hsl(var(--pastel-amber-fg))",
          "amber-fg-strong": "hsl(var(--pastel-amber-fg-strong))",
          "blue-bg": "hsl(var(--pastel-blue-bg))",
          "blue-fg": "hsl(var(--pastel-blue-fg))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          brand: "hsl(var(--accent-brand))",
          "brand-foreground": "hsl(var(--accent-brand-foreground))",
        },
        "olive-deep": "hsl(var(--olive-deep))",
        "sage-muted": "hsl(var(--sage-muted))",
        btln: {
          paper: "hsl(var(--btln-paper) / <alpha-value>)",
          ink: "hsl(var(--btln-ink) / <alpha-value>)",
          wordmark: "hsl(var(--btln-wordmark))",
          "wordmark-accent": "hsl(var(--btln-wordmark-accent))",
          muted: "hsl(var(--btln-muted) / <alpha-value>)",
          line: "hsl(var(--btln-line) / <alpha-value>)",
          mint: "hsl(var(--btln-mint) / <alpha-value>)",
          forest: "hsl(var(--btln-forest) / <alpha-value>)",
          peach: "hsl(var(--btln-peach) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
