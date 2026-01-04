# DESIGN DECISIONS — Ollie Invoice Design System
*Canonical design system decisions based on Phase 1 audit*

**Decision Status**: PROPOSED  
**Requires Approval**: Product Designer, Engineering Lead  
**Phase**: 2 of 4 (Decision & Documentation)

---

## Introduction

This document resolves all inconsistencies found in the Phase 1 audit and establishes a single source of truth for the Ollie Invoice design system. Each decision is **opinionated, explicit, and non-negotiable** once approved.

**Guiding Principles:**
1. **Clarity over flexibility** — Eliminate "sometimes" and "it depends"
2. **Separate concerns** — Marketing pages ≠ Application UI
3. **Token-first** — No bypassing the design system with direct values
4. **Mobile-first** — Touch targets and responsive behavior are non-negotiable
5. **One way to do it** — Each pattern has exactly one canonical implementation

---

## 1. Typography System

### Problem Observed
- H1 appears as 24px, 32px, and 60px across different pages
- H2 ranges from 18px to 48px
- No clear distinction between marketing (landing) and app UI
- Inconsistent font weight application (500 vs 600 vs bold)
- Letter spacing applied ad-hoc

### RECOMMENDED DECISION ✓

**Establish TWO separate type scales:**

#### A. Marketing Type Scale (Landing, Pricing, Public Pages)

| Element | Size (Mobile) | Size (Desktop) | Weight | Line Height | Letter Spacing |
|---------|---------------|----------------|--------|-------------|----------------|
| **Hero H1** | 36px (2.25rem) | 56px (3.5rem) | 600 | 1.1 | -0.02em |
| **Section H2** | 28px (1.75rem) | 40px (2.5rem) | 600 | 1.2 | -0.015em |
| **Subsection H3** | 24px (1.5rem) | 32px (2rem) | 600 | 1.3 | -0.01em |
| **Large Body** | 18px (1.125rem) | 20px (1.25rem) | 400 | 1.6 | 0 |
| **Body** | 16px (1rem) | 18px (1.125rem) | 400 | 1.6 | 0 |
| **Small** | 14px (0.875rem) | 14px (0.875rem) | 400 | 1.5 | 0 |

#### B. Application UI Type Scale (Dashboard, Invoices, Settings)

| Element | Size | Weight | Line Height | Letter Spacing |
|---------|------|--------|-------------|----------------|
| **Page Title (H1)** | 32px (2rem) | 700 | 1.2 | -0.015em |
| **Section Heading (H2)** | 20px (1.25rem) | 600 | 1.3 | -0.01em |
| **Card Title (H3)** | 18px (1.125rem) | 600 | 1.4 | -0.005em |
| **Subheading (H4)** | 16px (1rem) | 600 | 1.4 | 0 |
| **Body** | 14px (0.875rem) | 400 | 1.5 | 0 |
| **Small** | 12px (0.75rem) | 400 | 1.4 | 0 |
| **Tiny** | 10px (0.625rem) | 500 | 1.3 | 0.01em |

**Font Family Rules:**
- **Headings (all)**: `p22-mackinac-pro`, serif fallback
- **Body (all)**: `Inter`, system-ui fallback
- **Monospace (invoice numbers, code)**: `JetBrains Mono`, monospace fallback

**Font Weight Palette:**
- Regular: 400 (body text, descriptions)
- Medium: 500 (labels, tiny text, subtle emphasis)
- Semibold: 600 (headings, buttons, card titles)
- Bold: 700 (page titles, data emphasis, amounts)

**Letter Spacing Rules:**
- Headings 32px+: -0.015em to -0.02em
- Headings <32px: -0.005em to -0.01em
- Body text: 0em (no adjustment)
- Uppercase labels: 0.025em (tracking-wide)
- Tiny text (10px): 0.01em (slight opening for legibility)

**Special Case: Invoice Display Text**
- When showing H1 on invoice PDFs or invoice preview pages, use Marketing Hero H1 scale (36px → 56px) to match brand presence

### Alternative A (Not Recommended)
Use a single unified scale across marketing and app, with H1 at 40px for both.

**Why rejected**: Marketing needs larger, more impactful type. App needs compact, scannable UI. Trying to serve both creates the current inconsistency.

### Alternative B (Not Recommended)
Use completely separate font families (sans-serif for app, serif for marketing).

