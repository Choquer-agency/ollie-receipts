# Design System Implementation Guide

**How to integrate the Ollie Invoice Design System into your React application**

## 🎯 Overview

Your design system is now production-ready! This guide walks you through integrating it into your React/TypeScript application.

## 📂 What You Have

```
/design-system/
  ├── tokens.css       ← Import this into your React app
  ├── tokens.ts        ← Import for programmatic access
  ├── README.md        ← Quick reference when building
  └── AI_CONTEXT.md    ← Rules for Cursor AI

/design-decisions/
  ├── DESIGN_DECISIONS.md
  └── design_canonical.json

DesignSystemPreview.html  ← Open in browser for visual reference
```

## 🚀 Step-by-Step Integration

### Step 1: Import CSS Tokens

In your main entry file (`src/index.tsx` or `src/App.tsx`):

```tsx
// src/index.tsx or src/App.tsx
import './design-system/tokens.css';
```

This makes all CSS custom properties available throughout your app.

### Step 2: Start Using Design Tokens

#### Option A: Using CSS Variables (Recommended)

```tsx
// Component.tsx
const DashboardCard = () => (
  <div style={{
    backgroundColor: 'var(--background-elevated)',
    padding: 'var(--card-padding-desktop)',
    borderRadius: 'var(--radius-xl)',
    boxShadow: 'var(--shadow-raised)',
    border: '1px solid var(--border-default)',
  }}>
    <h2 style={{
      fontFamily: 'var(--font-heading)',
      fontSize: 'var(--font-size-h2)',
      fontWeight: 'var(--font-weight-semibold)',
      color: 'var(--text-primary)',
      marginBottom: 'var(--spacing-4)',
    }}>
      Recent Invoices
    </h2>
    <p style={{
      fontSize: 'var(--font-size-body)',
      color: 'var(--text-secondary)',
    }}>
      You have 12 unpaid invoices
    </p>
  </div>
);
```

#### Option B: Using TypeScript Tokens

```tsx
// Component.tsx
import { colors, typography, spacing, radius, shadows } from './design-system/tokens';

const DashboardCard = () => (
  <div style={{
    backgroundColor: colors.backgroundElevated,
    padding: `${spacing.card.desktop}px`,
    borderRadius: radius.xl,
    boxShadow: shadows.raised,
    border: `1px solid ${colors.borderDefault}`,
  }}>
    <h2 style={{
      fontFamily: typography.fontFamilies.heading,
      fontSize: typography.app.h2.size,
      fontWeight: typography.weights.semibold,
      color: colors.textPrimary,
      marginBottom: `${spacing[4]}px`,
    }}>
      Recent Invoices
    </h2>
  </div>
);
```

### Step 3: Create Reusable Components

Build a component library using your design tokens:

#### Button Component

```tsx
// components/Button.tsx
import React from 'react';
import './design-system/tokens.css';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md';
  children: React.ReactNode;
  onClick?: () => void;
}

export const Button: React.FC<ButtonProps> = ({ 
  variant = 'primary', 
  size = 'md',
  children,
  onClick 
}) => {
  const styles: React.CSSProperties = {
    padding: size === 'sm' ? 'var(--button-padding-sm)' : 'var(--button-padding-md)',
    borderRadius: 'var(--radius-md)',
    fontSize: size === 'sm' ? 'var(--font-size-small)' : 'var(--font-size-body)',
    fontWeight: 'var(--font-weight-semibold)',
    fontFamily: 'var(--font-body)',
    border: 'none',
    cursor: 'pointer',
    transition: 'var(--transition-default)',
    height: size === 'sm' ? '32px' : '40px',
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: 'var(--primary)',
      color: 'white',
    },
    secondary: {
      backgroundColor: 'var(--background-muted)',
      color: 'var(--text-primary)',
    },
    outline: {
      backgroundColor: 'transparent',
      color: 'var(--text-primary)',
      border: '1px solid var(--border-strong)',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: 'var(--text-primary)',
    },
    destructive: {
      backgroundColor: 'var(--status-error-text)',
      color: 'white',
    },
  };

  return (
    <button 
      style={{ ...styles, ...variantStyles[variant] }}
      onClick={onClick}
    >
      {children}
    </button>
  );
};
```

