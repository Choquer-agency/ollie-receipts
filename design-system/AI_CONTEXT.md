# AI Development Context - Ollie Invoice Design System

**This file provides rules and constraints for AI-assisted development with Cursor**

When generating code for Ollie Invoice, follow these strict design system rules:

## 🎨 Design Token Usage

### ✅ ALWAYS DO

- Use CSS custom properties from `design-system/tokens.css`
- Import TypeScript tokens from `design-system/tokens.ts` when needed
- Reference tokens like `var(--primary)`, `var(--spacing-4)`, etc.
- Use semantic color names (`--text-primary`, not hardcoded values)

### ❌ NEVER DO

- Use direct Tailwind color utilities (`text-slate-800`, `bg-gray-100`, etc.)
- Use hardcoded hex/rgb values (`#484848`, `rgb(72, 72, 72)`)
- Bypass the design system with inline styles using non-token values
- Use arbitrary Tailwind values `[#abc123]` except for specific design tokens

**Example - WRONG:**
```tsx
<div className="text-slate-800 bg-gray-100">Content</div>
```

**Example - CORRECT:**
```tsx
<div style={{ color: 'var(--text-primary)', backgroundColor: 'var(--background-muted)' }}>
  Content
</div>
```

## 📝 Typography Rules

### Font Weights

ONLY use these two font weights:
- **400** (Regular) - For all body text, descriptions
- **600** (Semibold) - For all headings, labels, emphasis

**Exception:** H1 in application UI uses **700** (Bold)

❌ Never use: 500 (Medium), 700 (Bold) except H1

### Heading Hierarchy

| Element | Size | Weight | Use Case |
|---------|------|--------|----------|
| H1 | 32px | 700 | Page titles (Dashboard, Settings) |
| H2 | 20px | 600 | Section headings (Recent Invoices) |
| H3 | 18px | 600 | Card titles (Total Revenue) |
| H4 | 16px | 600 | Subheadings (Payment Details) |
| Body | 14px | 400 | Standard content |
| Small | 12px | 400 | Labels, metadata |
| Tiny | 10px | 500 | Very small labels |

**Implementation:**
```tsx
<h1 style={{ 
  fontSize: 'var(--font-size-h1)', 
  fontWeight: 'var(--font-weight-bold)',
  fontFamily: 'var(--font-heading)'
}}>
  Dashboard
</h1>
```

### Text Capitalization

✅ Proper case: "Total hours", "Recent invoices", "Payment details"  
❌ All caps: "TOTAL HOURS", "RECENT INVOICES" (never for body text/labels)

## 🔘 Button Constraints

### Variants (Choose ONE)

1. **Primary** - Main actions (Create, Send, Submit)
2. **Secondary** - Alternative actions (Cancel, Close)
3. **Outline** - Tertiary actions (Dropdown triggers)
4. **Ghost** - Subtle actions (Icon buttons)
5. **Destructive** - Danger actions (Delete, Remove)

### Sizes (Only TWO)

- **Small** (32px height) - Compact UI
- **Default** (40px height) - Standard everywhere

❌ **No "Large" buttons** - This was removed from the system

**Button Implementation:**
```tsx
<button style={{
  backgroundColor: 'var(--primary)',
  color: 'white',
  padding: 'var(--button-padding-md)',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--font-size-body)',
  fontWeight: 'var(--font-weight-semibold)',
  border: 'none',
  cursor: 'pointer',
  height: '40px',
}}>
  Create Invoice
</button>
```

## 📏 Spacing Constraints

### Card Padding (Only TWO)

- **Mobile**: `var(--card-padding-mobile)` (16px)
- **Desktop**: `var(--card-padding-desktop)` (24px)

❌ Don't use: p-3 (12px), p-5 (20px), p-8 (32px) - These were removed

### Gap Spacing

Use spacing tokens: `--spacing-2` (8px), `--spacing-4` (16px), `--spacing-6` (24px)

## 🔲 Border Radius (Only TWO)

- **`--radius-md` (6px)** - Buttons, inputs, badges, tabs
- **`--radius-xl` (12px)** - Cards, panels, containers

❌ Don't use: 3px (sm), 16px (2xl), 9999px (full) - These were removed

**Exception:** Status pills can use `--radius-md` (6px)

## 🎭 Elevation (THREE Levels)

- **Level 0** (Flat) - `box-shadow: none` - Table rows, lists
- **Level 2** (Raised) - `box-shadow: var(--shadow-raised)` - Cards, dropdowns
- **Level 4** (Overlay) - `box-shadow: var(--shadow-overlay)` - Modals

❌ Don't use: Level 1 or Level 3 - These were removed

## 🏷️ Status Pills

When creating status indicators:

```tsx
<div style={{
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--spacing-2)',
  backgroundColor: 'var(--status-success-bg)',
  color: 'var(--status-success-text)',
  padding: '6px 10px',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--font-size-small)',
  fontWeight: 'var(--font-weight-semibold)',
}}>
  <CheckIcon width={16} height={16} />
  <span>Paid</span>
</div>
```