**Why rejected**: Loses brand cohesion. The serif headings are part of Ollie's identity and should appear throughout.

---

## 2. Color System

### Problem Observed
- Components bypass design system using direct `text-slate-800`, `text-slate-900`
- Status colors inconsistently applied (mix of tokens and hardcoded Tailwind colors)
- CreateInvoiceButton uses hardcoded `#2CA01C` instead of CSS variable
- Some greens use primary token, others use `emerald-100`, `green-100`

### RECOMMENDED DECISION ✓

**Establish strict token-only color system:**

#### Brand Colors (CSS Variables Only)

```
Primary Green: #2CA01C (hsl 113 70% 37%)
  - Use: Primary buttons, paid status, CTAs, links, focus rings
  - Hover: Calculated programmatically (darken 8%)
  - Variable: --primary

H1/H2 Accent (Light mode only): #263926
  - Use: H1 and H2 headings on marketing pages
  - Variable: --heading-accent (light mode)
  - Dark mode equivalent: #a8d5a2
```

#### Semantic Background Colors

**Light Mode:**
```
--background: hsl(48 29% 97%)        // #FAF9F5 - Main background (warm off-white)
--background-elevated: hsl(0 0% 100%) // #FFFFFF - Cards, dialogs, elevated surfaces
--background-muted: hsl(48 24% 92%)   // #F0EEE6 - Muted regions, disabled states
```

**Dark Mode:**
```
--background: hsl(0 0% 10%)           // Main background (dark gray)
--background-elevated: hsl(0 0% 14%)  // Cards, dialogs
--background-muted: hsl(0 0% 18%)     // Muted regions
```

#### Semantic Text Colors

```
--text-primary: hsl(0 0% 28%) light / hsl(0 0% 90%) dark
--text-secondary: hsl(0 0% 42%) light / hsl(0 0% 70%) dark
--text-tertiary: hsl(0 0% 55%) light / hsl(0 0% 55%) dark
--text-disabled: hsl(0 0% 70%) light / hsl(0 0% 40%) dark
```

#### Semantic Border Colors

```
--border-default: hsl(48 23% 95%) light / hsl(0 0% 20%) dark
--border-strong: hsl(48 23% 90%) light / hsl(0 0% 25%) dark
--border-subtle: hsl(48 23% 97%) light / hsl(0 0% 15%) dark
```

#### Status Colors (Fixed Palette)

**Success/Paid:**
```
--status-success-bg: hsl(113 70% 95%)      // Light green background
--status-success-text: hsl(113 70% 25%)    // Dark green text
--status-success-border: hsl(113 70% 80%)  // Border
Primary indicator: Use --primary (#2CA01C)
```

**Warning/Pending:**
```
--status-warning-bg: hsl(38 90% 95%)       // Light amber background
--status-warning-text: hsl(38 90% 30%)     // Dark amber text
--status-warning-border: hsl(38 90% 75%)   // Border
```

**Error/Overdue:**
```
--status-error-bg: hsl(0 84% 97%)          // Light red background
--status-error-text: hsl(0 84% 45%)        // Dark red text
--status-error-border: hsl(0 84% 85%)      // Border
```

**Info/Sent:**
```
--status-info-bg: hsl(210 100% 97%)        // Light blue background
--status-info-text: hsl(210 100% 40%)      // Dark blue text
--status-info-border: hsl(210 100% 85%)    // Border
```

**Neutral/Draft:**
```
Use --background-muted, --text-secondary, --border-default
```

#### Chart Colors (Fixed Palette)

```
--chart-1: hsl(220 70% 50%)  // Blue
--chart-2: hsl(160 60% 45%)  // Teal
--chart-3: hsl(30 80% 55%)   // Orange
--chart-4: hsl(280 65% 60%)  // Purple
--chart-5: hsl(340 75% 55%)  // Pink
```

#### Overlay Colors (Alpha-based)

```
--overlay-dialog: rgba(0, 0, 0, 0.80)
--overlay-hover-light: rgba(0, 0, 0, 0.03)
--overlay-hover-dark: rgba(255, 255, 255, 0.04)
--overlay-active-light: rgba(0, 0, 0, 0.08)
--overlay-active-dark: rgba(255, 255, 255, 0.09)
```

#### Invoice Brand Color Palette (User Customization)

