---
name: design-md
description: Read, generate, and apply DESIGN.md specifications for UI design and development. Contains design tokens, aesthetics, and reference design systems from 70+ industry-leading brands (Stripe, Linear, Vercel, Apple, Supabase, Raycast, Notion, etc.). Use when creating or refining web UI to match a specific brand's aesthetic or creating custom DESIGN.md design system documentation.
---

# DESIGN.md Standard & Brand Reference Skill

This skill teaches the agent how to read, craft, and apply `DESIGN.md` files — the markdown-based design system standard introduced by Google Stitch and championed by VoltAgent.

---

## 1. What is DESIGN.md?

`DESIGN.md` is a plain-text markdown specification located in a project's root or design directory. AI agents read it directly to generate consistent, brand-aligned frontend UI without needing complex design tools or Figma exports.

| Specification File | Purpose |
|--------------------|---------|
| `AGENTS.md` / `GEMINI.md` | Tells coding agents how to build & structure code |
| `DESIGN.md` | Tells design & coding agents how the UI must look, feel, and behave |

---

## 2. Core Structure of a DESIGN.md File

A standard `DESIGN.md` file contains:

```yaml
---
version: alpha
name: BrandName-design-analysis
description: "High-level summary of the visual philosophy, canvas tones, lighting, typography hierarchy, and key chromatic accents."

colors:
  primary: "#..."
  on-primary: "#ffffff"
  canvas: "#0a0a0c"
  surface-1: "#121316"
  surface-2: "#1c1d22"
  hairline: "#272930"
  ink: "#f4f4f5"
  ink-muted: "#a1a1aa"
  accent: "#..."

typography:
  font-family-sans: "Inter, -apple-system, sans-serif"
  font-family-mono: "JetBrains Mono, monospace"
  display-xl: { fontSize: "64px", fontWeight: "700", lineHeight: "1.1", letterSpacing: "-0.03em" }
  headline: { fontSize: "32px", fontWeight: "600", lineHeight: "1.2", letterSpacing: "-0.02em" }
  body: { fontSize: "16px", fontWeight: "400", lineHeight: "1.5" }

radii:
  sm: "4px"
  md: "8px"
  lg: "12px"
  pill: "9999px"

shadows:
  subtle: "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
  card: "0 4px 20px -2px rgba(0, 0, 0, 0.25)"
  glow: "0 0 30px -5px var(--accent-glow)"
---

# Visual Philosophy & Guardrails
- **Layout & Spacing**: Grid structures, max-widths, padding rhythms (4px/8px base grid).
- **Surface Elevation**: Layering surfaces (canvas -> surface-1 -> surface-2 -> popover).
- **Component Specs**: Button states, form inputs, card containers, navigation bars.
- **Anti-patterns**: Explicit bans on generic AI gradients, unstyled defaults, low-contrast text.
```

---

## 3. How to Use & Apply DESIGN.md

1. **Brand-Specific UI**:
   When the user asks for a UI matching a specific brand (e.g. *"make this look like Linear"* or *"use Stripe's aesthetic"*), inspect the corresponding brand specification in `references/design-md/<brand>/DESIGN.md`.
2. **Project Design System**:
   When starting a project or unifying styles, generate a `DESIGN.md` in the project root to establish strict tokens and guidelines for CSS/HTML components.
3. **Audit & Verification**:
   Ensure all frontend code adheres to the defined color variables, spacing tokens, and typographic hierarchy.

---

## 4. Curated Brand Design References

Over 70+ brand design specifications are indexed in this skill under `references/design-md/`:

- **AI & Dev Tools**: Linear (`linear.app`), Vercel (`vercel`), Supabase (`supabase`), Cursor (`cursor`), Raycast (`raycast`), Claude (`claude`), OpenAI/xAI (`x.ai`), PostHog (`posthog`), Resend (`resend`), Mintlify (`mintlify`), Warp (`warp`).
- **SaaS & Productivity**: Notion (`notion`), Cal.com (`cal`), Intercom (`intercom`), Zapier (`zapier`), Superhuman (`superhuman`).
- **Creative & Design**: Figma (`figma`), Framer (`framer`), Miro (`miro`), Webflow (`webflow`), Clay (`clay`), Airtable (`airtable`).
- **Fintech**: Stripe (`stripe`), Revolut (`revolut`), Wise (`wise`), Coinbase (`coinbase`), Kraken (`kraken`).
- **Tech & Consumer**: Apple (`apple`), Spotify (`spotify`), Airbnb (`airbnb`), Nike (`nike`), Tesla (`tesla`), The Verge (`theverge`), Wired (`wired`).
- **Automotive & Luxury**: Ferrari (`ferrari`), Porsche / Bugatti (`bugatti`), BMW (`bmw`), Lamborghini (`lamborghini`).

---

## 5. Integrating with `design-taste-frontend` and `impeccable`

- Use **`design-md`** to define tokens, brand identity, and theme variables.
- Use **`design-taste-frontend`** to determine layout variance, motion intensity, and visual density.
- Use **`impeccable`** commands (`/audit`, `/critique`, `/polish`, `/bolder`) to refine, score, and eliminate anti-patterns.