#### Status Badge Component

```tsx
// components/StatusBadge.tsx
import React from 'react';

type StatusType = 'paid' | 'pending' | 'overdue' | 'sent' | 'draft' | 'processing' | 'approved' | 'cancelled';

interface StatusBadgeProps {
  status: StatusType;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

const statusMap: Record<StatusType, { bg: string; text: string }> = {
  paid: { bg: 'var(--status-success-bg)', text: 'var(--status-success-text)' },
  pending: { bg: 'var(--status-warning-bg)', text: 'var(--status-warning-text)' },
  overdue: { bg: 'var(--status-error-bg)', text: 'var(--status-error-text)' },
  sent: { bg: 'var(--status-info-bg)', text: 'var(--status-info-text)' },
  draft: { bg: 'var(--status-draft-bg)', text: 'var(--status-draft-text)' },
  processing: { bg: 'var(--status-processing-bg)', text: 'var(--status-processing-text)' },
  approved: { bg: 'var(--status-approved-bg)', text: 'var(--status-approved-text)' },
  cancelled: { bg: 'var(--status-cancelled-bg)', text: 'var(--status-cancelled-text)' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, children, icon }) => (
  <span style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--spacing-2)',
    backgroundColor: statusMap[status].bg,
    color: statusMap[status].text,
    padding: '6px 10px',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-size-small)',
    fontWeight: 'var(--font-weight-semibold)',
  }}>
    {icon && <span style={{ width: 16, height: 16, display: 'flex' }}>{icon}</span>}
    {children}
  </span>
);
```

#### Card Component

```tsx
// components/Card.tsx
import React from 'react';

interface CardProps {
  children: React.ReactNode;
  padding?: 'mobile' | 'desktop';
  elevation?: 'flat' | 'raised' | 'overlay';
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  padding = 'desktop',
  elevation = 'raised' 
}) => {
  const shadowMap = {
    flat: 'none',
    raised: 'var(--shadow-raised)',
    overlay: 'var(--shadow-overlay)',
  };

  return (
    <div style={{
      backgroundColor: 'var(--background-elevated)',
      padding: padding === 'mobile' ? 'var(--card-padding-mobile)' : 'var(--card-padding-desktop)',
      borderRadius: 'var(--radius-xl)',
      boxShadow: shadowMap[elevation],
      border: '1px solid var(--border-default)',
    }}>
      {children}
    </div>
  );
};
```

### Step 4: Using with Tailwind (Optional)