Keep existing 13-color palette in `brandColors.ts` — these are for **user choice only**, not system UI.

**ENFORCEMENT RULES:**

1. **NO direct Tailwind color usage** in components
   - ❌ FORBIDDEN: `text-slate-800`, `bg-green-100`, `text-red-600`
   - ✅ REQUIRED: `text-primary`, `bg-status-success-bg`, `text-status-error-text`

2. **NO hardcoded hex/rgb values** in components or CSS
   - ❌ FORBIDDEN: `color: #2CA01C`, `background: #FAF9F5`
   - ✅ REQUIRED: `color: var(--primary)`, `background: var(--background)`

3. **Exception**: Marketing page gradients and decorative elements may use direct values if they don't represent semantic meaning

### Alternative A (Not Recommended)
Allow direct Tailwind colors but document which ones are "approved."

**Why rejected**: Creates ambiguity. Developers will inevitably use unapproved colors. Token-only approach is cleaner and enforceable via linting.

### Alternative B (Not Recommended)
Create separate color scales for every possible use case (50+ tokens).

**Why rejected**: Over-engineering. The semantic approach (text-primary, status-success-bg) covers 95% of cases and is easier to maintain.

---

## 3. Button System

### Problem Observed
- CreateInvoiceButton uses separate CSS file with hardcoded `#2CA01C`
- Button variants defined in component library but custom buttons bypass it
- Inconsistent size application (44px CreateInvoice vs 36px standard)
- Animation patterns not documented

### RECOMMENDED DECISION ✓

**Consolidate all buttons into unified variant system:**

#### Button Variants (Semantic)