**Rules:**
- Icons are 16×16px and use `currentColor`
- No circular background behind icons
- Gap between icon and text is 6px (`--spacing-2`)
- Padding: 6px vertical, 10px horizontal

## 📚 Z-Index Scale

Always use the predefined scale:

```typescript
--z-base: 0
--z-dropdown: 10
--z-sticky: 20
--z-fixed: 30
--z-backdrop: 40
--z-modal: 50
--z-popover: 60
--z-toast: 70
--z-tooltip: 80
--z-debug: 90
```

❌ Never use arbitrary z-index values like `z-[99]` or `z-50` unless it matches the scale

## 🎬 Transitions

Standard transitions:

```css
transition: var(--transition-default); /* 0.2s for hovers */
transition: var(--transition-fast);    /* 0.1s for presses */
transition: var(--transition-medium);  /* 0.3s for movements */
```

## 📱 Responsive Patterns

### Breakpoints

```typescript
sm: 640px   // Tablet
md: 768px   // Desktop
lg: 1024px  // Large desktop
xl: 1280px  // Extra large
```

### Responsive Typography

For marketing pages, use responsive font sizes:

```tsx
<h1 style={{
  fontSize: 'clamp(2.25rem, 5vw, 3.5rem)', // 36px → 56px
  fontWeight: 600,
}}>
  Hero Headline
</h1>
```

For application UI, use fixed sizes (no responsive scaling).

## 🚨 Common Mistakes to Avoid

### ❌ WRONG

```tsx
// Using Tailwind colors
<div className="text-gray-800 bg-slate-100">

// Hardcoded values
<button style={{ backgroundColor: '#2CA01C' }}>

// Wrong font weights
<h2 style={{ fontWeight: 500 }}>

// Wrong button sizes
<button className="button-large">

// Wrong spacing
<div className="p-8">  // Only use p-4 or p-6 for cards

// All caps text
<span>TOTAL REVENUE</span>
```

### ✅ CORRECT

```tsx
// Using design tokens
<div style={{ 
  color: 'var(--text-primary)', 
  backgroundColor: 'var(--background-muted)' 
}}>

// Token-based button
<button style={{ backgroundColor: 'var(--primary)' }}>

// Correct font weights
<h2 style={{ fontWeight: 'var(--font-weight-semibold)' }}>

// Only small or default buttons
<button style={{ height: '40px' }}>  // Default size

// Correct card padding
<div style={{ padding: 'var(--card-padding-desktop)' }}>

// Proper capitalization
<span>Total revenue</span>
```

## 💡 Code Generation Templates

### Dashboard Card

```tsx
<div style={{
  backgroundColor: 'var(--background-elevated)',
  padding: 'var(--card-padding-desktop)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: 'var(--shadow-raised)',
  border: '1px solid var(--border-default)',
}}>
  <h3 style={{
    fontSize: 'var(--font-size-h3)',
    fontWeight: 'var(--font-weight-semibold)',
    fontFamily: 'var(--font-heading)',
    marginBottom: 'var(--spacing-2)',
  }}>
    Card Title
  </h3>
  <p style={{
    fontSize: 'var(--font-size-body)',
    color: 'var(--text-secondary)',
  }}>
    Description text
  </p>
</div>
```

### Form Input

```tsx
<input
  type="text"
  style={{
    padding: 'var(--spacing-3)',
    fontSize: 'var(--font-size-body)',
    fontFamily: 'var(--font-body)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--background-elevated)',
    color: 'var(--text-primary)',
  }}
  placeholder="Enter text"
/>
```

### Status Badge

```tsx
<span style={{
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--spacing-2)',
  padding: 'var(--button-padding-sm)',
  borderRadius: 'var(--radius-md)',
  backgroundColor: 'var(--status-success-bg)',
  color: 'var(--status-success-text)',
  fontSize: 'var(--font-size-small)',
  fontWeight: 'var(--font-weight-semibold)',
}}>
  <CheckIcon width={16} height={16} />
  Paid
</span>
```

## 🎯 When Generating Components

1. **Always check** if a design token exists for the value you need
2. **Prefer CSS variables** over TypeScript constants when styling
3. **Use semantic names** (--text-primary, not --gray-800)
4. **Follow the constraints** (2 button sizes, 2 font weights, etc.)
5. **Reference this file** if unsure about a pattern

## 📖 Additional Resources

- **Visual Reference**: Open `DesignSystemPreview.html` in browser
- **Quick Reference**: See `design-system/README.md`
- **Full Documentation**: See `design-decisions/DESIGN_DECISIONS.md`
- **CSS Tokens**: Import `design-system/tokens.css`
- **TypeScript Tokens**: Import from `design-system/tokens.ts`

---

**When in doubt, ask:** "Is there a design token for this value?" If yes, use it. If no, check the design system docs before adding a new value.





