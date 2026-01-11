# Ollie Invoice Design System

**Quick Reference Guide for Building Features**

This design system provides a complete foundation for building consistent, beautiful interfaces in the Ollie Invoice application. All design decisions have been carefully documented and are ready to use.

## 📁 Files in This Directory

- **`tokens.css`** - CSS custom properties for styling
- **`tokens.ts`** - TypeScript constants for programmatic access
- **`AI_CONTEXT.md`** - Rules and constraints for AI-assisted development

## 🚀 Quick Start

### In Your React App

```tsx
// 1. Import CSS tokens in your main App.tsx or index.tsx
import './design-system/tokens.css';

// 2. Use CSS variables in your components
const MyComponent = () => (
  <div style={{ 
    backgroundColor: 'var(--background)',
    color: 'var(--text-primary)',
    padding: 'var(--spacing-4)'
  }}>
    <h1 className="h1">Dashboard</h1>
  </div>
);

// 3. Or import TypeScript tokens for programmatic use
import { colors, typography, spacing } from './design-system/tokens';

const StyledComponent = () => (
  <div style={{
    backgroundColor: colors.background,
    fontSize: typography.app.h1.size,
    padding: `${spacing[4]}px`
  }}>
    Content
  </div>
);
```

## 📐 Typography

### Application UI (Dashboard, Forms, Settings)

Use these for the main application interface:

| Element | Tag | Size | Weight | Use Case |
|---------|-----|------|--------|----------|
| Page Title | `<h1>` | 32px | 700 | Dashboard, main page titles |
| Section Heading | `<h2>` | 20px | 600 | Recent invoices, settings sections |
| Card Title | `<h3>` | 18px | 600 | Total revenue, card headings |
| Subheading | `<h4>` | 16px | 600 | Payment details, form sections |
| Body Text | `<p>` | 14px | 400 | Standard content, descriptions |
| Small Text | `<small>` | 12px | 400 | Labels, metadata, timestamps |
| Tiny Text | `<span class="tiny">` | 10px | 500 | Very small labels, dense info |

### Marketing Pages (Landing, Pricing)

Use these for public-facing pages with responsive sizes:

| Element | Tag | Mobile | Desktop | Weight |
|---------|-----|--------|---------|--------|
| Hero | `<h1 class="hero">` | 36px | 56px | 600 |
| Section | `<h2>` | 28px | 40px | 600 |
| Subsection | `<h3>` | 24px | 32px | 600 |
| Large Body | `<p class="large">` | 18px | 20px | 400 |
| Body | `<p>` | 16px | 18px | 400 |

### Font Weights

Only use these two weights:
- **400 (Regular)** - All body text, descriptions, paragraphs
- **600 (Semibold)** - All headings, labels, emphasis

⚠️ **Never use** 500 (Medium) or 700 (Bold) except for H1 in app UI (which uses 700).

## 🎨 Colors

### Usage Rules

✅ **ALWAYS** use CSS variables or TypeScript tokens  
❌ **NEVER** use direct Tailwind colors like `text-slate-800` or `bg-green-100`

### Brand Colors

```css
var(--primary)          /* #2CA01C - Primary green for buttons, CTAs */
var(--primary-hover)    /* #238a16 - Hover state for primary */
```

### Background Colors

```css
var(--background)          /* #FAF9F5 - Main warm off-white background */
var(--background-elevated) /* #FFFFFF - Cards, dialogs, elevated surfaces */
var(--background-muted)    /* #F0EEE6 - Muted regions, disabled states */
```

### Text Colors

```css
var(--text-primary)   /* #484848 - Primary text, headings */
var(--text-secondary) /* #6B6B6B - Secondary text, labels */
var(--text-tertiary)  /* #8C8C8C - Tertiary text, placeholders */
```

### Status Colors

For invoice statuses and feedback:

| Status | Background | Text | Use Case |
|--------|------------|------|----------|
| Paid | `--status-success-bg` | `--status-success-text` | Paid invoices, success messages |
| Pending | `--status-warning-bg` | `--status-warning-text` | Pending payments, warnings |
| Overdue | `--status-error-bg` | `--status-error-text` | Overdue invoices, errors |
| Sent | `--status-info-bg` | `--status-info-text` | Sent invoices, info messages |
| Draft | `--status-draft-bg` | `--status-draft-text` | Draft invoices, neutral states |

**Status Pill Component Example:**

```tsx
<div className="status-pill" style={{
  backgroundColor: 'var(--status-success-bg)',
  color: 'var(--status-success-text)',
  padding: 'var(--button-padding-sm)',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--font-size-small)',
  fontWeight: 'var(--font-weight-semibold)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--spacing-2)'
}}>
  <CheckIcon /> Paid
</div>
```

## 🔘 Buttons

### Variants

1. **Primary** - Main actions (Create Invoice, Send, Submit, Save)
2. **Secondary** - Alternative actions (Cancel, Close, Back)
3. **Outline** - Tertiary actions (Dropdown triggers, tabs)
4. **Ghost** - Subtle actions (Icon buttons, menu items)
5. **Destructive** - Dangerous actions (Delete, Remove)

### Sizes

Only 2 sizes:
- **Small** (32px height) - Compact UI, table actions
- **Default** (40px height) - Standard buttons everywhere

❌ **No large buttons** - removed for simplicity

### Button Styling