**1. Primary (Call-to-Action)**
- Background: `bg-primary` (#2CA01C)
- Text: `text-white`
- Border: None
- Hover: Overlay darken (--overlay-hover)
- Active: Scale 0.97 + stronger overlay
- Use: Primary actions (Create Invoice, Send Invoice, Submit, Save)

**2. Secondary (Alternative Action)**
- Background: `bg-background-muted`
- Text: `text-primary`
- Border: `1px solid border-default`
- Hover: Overlay effect
- Use: Secondary actions (Cancel → Close, Back, alternative choices)

**3. Outline (Tertiary Action)**
- Background: Transparent
- Text: Inherits parent
- Border: `1px solid rgba(current, 0.10)` (10% opacity of current text color)
- Hover: Overlay effect
- Use: Tertiary actions in complex UIs (dropdown triggers, tabs when not using tab component)

**4. Ghost (Subtle Action)**
- Background: Transparent
- Text: `text-secondary`
- Border: None
- Hover: `bg-background-muted`
- Use: Icon buttons, subtle actions, menu items

**5. Destructive (Danger Action)**
- Background: `bg-status-error-text` (red)
- Text: `text-white`
- Border: None
- Hover: Overlay darken
- Use: Delete, remove, irreversible actions

#### Button Sizes

| Size | Height | Padding H | Font Size | Icon Size | Use Case |
|------|--------|-----------|-----------|-----------|----------|
| **sm** | 32px | 12px | 12px (0.75rem) | 14px | Table actions, compact UI |
| **md** (default) | 40px | 16px | 14px (0.875rem) | 16px | Standard UI buttons |
| **lg** | 48px | 24px | 16px (1rem) | 20px | Marketing CTAs, forms |
| **xl** | 56px | 32px | 18px (1.125rem) | 24px | Hero CTAs only |

**Icon-only buttons**: Square dimensions (32x32, 40x40, 48x48)

#### Border Radius
- App UI buttons: `6px (rounded-md)`
- Marketing CTAs: `9999px (rounded-full)` — pill shape

#### Special Buttons

**CreateInvoiceButton Decision:**

**✓ Recommended**: Consolidate into Primary variant, size `md`, with custom animation enhancement class

- Use standard Primary button
- Add optional `animate-bounce-release` class for micro-interaction
- Add optional `icon-rotate-on-hover` class for plus icon
- Remove separate CSS file, move animations to global utilities

**Why**: Maintains design system consistency while preserving delightful micro-interactions

**Alternative approach** (if team strongly prefers separation):
- Create `button-enhanced` variant that extends Primary
- Document as "Featured CTA" pattern
- Still uses design tokens, not hardcoded values

#### Interaction Patterns

**Hover:**
- Cursor: pointer
- Overlay: `--overlay-hover-light` or `--overlay-hover-dark`
- Transition: 0.2s ease
- Icon rotation (if applicable): 90deg, 0.3s cubic-bezier(0.25, 0.1, 0.3, 1.4)

**Active (Press):**
- Transform: `scale(0.97)`
- Overlay: `--overlay-active-light` or `--overlay-active-dark`
- Transition: 0.1s ease

**Release (Optional Enhancement):**
- Animation: bounce-back
- Duration: 0.22s
- Timing: cubic-bezier(.28, .03, .2, 1.4)
- Keyframes: 0% scale(0.97) → 55% scale(1.02) → 100% scale(1)

**Focus:**
- Ring: 2px solid `var(--primary)`
- Offset: 2px
- Outline: none

**Disabled:**
- Opacity: 0.5
- Cursor: not-allowed
- Pointer events: none

### Alternative A (Not Recommended)
Keep CreateInvoiceButton as completely separate component with own styling.

**Why rejected**: Creates maintenance burden (two button systems). Breaks design token enforcement.

### Alternative B (Not Recommended)
Remove all micro-interactions (bounce, icon rotation) for consistency.

**Why rejected**: These delightful interactions are part of Ollie's brand personality. They should be standardized, not removed.

---

## 4. Elevation & Shadow System

### Problem Observed
- CSS shadow variables exist but are all set to `0px 0px 0px transparent`
- Separate "shadow-notion" classes were added later
- Custom elevation system uses overlays (pseudo-elements) instead of shadows
- Confusion about when to use shadows vs overlays vs borders

### RECOMMENDED DECISION ✓

**Adopt hybrid elevation system: Borders for structure, subtle shadows for depth, overlays for interaction.**

#### Elevation Levels (Visual Hierarchy)

**Level 0 — Flat (No Elevation)**
- Border: `1px solid border-default`
- Shadow: None
- Background: `bg-background` or `bg-background-elevated`
- Use: Table rows, list items, sections

**Level 1 — Resting (Subtle Depth)**
- Border: `1px solid border-default`
- Shadow: `0 1px 3px rgba(0, 0, 0, 0.04)`
- Background: `bg-background-elevated`
- Use: Cards, panels, form sections

**Level 2 — Raised (Moderate Depth)**
- Border: `1px solid border-default`
- Shadow: `0 2px 8px rgba(0, 0, 0, 0.06)`
- Background: `bg-background-elevated`
- Use: Dropdown menus, popovers, tooltips

**Level 3 — Floating (High Depth)**
- Border: `1px solid border-default`
- Shadow: `0 8px 24px rgba(0, 0, 0, 0.08)`
- Background: `bg-background-elevated`
- Use: Modals, dialogs, sheets

**Level 4 — Overlay (Maximum Depth)**
- Border: None
- Shadow: `0 16px 48px rgba(0, 0, 0, 0.12)`
- Background: `bg-background-elevated`
- Backdrop: `bg-overlay-dialog`
- Use: Full-screen modals, critical alerts

#### Interaction States (Overlay System)

**Hover State:**
- Add pseudo-element with `background: var(--overlay-hover)`
- Transition: 0.2s ease
- Covers entire element including border (inset: -1px if border present)
- Z-index: 999 (sits above content)

**Active State:**
- Add pseudo-element with `background: var(--overlay-active)`
- Optional: `transform: scale(0.97)` for buttons
- Transition: 0.1s ease

**Toggle State:**
- Add pseudo-element with `background: var(--overlay-active)`
- Sits behind content (z-index: -1)
- Use for: Selected states, active tabs, toggled buttons

#### CSS Classes

**Structural Elevation (Shadows):**
```
.elevation-0   // No shadow, border only
.elevation-1   // Subtle shadow (resting cards)
.elevation-2   // Moderate shadow (popovers)
.elevation-3   // High shadow (dialogs)
.elevation-4   // Maximum shadow (overlays)
```

**Interactive Elevation (Overlays):**
```
.hover-elevate          // Adds hover overlay
.active-elevate         // Adds active overlay  
.toggle-elevate         // Adds toggle overlay (behind content)
.hover-elevate-strong   // Stronger hover (active-level overlay on hover)
```

**When to Use What:**

- **Borders only**: Table rows, list items, inline elements
- **Borders + Shadows**: Cards, panels, dropdowns, dialogs
- **Overlays**: ALL interactive states (hover, active, toggle)
- **Never shadow without border** (exception: full-page overlays)

**Special Case — Landing Page Cards:**
- May use `elevation-2` on hover for dramatic effect
- Transform: `translateY(-2px)` allowed on marketing pages only

### Alternative A (Not Recommended)
Use shadows only (no overlay system), with multiple shadow levels for interactions.

**Why rejected**: Shadows don't work well for subtle interactions on light backgrounds. Overlay system is more flexible and works in both light/dark modes.

### Alternative B (Not Recommended)
Remove all shadows entirely, use borders only.

**Why rejected**: Too flat. Some depth perception improves usability for dropdowns, dialogs, and cards.

---

## 5. Spacing & Layout Rules

### Problem Observed
- Page padding varies by route (px-4/px-6/px-8 responsive vs px-6 consistent)
- Card padding inconsistent (p-4, p-5, p-6, p-8 all observed)
- No clear rules for when to use which spacing value

### RECOMMENDED DECISION ✓

**Establish spacing scales for specific contexts:**

#### Base Scale (Tailwind Default)
Preserve Tailwind's `0.25rem` (4px) base scale: 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64

Use this for: margins, gaps, padding within components

#### Page Layout — Application UI

**Horizontal (Container):**
```
Mobile (< 640px):    px-4  (16px)
Tablet (640-1024px): px-6  (24px)
Desktop (> 1024px):  px-8  (32px)
Max width:           max-w-7xl (1280px)
```

**Vertical (Sections):**
```
Mobile:   py-6  (24px top/bottom)
Desktop:  py-8  (32px top/bottom)
```

**Between Sections (Stack):**
```
Mobile:   space-y-6  (24px between sections)
Desktop:  space-y-8  (32px between sections)
```

#### Page Layout — Marketing Pages

**Horizontal (Container):**
```
All breakpoints: px-6 (24px) — consistent across all sizes
Max width:       max-w-6xl (1152px)
```

**Vertical (Sections):**
```
Small sections:  py-16  (64px top/bottom)
Standard:        py-20 md:py-28  (80px → 112px)
Hero/Large:      py-24 md:py-32  (96px → 128px)
```

**Between Sections:**
- No space classes (each section defines own padding)

#### Card Padding

**Application UI Cards:**
```
Mobile:  p-4  (16px all sides)
Desktop: p-6  (24px all sides)

Compact variant:  p-3  (12px) — for dense tables, data displays
Spacious variant: p-8  (32px) — for forms, important CTAs
```

**CardHeader:**
```
Padding: p-6 (consistent)
Internal gap: space-y-1.5 (6px between title and description)
```

**CardContent:**
```
Padding: p-6 pt-0 (remove top padding, header already has bottom)
```

**CardFooter:**
```
Padding: p-6 pt-0 (consistent with content)
```

**Marketing Cards:**
```
Mobile:  p-6  (24px)
Desktop: p-8  (32px)
```

#### Component Internal Spacing

**Buttons:**
```
Small:   px-3 py-1.5  (12px × 6px)
Default: px-4 py-2    (16px × 8px)
Large:   px-8 py-3    (32px × 12px)
```

**Form Fields:**
```
Input:    px-3 py-2    (12px × 8px)
Textarea: p-3          (12px all sides)
Label:    mb-2         (8px below label)
Helper:   mt-1         (4px above helper text)
Field gap: space-y-4   (16px between fields)
```

**Badges:**
```
Padding: px-2.5 py-0.5  (10px × 2px)
```

**Tabs:**
```
TabsList:    p-1         (4px internal padding)
TabsTrigger: px-3 py-2   (12px × 8px)
```

#### Stack Spacing (Vertical Rhythm)

**Tight (Dense Information):**
```
space-y-2  (8px)  — Use: Form field groups, list items
```

**Standard (Default):**
```
space-y-4  (16px) — Use: Form sections, card content
```

**Comfortable (Sections):**
```
space-y-6  (24px) — Use: Page sections (mobile)
space-y-8  (32px) — Use: Page sections (desktop)
```

**Spacious (Major Sections):**
```
space-y-12 (48px) — Use: Landing page sections
```

#### Gap Spacing (Flex/Grid)

**Tight:**
```
gap-2  (8px)  — Use: Icon + label, inline elements
```

**Standard:**
```
gap-4  (16px) — Use: Grid cards, flex rows
```

**Comfortable:**
```
gap-6  (24px) — Use: Grid sections, spaced layouts
```

#### Container Max Widths

```
xs:  max-w-sm    (384px)  — Use: Tiny modals, alerts
sm:  max-w-lg    (512px)  — Use: Dialogs, forms
md:  max-w-3xl   (768px)  — Use: Centered content, articles
lg:  max-w-6xl   (1152px) — Use: Marketing sections
xl:  max-w-7xl   (1280px) — Use: App dashboard, wide layouts
```

**Enforcement Rule:**
- Use responsive padding classes: `px-4 sm:px-6 md:px-8`
- Never mix patterns (if marketing uses px-6 flat, keep it flat)
- Document exceptions (e.g., full-bleed sections use px-0)

### Alternative A (Not Recommended)
Use identical spacing for app and marketing (single scale).

**Why rejected**: Marketing needs more generous spacing for visual impact. App needs efficient use of screen real estate.

### Alternative B (Not Recommended)
Allow arbitrary spacing values anywhere.

**Why rejected**: Leads to visual inconsistency. Constraining to defined values creates rhythm and harmony.

---

## 6. Z-Index Scale

### Problem Observed
- No defined z-index scale
- Values range from -10 to 999 with no system
- Conflicts possible as UI grows

### RECOMMENDED DECISION ✓

**Establish fixed 10-level z-index scale:**

```javascript
Z_INDEX_SCALE = {
  base:           0,     // Default stacking (most elements)
  dropdown:       10,    // Dropdowns, tooltips
  sticky:         20,    // Sticky headers, floating action buttons
  fixed:          30,    // Fixed navigation, sidebars
  backdrop:       40,    // Modal backdrops, drawer overlays  
  modal:          50,    // Modals, dialogs, sheets
  popover:        60,    // Popovers that appear over modals (rare)
  toast:          70,    // Toast notifications (always visible)
  tooltip:        80,    // Tooltips (highest UI element)
  debug:          90,    // Development tools, debug overlays
}
```

**Micro-adjustments** (relative stacking within a level):
- Use `z-[11]`, `z-[12]` etc. ONLY when you need multiple elements at same level to stack
- Document why in code comment

**Negative z-index** (Background elements):
```
z-[-1]   — Decorative backgrounds, behind parent content
z-[-10]  — Far background (gradients, meshes)
```

**CSS Variable Implementation:**
```css
:root {
  --z-base: 0;
  --z-dropdown: 10;
  --z-sticky: 20;
  --z-fixed: 30;
  --z-backdrop: 40;
  --z-modal: 50;
  --z-popover: 60;
  --z-toast: 70;
  --z-tooltip: 80;
  --z-debug: 90;
}
```

**Usage Mapping:**

| UI Element | Z-Index Level | Tailwind Class |
|------------|---------------|----------------|
| Table rows, cards, sections | 0 (base) | (no class needed) |
| Dropdown menus | 10 | `z-10` |
| Select dropdowns | 10 | `z-10` |
| Sticky table headers | 20 | `z-20` |
| Floating action buttons | 20 | `z-20` |
| Fixed sidebar | 30 | `z-30` |
| Fixed navigation | 30 | `z-30` |
| Modal backdrop | 40 | `z-40` |
| Drawer backdrop | 40 | `z-40` |
| Modal content | 50 | `z-50` |
| Dialog content | 50 | `z-50` |
| Popover (standard) | 60 | `z-60` |
| Toast notifications | 70 | `z-70` |
| Tooltips | 80 | `z-80` |
| Command palette | 90 | `z-90` |

**Interaction Overlays (Pseudo-elements):**
- Hover/active overlays: `z-[999]` (local to component)
- Toggle overlays: `z-[-1]` (behind component content)

**Why 999 for interaction overlays?**  
These are scoped within their component and need to sit above all component children. They never interact with global z-index scale.

**Enforcement Rule:**
- Use scale values only
- If you need a value not on the scale, ask why
- Document any exceptions with clear comment

### Alternative A (Not Recommended)
Use 100-scale (100, 200, 300...) for more room between levels.

**Why rejected**: Creates false sense of flexibility. More levels = more confusion. 10-level scale forces intentional stacking decisions.

### Alternative B (Not Recommended)
No scale, use semantic classes only (z-dropdown, z-modal).

**Why rejected**: Tailwind doesn't support custom z-index classes out of box. Would require significant config. 10-scale is simpler.

---

## 7. Additional Decisions

### Border Radius

**Locked values:**
```
sm:   3px   (0.1875rem)  — Tabs, tight UI elements
md:   6px   (0.375rem)   — Buttons, inputs, badges (STANDARD)
lg:   9px   (0.5625rem)  — Unused (remove from system)
xl:   12px  (0.75rem)    — Cards, panels (STANDARD)
2xl:  16px  (1rem)       — Marketing cards, large panels
full: 9999px             — Pills, avatars, circular buttons
```

**Usage rules:**
- App UI buttons/inputs: `rounded-md` (6px)
- App UI cards: `rounded-xl` (12px)
- Marketing CTAs: `rounded-full` (pill)
- Marketing cards: `rounded-2xl` (16px)
- Avatars: `rounded-full`
- NEVER use `rounded-lg` (9px) — remove from system

### Animation Durations

**Standard durations:**
```
fast:     100ms  — Button press, immediate feedback
default:  200ms  — Hover states, color changes
medium:   300ms  — Icon rotations, subtle movements
slow:     500ms  — Fade ins, modal appearances
slower:   600ms  — Shine effects, emphasis
```

**Timing functions:**
```
ease:     Standard transitions
ease-out: Things appearing (modals, dropdowns)
ease-in:  Things disappearing
bounce:   cubic-bezier(.28,.03,.2,1.4) — Button release
smooth:   cubic-bezier(0.25, 0.1, 0.3, 1.4) — Icon rotations
```

### Focus Rings

**All interactive elements:**
```
Ring:    2px solid var(--primary)
Offset:  2px
Radius:  Inherits element border-radius
```

**Exception**: Custom focus states for complex components (tables, lists) may use different visual indicator but must be clearly visible.

### Disabled States

**All interactive elements:**
```
Opacity:        0.5
Cursor:         not-allowed
Pointer-events: none
```

### Mobile Considerations

**Minimum tap targets:**
```
Touch target: 44px minimum (iOS Human Interface Guidelines)
Applies to: All buttons, links, interactive icons
```

**Font size adjustments:**
```
Input/select: text-base (16px) on mobile — prevents iOS zoom
Otherwise:    Use standard type scale
```

**Responsive breakpoints (Tailwind defaults):**
```
sm:  640px
md:  768px
lg:  1024px
xl:  1280px
2xl: 1536px
```

---

## Implementation Priority

Once these decisions are approved, implement in this order:

### Phase 3 — High Priority (Week 1-2)
1. Color system (create all CSS variables, forbid direct usage)
2. Typography scale (define CSS for marketing vs app)
3. Button variants (consolidate CreateInvoiceButton)
4. Z-index scale (replace all arbitrary values)

### Phase 4 — Medium Priority (Week 3-4)
5. Spacing rules (enforce via linting)
6. Elevation system (standardize shadow/overlay classes)
7. Component audit (ensure all components use tokens)

### Phase 5 — Low Priority (Week 5+)
8. Animation system (document all timing functions)
9. Focus ring standardization
10. Documentation site/Storybook

---

## Approval Checklist

Before moving to Phase 3 (implementation), confirm:

- [ ] Typography scale approved (marketing vs app distinction)
- [ ] Color token system approved (no direct Tailwind colors)
- [ ] Button consolidation approach approved (CreateInvoiceButton decision)
- [ ] Elevation system approved (borders + shadows + overlays)
- [ ] Spacing rules approved (app vs marketing padding)
- [ ] Z-index scale approved (10-level system)
- [ ] Border radius simplification approved (remove lg/9px)
- [ ] Animation standards approved (durations and timing)

---

## Dissent & Alternative Proposals

If you disagree with any decision:
1. Identify the specific section
2. Explain the concern
3. Propose a concrete alternative
4. Schedule design review meeting

**Deadline for feedback**: [To be determined]  
**Final approval by**: Product Designer, Engineering Lead  
**Implementation starts**: After all checkboxes above are marked

---

*End of Design Decisions Document*

**Status**: PROPOSED — Awaiting approval to proceed to Phase 3 (Implementation)