If you're using Tailwind CSS, extend your config to use design tokens:

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: 'var(--primary)',
        background: 'var(--background)',
        'background-elevated': 'var(--background-elevated)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        // ... add more as needed
      },
      fontFamily: {
        heading: 'var(--font-heading)',
        body: 'var(--font-body)',
      },
      spacing: {
        // Map to design system spacing
        1: 'var(--spacing-1)',
        2: 'var(--spacing-2)',
        3: 'var(--spacing-3)',
        4: 'var(--spacing-4)',
        6: 'var(--spacing-6)',
        8: 'var(--spacing-8)',
      },
      borderRadius: {
        md: 'var(--radius-md)',
        xl: 'var(--radius-xl)',
      },
    },
  },
};
```

## 🤖 Using with Cursor AI

When asking Cursor AI to build features, reference your design tokens:

### Good Prompts:

> "Create a dashboard card using the design system tokens. Use H3 for the title with --font-size-h3, --card-padding-desktop for padding, --radius-xl for border radius, and --shadow-raised for elevation."

> "Build a status badge component that supports all status types from the design system (paid, pending, overdue, etc.) using the status color tokens."

> "Create a button component with primary and secondary variants following the design system. Use --button-padding-md, --radius-md, and only sm/md sizes."

### Bad Prompts:

❌ "Create a dashboard card with nice styling"  
❌ "Make a green button"  
❌ "Add some padding to this component"

The more specific you are with token names, the better Cursor will follow your design system!

## 📖 Reference Files

### When Building Features:

1. **Quick lookup** → `design-system/README.md`
2. **Visual reference** → Open `DesignSystemPreview.html` in browser
3. **AI rules** → `design-system/AI_CONTEXT.md`
4. **Deep dive** → `design-decisions/DESIGN_DECISIONS.md`

### Common Token Lookups:

| Need | Token |
|------|-------|
| Primary color | `var(--primary)` |
| Background | `var(--background)` |
| Card background | `var(--background-elevated)` |
| Text color | `var(--text-primary)` |
| Card padding | `var(--card-padding-desktop)` |
| Button padding | `var(--button-padding-md)` |
| Border radius (button) | `var(--radius-md)` |
| Border radius (card) | `var(--radius-xl)` |
| Card shadow | `var(--shadow-raised)` |
| Spacing (16px) | `var(--spacing-4)` |
| Heading size | `var(--font-size-h2)` |
| Body text size | `var(--font-size-body)` |

## ⚠️ Important Rules

1. **Never bypass tokens** - Don't use `#484848` or `text-slate-800`
2. **Only 2 font weights** - 400 (Regular) and 600 (Semibold)
3. **Only 2 button sizes** - Small (32px) and Default (40px)
4. **Only 2 border radius** - 6px and 12px
5. **Only 2 card padding** - 16px (mobile) and 24px (desktop)
6. **Proper capitalization** - "Total hours" not "TOTAL HOURS"

## 🎨 Example: Complete Feature

Here's a complete invoice card using the design system:

```tsx
import React from 'react';
import { Card } from './components/Card';
import { StatusBadge } from './components/StatusBadge';
import { Button } from './components/Button';

const InvoiceCard = ({ invoice }) => (
  <Card elevation="raised" padding="desktop">
    {/* Header */}
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      marginBottom: 'var(--spacing-4)'
    }}>
      <h3 style={{
        fontFamily: 'var(--font-heading)',
        fontSize: 'var(--font-size-h3)',
        fontWeight: 'var(--font-weight-semibold)',
        color: 'var(--text-primary)',
        margin: 0,
      }}>
        {invoice.title}
      </h3>
      <StatusBadge status={invoice.status}>
        {invoice.status}
      </StatusBadge>
    </div>

    {/* Details */}
    <div style={{ marginBottom: 'var(--spacing-6)' }}>
      <p style={{
        fontSize: 'var(--font-size-body)',
        color: 'var(--text-secondary)',
        marginBottom: 'var(--spacing-2)',
      }}>
        Client: {invoice.client}
      </p>
      <p style={{
        fontSize: 'var(--font-size-body)',
        color: 'var(--text-secondary)',
      }}>
        Amount: ${invoice.amount}
      </p>
    </div>

    {/* Actions */}
    <div style={{ display: 'flex', gap: 'var(--spacing-3)' }}>
      <Button variant="primary" size="md">
        View Invoice
      </Button>
      <Button variant="outline" size="md">
        Send Reminder
      </Button>
    </div>
  </Card>
);

export default InvoiceCard;
```

## 🎯 Next Steps

1. ✅ Import `design-system/tokens.css` into your app
2. ✅ Start using CSS variables in your components
3. ✅ Build reusable component library (Button, Card, Badge, etc.)
4. ✅ Reference `design-system/README.md` when building
5. ✅ Open `DesignSystemPreview.html` for visual reference
6. ✅ Ask Cursor AI to generate components using design tokens

---

**Need help?** Reference the files in `/design-system/` or open `DesignSystemPreview.html` for visual examples!