```css
/* Primary Button */
background: var(--primary);
color: white;
padding: var(--button-padding-md);
border-radius: var(--radius-md);
font-size: var(--font-size-body);
font-weight: var(--font-weight-semibold);

/* Small variant */
padding: var(--button-padding-sm);
font-size: var(--font-size-small);
```

## 📏 Spacing

### Base Unit

All spacing is based on 4px (0.25rem) increments.

Available spacing tokens: `--spacing-1` through `--spacing-16`

| Token | Value | Use Case |
|-------|-------|----------|
| `--spacing-1` | 4px | Minimal gaps |
| `--spacing-2` | 8px | Tight spacing, icon gaps |
| `--spacing-3` | 12px | Small gaps |
| `--spacing-4` | 16px | Standard gaps, mobile card padding |
| `--spacing-6` | 24px | Section spacing, desktop card padding |
| `--spacing-8` | 32px | Large sections, desktop page padding |

### Card Padding

Only 2 padding sizes:
- **Mobile**: `--card-padding-mobile` (16px / p-4)
- **Desktop**: `--card-padding-desktop` (24px / p-6)

### Page Padding

**Application UI:**
- Mobile: `--page-padding-mobile` (16px)
- Tablet: `--page-padding-tablet` (24px)
- Desktop: `--page-padding-desktop` (32px)

**Marketing Pages:**
- All breakpoints: `--page-padding-marketing` (24px consistent)

## 🔲 Border Radius

Only 2 radius values:

- **`--radius-md` (6px)** - Buttons, inputs, badges, tabs, status pills
- **`--radius-xl` (12px)** - Cards, panels, containers

## 🎭 Elevation & Shadows

3 elevation levels:

```css
/* Level 0 - Flat */
box-shadow: none;
/* Use for: Table rows, list items */

/* Level 2 - Raised */
box-shadow: var(--shadow-raised);
/* Use for: Cards, panels, dropdowns, popovers */

/* Level 4 - Overlay */
box-shadow: var(--shadow-overlay);
/* Use for: Modals, dialogs, full-screen overlays */
```

## 📚 Z-Index Scale

Use the pre-defined scale for consistent layering:

```css
--z-base: 0;       /* Default stacking */
--z-dropdown: 10;  /* Dropdowns, selects */
--z-sticky: 20;    /* Sticky headers */
--z-fixed: 30;     /* Fixed navigation, sidebars */
--z-backdrop: 40;  /* Modal backdrops */
--z-modal: 50;     /* Modals, dialogs */
--z-popover: 60;   /* Popovers */
--z-toast: 70;     /* Toast notifications */
--z-tooltip: 80;   /* Tooltips */
--z-debug: 90;     /* Debug overlays */
```

## 🎬 Transitions

```css
var(--transition-fast)     /* 0.1s - Button press, immediate feedback */
var(--transition-default)  /* 0.2s - Hover states, color changes */
var(--transition-medium)   /* 0.3s - Icon rotations, subtle movements */
var(--transition-slow)     /* 0.5s - Fade ins, modal appearances */
```

## 📱 Breakpoints

Use these breakpoint values for responsive design:

```typescript
breakpoints = {
  sm: 640px,   // Tablet
  md: 768px,   // Small desktop
  lg: 1024px,  // Desktop
  xl: 1280px,  // Large desktop
  2xl: 1536px  // Extra large
}
```

## 🎯 Common Patterns

### Dashboard Card

```tsx
<div style={{
  backgroundColor: 'var(--background-elevated)',
  padding: 'var(--card-padding-desktop)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: 'var(--shadow-raised)',
}}>
  <h3 className="h3">Total Revenue</h3>
  <p className="body">$12,345</p>
</div>
```

### Status Badge

```tsx
<span style={{
  backgroundColor: 'var(--status-success-bg)',
  color: 'var(--status-success-text)',
  padding: 'var(--button-padding-sm)',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--font-size-small)',
  fontWeight: 'var(--font-weight-semibold)',
}}>
  Paid
</span>
```

### Form Input

```tsx
<input style={{
  padding: 'var(--spacing-3)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-default)',
  fontSize: 'var(--font-size-body)',
  fontFamily: 'var(--font-body)',
}} />
```

## 📖 Full Documentation

For comprehensive design decisions and rationale, see:

- **[DESIGN_DECISIONS.md](../design-decisions/DESIGN_DECISIONS.md)** - Complete design system documentation
- **[design_canonical.json](../design-decisions/design_canonical.json)** - Machine-readable format
- **[STYLE_AUDIT.md](../design-audit/STYLE_AUDIT.md)** - Historical audit findings

## 👀 Visual Reference

Open **[DesignSystemPreview.html](../DesignSystemPreview.html)** in your browser to see all components, colors, typography, and patterns visually.

## ⚠️ Important Rules

1. **Never bypass the design system** - Don't use `text-slate-800` or hardcoded colors
2. **Only 2 font weights** - Use 400 (regular) and 600 (semibold) only
3. **Only 2 button sizes** - Small and Default, no Large
4. **Only 2 border radius values** - 6px and 12px
5. **Only 2 card padding sizes** - 16px mobile, 24px desktop
6. **Proper capitalization** - Never use all caps for body text or labels

## 🤖 For AI Assistance

When asking Cursor AI to build features, refer to specific tokens:

> "Create a dashboard card with H3 title using --font-size-h3, --card-padding-desktop, --radius-xl, and --shadow-raised"

> "Add a status pill for 'Paid' using --status-success-bg and --status-success-text"

The AI will understand these tokens and generate consistent code.

---

**Last Updated:** December 2025  
**Version:** 2.0.0









