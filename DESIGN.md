# Design System — EmuWorld

## Product Context
- **What this is:** Macro quantitative analysis and probability forecasting platform
- **Who it's for:** Financial analysts, economists, data scientists tracking global macro indicators
- **Space/industry:** FinTech / macroeconomic intelligence
- **Project type:** Data dashboard + prediction engine web app

## Aesthetic Direction
- **Direction:** Retro-Futuristic / Aurora — deep space darkness with luminous aurora borealis accents
- **Decoration level:** Intentional — particle network canvas, CRT scan lines, animated grid overlay, aurora gradient orbs
- **Mood:** Like standing in a control room orbiting Jupiter — vast darkness punctuated by precise, glowing instruments. Data feels alive and cosmic.
- **Reference sites:** Bloomberg Terminal (data density), Linear.app (glass polish), Vercel dashboard (modern minimalism)

## Typography
- **Display/Hero:** Outfit — geometric sans with weight range 200-900, clean futuristic feel
- **Body:** Space Grotesk — humanist sans with subtle quirks, excellent readability at small sizes
- **Data/Tables:** JetBrains Mono — tabular-nums support, monospace alignment for numbers
- **Code:** JetBrains Mono — consistent with data display
- **Loading:** Google Fonts CDN
- **Scale:**
  - xs: 0.58rem (badges, labels)
  - sm: 0.7rem (secondary text)
  - base: 0.85rem (body)
  - md: 0.95rem (card titles)
  - lg: 1.1rem (section headers)
  - xl: 1.5rem (time display)
  - 2xl: 1.75rem (logo)
  - 3xl: clamp(2.5rem, 5vw, 3.5rem) (hero)

## Color
- **Approach:** Expressive — color as primary design tool against deep space background
- **Background:** `#030308` (near-black with blue undertone)
- **Primary accent:** `#00f5d4` (aurora cyan) — primary actions, active states, data highlights
- **Secondary accent:** `#f72585` (aurora magenta) — warnings, contrast elements
- **Tertiary accents:**
  - `#4361ee` (aurora blue) — gradients, info states
  - `#7209b7` (aurora purple) — decorative gradients
  - `#06d6a0` (aurora green) — success, positive changes
  - `#ffd60a` (aurora amber) — warnings, attention
  - `#ff006e` (aurora rose) — errors, negative changes
- **Neutrals:** Cool blue-grays from `#f0f0f5` (text) → `#9898b0` (secondary) → `#5a5a78` (tertiary) → `#3d3d56` (muted)
- **Semantic:** success `#06d6a0`, warning `#ffd60a`, error `#ff006e`, info `#4361ee`
- **Dark mode:** N/A — design is dark-mode only by nature

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable — data-dense but breathable
- **Scale:** 2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64)

## Layout
- **Approach:** Grid-disciplined with editorial hero
- **Grid:** 12-column at desktop, 6 at tablet, 4 at mobile
- **Max content width:** 1280px
- **Border radius:** xs(4px) sm(8px) md(12px) lg(16px) xl(24px) full(9999px)

## Motion
- **Approach:** Intentional — meaningful state transitions, subtle entrance animations
- **Easing:** enter(cubic-bezier(0.16, 1, 0.3, 1)) exit(cubic-bezier(0.4, 0, 0.2, 1)) move(cubic-bezier(0.34, 1.56, 0.64, 1))
- **Duration:** instant(80ms) fast(150ms) normal(250ms) slow(400ms) deliberate(600ms)
- **Key animations:**
  - Particle network: continuous canvas animation with connecting lines
  - Aurora drift: 30s slow background gradient animation
  - Grid shift: subtle animated grid overlay
  - Scan lines: fixed CRT effect at 40% opacity
  - Status dot: 2s pulse for live indicator
  - Card hover: translateY(-2px) + border glow + radial cursor follow

## Effects
- **Glass morphism:** backdrop-filter: blur(24px) with semi-transparent backgrounds
- **Particle network:** Canvas-based particle system with proximity-based connecting lines
- **Scan lines:** Fixed overlay with repeating gradient at 4px intervals
- **Glow system:** Multi-layer box-shadow system (sm/md/lg) for neon effects
- **Gradient text:** background-clip for hero and logo elements

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-02 | Aurora color palette replacing cyberpunk neon | More sophisticated, less cliché than pure cyan/magenta |
| 2026-04-02 | Particle network canvas background | Creates living, breathing feel without overwhelming data |
| 2026-04-02 | Three-font system (Outfit/Space Grotesk/JetBrains Mono) | Clear hierarchy: display → body → data |
| 2026-04-02 | Dark-mode only | Matches product identity (control room / observatory) |
| 2026-04-02 | Component architecture with API integration | Replaced mock data with real backend connection |
| 2026-04-02 | Removed App.css duplication | All styles consolidated in index.css |
