/**
 * Ollie Invoice Design System - TypeScript Tokens
 * 
 * Type-safe design tokens for programmatic access in React components.
 * Use these when you need to reference design values in JavaScript/TypeScript.
 * 
 * For CSS, prefer using the CSS custom properties from tokens.css
 * 
 * @example
 * ```tsx
 * import { colors, typography } from './design-system/tokens';
 * 
 * const MyComponent = () => (
 *   <div style={{ color: colors.primary }}>
 *     <h1 style={{ fontSize: typography.h1.size }}>Hello</h1>
 *   </div>
 * );
 * ```
 */

// ==================== COLORS ====================

export const colors = {
  // Brand
  primary: '#2CA01C',
  primaryHover: '#238a16',
  headingAccentLight: '#263926',
  headingAccentDark: '#a8d5a2',
  
  // Backgrounds
  background: '#FAF9F5',
  backgroundElevated: '#FFFFFF',
  backgroundMuted: '#F0EEE6',
  
  // Text
  textPrimary: '#484848',
  textSecondary: '#6B6B6B',
  textTertiary: '#8C8C8C',
  
  // Borders
  borderDefault: '#F6F5F1',
  borderStrong: '#E8E6E0',
  
  // Status Colors
  status: {
    paid: {
      bg: '#E8F5E9',
      text: '#1B5E20',
    },
    pending: {
      bg: '#FFF8E1',
      text: '#F57F17',
    },
    overdue: {
      bg: '#FFEBEE',
      text: '#B71C1C',
    },
    sent: {
      bg: '#E3F2FD',
      text: '#0D47A1',
    },
    draft: {
      bg: '#F5F5F5',
      text: '#424242',
    },
    processing: {
      bg: '#F3E5F5',
      text: '#4A148C',
    },
    approved: {
      bg: '#E0F2F1',
      text: '#004D40',
    },
    cancelled: {
      bg: '#FFF3E0',
      text: '#E65100',
    },
  },
} as const;

// ==================== TYPOGRAPHY ====================

export const typography = {
  // Font Families
  fontFamilies: {
    heading: "'p22-mackinac-pro', serif",
    body: "'Inter', system-ui, -apple-system, sans-serif",
    mono: "'JetBrains Mono', monospace",
  },
  
  // Marketing Type Scale
  marketing: {
    heroH1: {
      sizeMobile: '2.25rem',   // 36px
      sizeDesktop: '3.5rem',   // 56px
      weight: 600,
      lineHeight: 1.1,
      letterSpacing: '-0.02em',
    },
    h2: {
      sizeMobile: '1.75rem',   // 28px
      sizeDesktop: '2.5rem',   // 40px
      weight: 600,
      lineHeight: 1.2,
      letterSpacing: '-0.015em',
    },
    h3: {
      sizeMobile: '1.5rem',    // 24px
      sizeDesktop: '2rem',     // 32px
      weight: 600,
      lineHeight: 1.3,
      letterSpacing: '-0.01em',
    },
    largeBody: {
      sizeMobile: '1.125rem',  // 18px
      sizeDesktop: '1.25rem',  // 20px
      weight: 400,
      lineHeight: 1.6,
    },
    body: {
      sizeMobile: '1rem',      // 16px
      sizeDesktop: '1.125rem', // 18px
      weight: 400,
      lineHeight: 1.6,
    },
  },
  
  // Application UI Type Scale
  app: {
    h1: {
      size: '2rem',      // 32px
      weight: 700,
      lineHeight: 1.2,
      letterSpacing: '-0.015em',
    },
    h2: {
      size: '1.25rem',   // 20px
      weight: 600,
      lineHeight: 1.3,
      letterSpacing: '-0.01em',
    },
    h3: {
      size: '1.125rem',  // 18px
      weight: 600,
      lineHeight: 1.4,
      letterSpacing: '-0.005em',
    },
    h4: {
      size: '1rem',      // 16px
      weight: 600,
      lineHeight: 1.4,
    },
    body: {
      size: '0.875rem',  // 14px
      weight: 400,
      lineHeight: 1.5,
    },
    small: {
      size: '0.75rem',   // 12px
      weight: 400,
      lineHeight: 1.4,
    },
    tiny: {
      size: '0.625rem',  // 10px
      weight: 500,
      lineHeight: 1.3,
      letterSpacing: '0.01em',
    },
  },
  
  // Font Weights
  weights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const;

// ==================== SPACING ====================

export const spacing = {
  // Base units (in px for calculations, use rem in CSS)
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  
  // Semantic spacing
  card: {
    mobile: 16,    // p-4
    desktop: 24,   // p-6
  },
  
  page: {
    mobile: 16,    // px-4
    tablet: 24,    // px-6
    desktop: 32,   // px-8
  },
  
  button: {
    sm: { vertical: 6, horizontal: 12 },
    md: { vertical: 8, horizontal: 16 },
  },
} as const;

// ==================== BORDER RADIUS ====================

export const radius = {
  md: '6px',   // Buttons, inputs, badges, tabs
  xl: '12px',  // Cards, panels, containers
} as const;

// ==================== SHADOWS / ELEVATION ====================

export const shadows = {
  none: 'none',
  raised: '0 2px 8px rgba(0, 0, 0, 0.06)',    // Level 2
  overlay: '0 16px 48px rgba(0, 0, 0, 0.12)', // Level 4
} as const;

// ==================== Z-INDEX ====================

export const zIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  backdrop: 40,
  modal: 50,
  popover: 60,
  toast: 70,
  tooltip: 80,
  debug: 90,
} as const;

// ==================== TRANSITIONS ====================

export const transitions = {
  fast: '0.1s ease',
  default: '0.2s ease',
  medium: '0.3s ease',
  slow: '0.5s ease',
} as const;

// ==================== BREAKPOINTS ====================

export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

// ==================== BUTTON VARIANTS ====================

export const buttonVariants = [
  'primary',
  'secondary',
  'outline',
  'ghost',
  'destructive',
] as const;

export const buttonSizes = ['sm', 'md'] as const;

// ==================== TYPE EXPORTS ====================

export type ColorToken = keyof typeof colors;
export type StatusType = keyof typeof colors.status;
export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radius;
export type ShadowToken = keyof typeof shadows;
export type ZIndexToken = keyof typeof zIndex;
export type TransitionToken = keyof typeof transitions;
export type BreakpointToken = keyof typeof breakpoints;
export type ButtonVariant = typeof buttonVariants[number];
export type ButtonSize = typeof buttonSizes[number];





