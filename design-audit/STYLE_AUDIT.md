# STYLE AUDIT — Ollie Invoice Design System
*Design system inventory based on existing implementation as of December 2025*

---

## 1. Typography (Observed)

### Font Families
- **Heading Font**: `p22-mackinac-pro` (serif)
  - Used for: H1, H2, H3, page titles, section headings, hero text
  - Fallback: serif
- **Body Font**: `Inter` (sans-serif)
  - Used for: All body text, UI components, buttons, labels
  - Fallback: system-ui, -apple-system, sans-serif
- **Monospace Font**: `JetBrains Mono`
  - Used for: Code snippets, invoice numbers, transaction IDs
  - Fallback: monospace

### Heading Styles

#### H1 (Main Page Headings)
**Inconsistent implementations found:**
- **Global CSS definition**:
  - Font size: `1.5rem` (24px)
  - Font weight: 500
  - Font family: p22-mackinac-pro
  - Color (light): `#263926` (dark green)
  - Color (dark): `#a8d5a2` (light green)
  - Letter spacing: `-0.02em`

- **Landing Hero H1**:
  - Font size: `text-4xl` (36px) mobile
  - Font size: `sm:text-5xl` (48px) tablet
  - Font size: `lg:text-6xl` (60px) desktop
  - Font weight: 600 (semibold)
  - Line height: 1.1
  - Tracking: tight

- **Dashboard H1**:
  - Font size: `text-2xl` (32px)
  - Font weight: bold
  - Font family: heading

**Finding**: H1 appears in at least 3 different size variants (24px, 32px, 36px-60px responsive)

#### H2 (Section Headings)
**Inconsistent implementations:**
- **Global CSS definition**:
  - Font size: `1.2rem` (19.2px)
  - Font weight: 500
  - Color: `#263926` / `#a8d5a2`
  - Letter spacing: `-0.02em`

- **Landing sections**:
  - Font size: `text-3xl md:text-5xl` (30px → 48px)
  - Font weight: 600
  - Tracking: tight

- **Dashboard sections**:
  - Font size: `text-lg` (18px)
  - Font weight: 600
  - Color: `text-slate-800 dark:text-slate-200`

**Finding**: H2 ranges from 18px to 48px depending on context

#### H3
- Font family: p22-mackinac-pro (heading)
- Font weight: 500
- Letter spacing: `-0.01em`
- Font size: Various implementations (text-lg, text-xl, text-2xl observed)

### Body Text Sizes
- **Base body**: `110%` (applied to body element = ~17.6px at default 16px base)
- **Large text**: `text-lg` (18px), `text-xl` (20px) — used for hero subheadings
- **Regular text**: `text-sm` (14px) — most common for UI components
- **Small text**: `text-xs` (12px) — used for labels, metadata, captions
- **Tiny text**: `text-[10px]` (10px) — used for very small labels in invoice mockups

### Text Colors
- **Primary text (light)**: `#484848` (hsl 0 0% 28%) — charcoal gray
- **Primary text (dark)**: `hsl(0 0% 90%)` — off white
- **Muted text**: `text-muted-foreground` — 42% lightness in light mode, 55% in dark mode
- **H1/H2 special**: `#263926` (dark green) in light mode, `#a8d5a2` (light green) in dark mode
- **Invoice display text**: Uses `text-slate-800`, `text-slate-900`, `text-slate-500` directly (bypassing design system)

### Font Weights
- Regular: 400 (not explicitly defined, browser default)
- Medium: 500 (used for buttons, headings, labels)
- Semibold: 600 (used for large headings, emphasis)
- Bold: 700 (used for card titles, amounts, data emphasis)

**Finding**: Inconsistent weight application — some headings use 500, others 600, others bold

### Letter Spacing
- **Normal**: `0em` (CSS variable defined but not widely used)
- **Tight**: `-0.01em` to `-0.02em` (used on headings)
- **Wide**: `tracking-wide`, `tracking-wider` (used on uppercase labels)

**Finding**: Letter spacing is applied inconsistently — some headings have explicit values, others use Tailwind utilities

---

## 2. Color Usage (Observed)

### Brand Colors

#### Primary Green (`#2CA01C`)
- HSL: `113 70% 37%`
- Used for:
  - Primary buttons
  - "Paid" status badges
  - Revenue chart bars
  - Active states
  - Focus rings
  - CreateInvoiceButton background
  - Links and CTAs
  - Checkmarks and success icons
  
**Variations observed:**
- Hover state: `#238a16` (darker)
- With opacity: `bg-[#2CA01C]/10`, `bg-[#2CA01C]/20` (light backgrounds)
- Status colors: `text-[#2CA01C]`, `bg-[#2CA01C]`

#### Secondary Brand Colors (from brandColors.ts)
Palette of 13 colors available for invoice customization:
- Charcoal: `#1A1A1A` (default)
- Slate: `#475569`
- Red: `#dc2626`
- Orange: `#FF9500`
- Lime: `#65a30d`
- Green: `#15803d`
- Teal: `#0d9488`
- Sky: `#0ea5e9`
- Blue: `#2563eb`
- Indigo: `#4f46e5`
- Purple: `#7e22ce`
- Fuchsia: `#c026d3`
- Pink: `#DB2777`

### Background Colors

#### Light Mode
- **Main background**: `#FAF9F5` (hsl 48 29% 97%) — warm off-white
- **Alt background**: `#FFFFFF` (pure white)
- **Card background**: `#FFFFFF`
- **Sidebar background**: `#FAF9F5` (same as main)
- **Muted background**: `#F0EEE6` (hsl 48 24% 92%) — slightly darker warm gray
- **Secondary**: `#F6F5F1` (hsl 48 23% 95%) — light warm gray

#### Dark Mode
- **Main background**: `hsl(0 0% 10%)` — dark gray
- **Alt background**: `hsl(0 0% 8%)` — darker gray
- **Card background**: `hsl(0 0% 14%)`
- **Sidebar background**: `hsl(0 0% 11%)`
- **Muted background**: `hsl(0 0% 18%)`
- **Secondary**: `hsl(0 0% 20%)`

**Finding**: Light mode uses warm, beige-toned backgrounds. Dark mode uses pure neutral grays.

### Border Colors

#### Light Mode
- **Primary border**: `#F6F5F1` (hsl 48 23% 95%) — very light warm gray
- **Card border**: Same as primary
- **Input border**: `hsl(48 23% 90%)` — slightly darker
- **Button outline**: `rgba(0,0,0, 0.10)` — 10% black
- **Badge outline**: `rgba(0,0,0, 0.05)` — 5% black

#### Dark Mode
- **Primary border**: `hsl(0 0% 20%)` — dark gray
- **Card border**: `hsl(0 0% 18%)`
- **Popover border**: `hsl(0 0% 22%)`
- **Input border**: `hsl(0 0% 25%)`
- **Button outline**: `rgba(255,255,255, 0.10)` — 10% white
- **Badge outline**: `rgba(255,255,255, 0.05)` — 5% white

### Status Colors
**Hardcoded in tailwind.config.ts:**
- **Online/Success**: `rgb(34 197 94)` — green
- **Away/Warning**: `rgb(245 158 11)` — amber
- **Busy/Error**: `rgb(239 68 68)` — red
- **Offline/Disabled**: `rgb(156 163 175)` — gray

**Used throughout components:**
- Paid invoices: `#2CA01C` (primary green), `text-green-700`, `bg-green-100`
- Unpaid: `text-blue-600`, `bg-blue-50`
- Overdue: `text-red-600`, `bg-red-50`
- Draft: gray tones

**Finding**: Status colors are applied inconsistently — sometimes using design tokens, sometimes hardcoded Tailwind colors

### Chart Colors
Five distinct colors defined for multi-series charts:
- Chart 1: `hsl(220 70% 50%/60%)` — blue
- Chart 2: `hsl(160 60% 45%/55%)` — teal
- Chart 3: `hsl(30 80% 55%/65%)` — orange
- Chart 4: `hsl(280 65% 60%/70%)` — purple
- Chart 5: `hsl(340 75% 55%/65%)` — pink

### Gradient & Overlay Colors
- Dialog overlay: `bg-black/80` — 80% black
- Shine effect: `rgba(255,255,255,0.15)` — 15% white
- Elevate-1: `rgba(0,0,0, 0.03)` light / `rgba(255,255,255, 0.04)` dark
- Elevate-2: `rgba(0,0,0, 0.08)` light / `rgba(255,255,255, 0.09)` dark
- Background gradients: `from-primary/5`, `from-border`, `to-transparent` (multiple implementations)

### Direct Color Usage (Bypassing Design System)
**Found in components:**
- Landing page stats: `text-slate-800`, `text-slate-900`, `text-slate-500`, `text-slate-200`
- Dashboard: `text-slate-800 dark:text-slate-200`
- Testimonial avatars: `bg-foreground text-background`
- Specific green shades: `bg-emerald-100 text-emerald-800`, `bg-green-100 dark:bg-green-900/30`

**Finding**: Designers sometimes bypass CSS variables and use direct Tailwind colors, creating inconsistency

---

## 3. Spacing System (Observed)

### Base Unit
- Tailwind's default `0.25rem` (4px) spacing scale
- CSS variable: `--spacing: 0.25rem` (defined but not used)

### Common Padding Patterns

#### Cards
- Desktop: `p-6` (24px) — most common
- Mobile: `p-4` (16px)
- Compact: `p-5` (20px)
- Large cards: `p-8` (32px) — used on Landing pricing cards
- Dialog content: `p-6` (24px)

#### Page Padding
- Mobile: `px-4 py-4` (16px)
- Tablet: `sm:px-6 sm:py-6` (24px)
- Desktop: `md:px-8 md:py-8` (32px)
- Max-width container: `max-w-7xl mx-auto` — 80rem (1280px)
- Dashboard: `max-w-7xl mx-auto space-y-6 md:space-y-8`

#### Button Padding
- Default: `px-4 py-2` — horizontal 16px, vertical 8px
- Small: `px-3` — 12px horizontal
- Large: `px-8` — 32px horizontal
- Icon button: `h-9 w-9` — 36px square

#### Component Spacing
- CardHeader: `p-6` with `space-y-1.5` (6px between elements)
- CardContent: `p-6 pt-0` (top padding removed)
- Table cells: No explicit padding, relies on table cell defaults
- Tabs list: `p-1` (4px internal padding)
- Badge: `px-2.5 py-0.5` (10px horizontal, 2px vertical)

### Gap Patterns
**Found throughout:**
- Tight: `gap-1` (4px), `gap-2` (8px)
- Standard: `gap-3` (12px), `gap-4` (16px)
- Loose: `gap-6` (24px), `gap-8` (32px)
- Grid gaps: `gap-3`, `gap-4`, `gap-6`, `gap-8` depending on density

### Vertical Spacing (Stack Spacing)
- Tight sections: `space-y-4` (16px)
- Standard sections: `space-y-6` (24px)
- Loose sections: `space-y-8` (32px)
- Landing page: `py-16`, `py-20 md:py-28`, `py-24` (varied section padding)

### One-Off Spacing Values
**Found in various components:**
- Sidebar width: `16rem` (256px)
- Icon sidebar width: `3.5rem` (56px)
- Header height: `h-16` (64px)
- Minimum tap target: `min-h-[44px]` (iOS recommendation)
- Dialog inset mobile: `inset-4` (16px from edges)
- Marquee item spacing: `mx-8` (32px between logos)
- FAQ padding: `py-6` per item (24px)

**Finding**: Spacing is fairly consistent with Tailwind defaults, but some custom values and inconsistent application patterns exist (e.g., page padding varies by route)

---

## 4. Component Inventory

### Buttons

#### Variants
1. **Default** (Primary)
   - Background: `bg-primary` (#2CA01C green)
   - Text: white
   - Border: 1px solid (with dynamic brightness adjustment)
   - Hover: Elevate effect (overlay darkens)
   - Active: Scale 0.97, elevate-2 effect

2. **Destructive**
   - Background: `bg-destructive` (red)
   - Text: white
   - Border: 1px solid destructive color
   - Hover/Active: Same elevation pattern

3. **Outline**
   - Background: transparent (shows parent background)
   - Border: `var(--button-outline)` (10% opacity)
   - Text: inherits current color
   - Shadow: `shadow-xs`
   - Hover: Elevate effect

4. **Secondary**
   - Background: `bg-secondary` (#F6F5F1 light warm gray)
   - Text: `text-secondary-foreground` (dark gray)
   - Border: 1px solid
   - Hover: Elevate effect

5. **Ghost**
   - Background: transparent
   - Border: 1px transparent (to prevent layout shift)
   - Text: inherits
   - Hover: Elevate effect

#### Sizes
- **Small**: `min-h-8 px-3 text-xs` — 32px height
- **Default**: `min-h-9 px-4 py-2` — 36px height
- **Large**: `min-h-10 px-8` — 40px height
- **Icon**: `h-9 w-9` — 36px square

#### Special Buttons
**CreateInvoiceButton** (custom CSS):
- Background: `#2CA01C` (solid, not using CSS var)
- Padding: `12px 20px`
- Height: `44px` (fixed, mobile-friendly)
- Border radius: `6px`
- Font size: `15px`
- Font weight: 500
- Shadow: `0 4px 14px rgba(0,0,0,0.12)`
- Hover shadow: `0 6px 18px rgba(0,0,0,0.15)`
- Active: Scale 0.97
- Bounce animation on release: cubic-bezier timing
- Plus icon rotation: 90deg on hover
- Shine gradient animation

**SendInvoiceButton** (separate component with similar styling)

#### Border Radius
- Standard buttons: `rounded-md` (6px)
- Landing CTAs: `rounded-full` (pill shape)
- CreateInvoiceButton: `6px` (hardcoded)

### Cards

#### Base Card
- Border radius: `rounded-xl` (12px)
- Border: 1px solid `border-card-border`
- Background: `bg-card`
- Shadow: `shadow-sm` (minimal)
- Class name: `shadcn-card`

#### Card Sections
- **Header**: `p-6`, `space-y-1.5` between children
- **Title**: `text-2xl font-semibold leading-none tracking-tight`
- **Description**: `text-sm text-muted-foreground`
- **Content**: `p-6 pt-0`
- **Footer**: `flex items-center p-6 pt-0`

#### Card Variants Observed
- Standard: `rounded-xl border bg-card`
- Landing features: `rounded-2xl` (16px), `shadow-notion`, `hover:-translate-y-1`
- Invoice cards (interactive): `rounded-xl shadow-2xl` with custom animations
- Pricing cards: `rounded-2xl p-6 md:p-8 border` (larger padding)

### Inputs

#### Base Input
- Height: `h-9` (36px) — matches button height
- Padding: `px-3 py-2`
- Border: 1px solid `border-input`
- Border radius: `rounded-md` (6px)
- Background: `bg-background`
- Font size: `text-sm` (desktop), `text-base` (mobile — prevents zoom)
- Focus: 2px ring with `ring-ring` color, 2px offset

#### Textarea
- Similar styling to input
- Resizable by default
- No fixed height

#### Select Trigger
- Height: `h-9`
- Padding: `pl-2 pr-3 py-2`
- Border, radius, focus: Same as input
- Chevron icon: 4x4, 50% opacity

### Badges

#### Variants
1. **Default**
   - Background: `bg-primary` (green)
   - Text: white
   - Border: transparent
   - Shadow: `shadow-xs`

2. **Secondary**
   - Background: `bg-secondary` (light gray)
   - Text: `text-secondary-foreground`
   - Border: transparent

3. **Destructive**
   - Background: `bg-destructive` (red)
   - Text: white
   - Border: transparent

4. **Outline**
   - Background: transparent
   - Border: `var(--badge-outline)` (5% opacity)
   - Shadow: `shadow-xs`

#### Styling
- Padding: `px-2.5 py-0.5`
- Border radius: `rounded-md` (6px)
- Font size: `text-xs`
- Font weight: 600 (semibold)
- Whitespace: nowrap (never wraps)
- Hover: Elevate effect

**InvoiceStatusBadge** uses variant="secondary" with custom color classes applied

### Tables

#### Structure
- Wrapper: `rounded-lg border overflow-hidden`
- Mobile: Custom card layout with borders
- Desktop: Standard table with `hover-elevate` on rows
- Header cells: `font-semibold`
- Borders: Bottom border on rows, last row no border

#### Cell Styling
- Padding: Relies on browser defaults
- Font: `font-medium` for key data (invoice #, amounts)
- Text color: `text-muted-foreground` for secondary info
- Hover: Entire row gets elevation effect

### Tabs

#### TabsList
- Background: `bg-muted`
- Padding: `p-1` (4px internal)
- Height: `h-10` (40px)
- Border radius: `rounded-md`
- Horizontal scrollable on mobile: `overflow-x-auto scrollbar-hide`

#### TabsTrigger
- Padding: `px-3 py-2`
- Min height: `36px`
- Font size: `text-sm`
- Font weight: 500
- Border radius: `rounded-sm` (3px)
- Active state: `bg-background text-foreground shadow-sm`
- Inactive: `text-muted-foreground`

### Dialogs/Modals

#### Overlay
- Background: `bg-black/80` (80% opacity)
- Z-index: 50
- Fade in/out animation

#### Content
- Mobile: `inset-4` (16px from edges), full width
- Desktop: Centered, `max-w-lg` (512px), `max-h-[85vh]`
- Padding: `p-6`
- Border radius: `rounded-lg` (8px)
- Shadow: `shadow-lg`
- Close button: 10x10 mobile, 8x8 desktop (larger tap target on mobile)

#### Title & Description
- Title: `text-lg font-semibold leading-none tracking-tight`
- Description: `text-sm text-muted-foreground`

### Popovers

#### Structure
- Background: `bg-popover`
- Border: 1px solid `border-popover-border`
- Border radius: `rounded-md`
- Shadow: `shadow-md`
- Z-index: 50
- Slide/zoom animations based on side

### Sidebar

#### Dimensions
- Width: `16rem` (256px) expanded
- Icon width: `3.5rem` (56px) collapsed
- Background: `bg-sidebar`
- Border: Right border with `border-sidebar-border`

#### Menu Items
- Padding: Various (SidebarMenuButton component handles)
- Active state: Different background/color
- Hover: Elevation effect
- Icons: `h-4 w-4` (16px)

### Avatars

#### Sizes
- Default: `h-8 w-8` (32px) — user menu
- Varies by use case

#### Fallback
- Text: User initials
- Font size: `text-xs`
- Font weight: 500
- Background: Based on theme

### Empty States

#### Styling
- Centered layout: `flex flex-col items-center justify-center`
- Padding: `py-16 px-4`
- Icon circle: `w-12 h-12 rounded-full bg-muted`
- Title: `text-base font-medium`
- Description: `text-sm text-muted-foreground max-w-xs`

### Charts

#### RevenueChart
- Min height: `350px`
- Bar colors: Green (#2CA01C) for paid, Amber for unpaid
- Grid lines: Light, subtle
- Legend: 3x3 colored squares with labels

---

## 5. Layout & Structure

### Container Widths
- **Max width**: `max-w-7xl` (1280px) — most dashboard pages
- **Medium width**: `max-w-6xl` (1152px) — Landing page sections
- **Small width**: `max-w-4xl` (896px) — Pricing, narrow content
- **Form width**: `max-w-3xl` (768px) — centered forms
- **Dialog width**: `max-w-lg` (512px) desktop

### Page Padding
**Horizontal:**
- Mobile: `px-4` (16px)
- Tablet: `sm:px-6` (24px)
- Desktop: `md:px-8` (32px)
- Landing: `px-6` consistent across breakpoints

**Vertical:**
- Mobile: `py-4` (16px)
- Tablet: `sm:py-6` (24px)
- Desktop: `md:py-8` (32px)
- Landing sections: `py-16`, `py-20 md:py-28`, `py-24` (varies)

### Grid Patterns

#### Dashboard Metrics
- Mobile: `grid-cols-1`
- Tablet: `sm:grid-cols-2`
- Desktop: `lg:grid-cols-5` (5 metric cards)
- Gap: `gap-4` (16px)

#### Landing Features
- Mobile: `grid-cols-1`
- Desktop: `md:grid-cols-2` (2-column feature grid)
- Mini features: `grid-cols-2 md:grid-cols-4` (4 columns on desktop)
- Gap: `gap-3`, `gap-4`, `gap-6` depending on section

#### Invoices Table
- Responsive: Switches between card layout (mobile) and table (desktop)
- Breakpoint: `md:` (768px)

### Flex Patterns

#### Header Layout
- `flex items-center justify-between` — extremely common pattern
- Gap: Usually `gap-3` or `gap-4`
- Responsive: Often switches to column on mobile (`flex-col sm:flex-row`)

#### Sidebar Layout
- `flex h-dvh w-full` — parent container
- Sidebar: Fixed width
- Main content: `flex-1 overflow-y-auto`

### Section Spacing
- Tight: `space-y-4` (16px)
- Standard: `space-y-6` (24px) — most common
- Loose: `space-y-8` (32px)
- Dashboard sections: `space-y-6 md:space-y-8` (responsive)

### Z-Index Layers
**Observed values:**
- Sidebar trigger: 0 (default stacking)
- Overlays/modals: 50
- Dropdowns/popovers: 50
- Elevate effects: 999 (for :after pseudo-elements)
- Shine effects: 20
- Negative: -1, -10 (background elements)

**Finding**: Z-index usage is inconsistent — some components use 50, some use arbitrary high values

---

## 6. Motion & Interaction

### Transitions

#### Timing Functions
- **Ease**: Standard easing (most common)
- **Ease-out**: Accordion animations
- **Ease-in-out**: Smooth bidirectional transitions
- **Linear**: Infinite marquee animations
- **Custom cubic-bezier**: 
  - `(.28,.03,.2,1.4)` — bounce animation
  - `(0.25, 0.1, 0.3, 1.4)` — plus icon rotation

#### Durations
- **Fast**: `0.1s` — button press
- **Standard**: `0.2s` — most hover states, accordion
- **Medium**: `0.25s`, `0.3s` — color/background transitions
- **Slow**: `0.5s`, `0.6s` — fade-ins, page transitions
- **Infinite**: `20s linear infinite` — marquee

### Animations

#### Defined Keyframes
1. **accordion-down** / **accordion-up**: 0.2s ease-out
2. **marquee**: translateX animation, 20s linear infinite
3. **bounceBack**: Button release animation, 0.22s cubic-bezier
4. **shine-move**: Gradient sweep, 0.6s ease-out

#### Framer Motion Patterns
**Found in Landing.tsx:**
- FadeIn: `opacity: 0 → 1`, `y: 20 → 0`, duration 0.5s
- Stagger: 0.1s delay between children
- Scale animations: `0.9 → 1` on CTA sections
- Rotate: Plus icon `0 → 90deg`, `0 → 45deg` for FAQ
- Interactive invoice: Multi-step state machine with various durations

### Hover States

#### Buttons
- Background color darkens
- Elevation increases (shadow grows)
- Plus icon rotates 90deg (CreateInvoiceButton)
- Shine animation triggers

#### Cards
- `hover:-translate-y-1` — lifts up slightly
- `hover:scale-105` — grows slightly (testimonials)
- Shadow increases: `shadow-notion` → `shadow-notion-hover`

#### Table Rows
- `hover-elevate` class — overlay brightens/darkens

#### Links
- `hover:underline` — underline appears
- `hover:text-foreground` — muted text becomes full opacity

### Active/Press States

#### Buttons
- `scale(0.97)` — shrinks slightly
- Shadow reduces
- Followed by bounce-back animation on release

#### Elevation System
- **hover-elevate**: Adds `var(--elevate-1)` overlay on hover
- **active-elevate**: Adds overlay on active state
- **hover-elevate-2**: Stronger elevation (--elevate-2)
- **toggle-elevate**: For toggled states (checkboxes, switches)
- Overlays stack with borders, adjusting inset by -1px

**Finding**: Custom elevation system using pseudo-elements instead of shadows to create layered brightness adjustments

### Focus States

#### Inputs/Selects
- 2px ring with `ring-ring` color (#2CA01C green)
- 2px offset from element
- Transition: Usually not animated

#### Buttons
- Same ring pattern
- `focus-visible:outline-none` — removes browser outline

### Disabled States
- Opacity: 50%
- Pointer events: none
- Color: Usually muted automatically via opacity

---

## 7. Implicit Design Characteristics

Based on the observed implementation, here's the design DNA of Ollie Invoice:

### Design Density
**AIRY**
- Generous padding (p-6 cards standard)
- Large tap targets (44px CreateInvoiceButton, 36px default buttons)
- Ample whitespace between sections (space-y-6 to space-y-8)
- Low information density prioritizes readability

### Surface Treatment
**FLAT TO SOFT**
- Shadows are deliberately minimal or zeroed out in CSS variables
- "shadow-notion" classes provide subtle, soft shadows instead of dramatic elevation
- Borders are preferred over shadows for separation
- Custom elevation system uses overlays, not shadow depth

### Corner Radius
**SOFT / ROUNDED**
- Cards: 12px (rounded-xl) to 16px (rounded-2xl)
- Buttons: 6px standard, but CTAs use pill shape (rounded-full)
- Inputs: 6px (rounded-md)
- CreateInvoiceButton: 6px hardcoded
- Avatars: fully rounded (rounded-full)
- Range: 3px (smallest) to full rounding (largest)

**Finding**: Generally soft corners, but not excessively rounded — falls in "modern but professional" range

### Color Palette
**WARM NEUTRAL WITH EXPRESSIVE ACCENT**
- Backgrounds in light mode have warm beige undertones (#FAF9F5, #F6F5F1)
- Primary brand green (#2CA01C) is vibrant and energetic
- Dark mode uses pure neutral grays (no warm tint)
- Text is predominantly gray-based, not pure black
- Avoids stark contrast — prefers softer, comfortable reading tones

### Tone & Personality
**APPROACHABLE PROFESSIONAL**
- Friendly sans-serif (Inter) for UI
- Classic serif (p22-mackinac-pro) for headings adds sophistication
- Playful micro-interactions (rotating plus, shine effects, bounce)
- Not overly serious or corporate
- Not playful to the point of unprofessional
- Landing page copy is warm and conversational

### Interaction Style
**RESPONSIVE & DELIGHTFUL**
- Immediate feedback on interactions (hover, press)
- Smooth, physics-based animations (bounce, ease curves)
- Generous hit targets for mobile
- Micro-interactions add personality without being distracting
- Elevation system creates subtle depth perception

### Typography Hierarchy
**MODERATE CONTRAST**
- Heading sizes range dramatically (24px to 60px) depending on context
- Body text is slightly larger than web default (110% = ~17.6px)
- Weight contrast is moderate (500 to 700 range, not ultra-light to ultra-bold)
- Line height is comfortable (1.5 to 1.75 for body, tighter for headings)

### Consistency Level
**MEDIUM**

**Strengths:**
- Component library (shadcn/ui) provides consistent base patterns
- Color system using CSS variables is well-structured
- Spacing follows Tailwind scale fairly consistently
- Border radius values are standardized (3px, 6px, 9px, 12px)

**Weaknesses:**
- Heading sizes are inconsistent across pages (H1 is 24px, 32px, or 60px)
- Status colors sometimes use design tokens, sometimes hardcoded Tailwind colors
- Some components bypass design system (direct slate-800, slate-500 usage)
- Shadow system is defined but mostly zeroed out, with custom "notion" shadows added separately
- Button sizes and padding vary between standard components and custom buttons
- Z-index values are ad-hoc, not a defined scale

### Accessibility Observations
**GOOD MOBILE CONSIDERATION**
- Minimum 44px tap targets for mobile (CreateInvoiceButton, close buttons)
- Font size increases to `text-base` on mobile inputs (prevents zoom)
- Touch-friendly padding and spacing
- Scrollable tabs on mobile with `scrollbar-hide`
- Responsive breakpoints at standard sizes (sm: 640px, md: 768px, lg: 1024px)

**COLOR CONTRAST**
- Text colors (#484848 on #FAF9F5) meet WCAG AA
- Primary green (#2CA01C) is tested for contrast
- Muted text may be borderline on some backgrounds

**FOCUS INDICATORS**
- Visible focus rings on interactive elements
- 2px ring with offset provides clear indication

---

## 8. Observations & Inconsistencies Summary

### Critical Inconsistencies

1. **Heading Sizes**: H1 appears as 24px (global CSS), 32px (dashboard), and 60px (landing hero) — no clear system

2. **Color Bypass**: Components sometimes use `text-slate-800`, `text-slate-900` directly instead of design tokens, creating potential theming issues

3. **Shadow System**: CSS variables define shadow values but set them all to transparent. Separate "shadow-notion" utilities were added. This creates confusion about which shadow system to use.

4. **Status Colors**: Invoice statuses use a mix of primary green, hardcoded red-600/blue-600, and custom color classes — no unified approach

5. **Button Styling**: CreateInvoiceButton uses hardcoded `#2CA01C` and custom CSS file, while other buttons use design tokens. This creates maintenance burden.

6. **Spacing**: Page padding varies by route — some use px-4/px-6/px-8 responsive, Landing uses px-6 consistently. No clear guideline.

7. **Z-Index**: No defined scale — values range from -10 to 999 with no system

### Strengths

1. **CSS Variables Foundation**: Well-structured color system with light/dark mode support via HSL

2. **Component Library**: shadcn/ui provides solid, accessible component base

3. **Border Radius**: Clear system (3px, 6px, 9px, 12px) is defined and mostly followed

4. **Elevation System**: Custom hover-elevate/active-elevate approach is clever and consistent where used

5. **Mobile-First**: Clear attention to touch targets and responsive behavior

6. **Brand Identity**: Primary green (#2CA01C) is consistently applied and memorable

### Design Maturity
This design system is in a **"Growing Pains"** phase:
- Foundation is solid (Tailwind + shadcn/ui)
- Custom patterns are emerging (elevation, CreateInvoiceButton)
- Inconsistencies suggest rapid feature development without full design system governance
- Would benefit from consolidation and documentation

### Recommended Next Steps (If This Were Not Read-Only)
1. Standardize heading sizes into clear H1-H6 scale
2. Eliminate direct color usage, enforce design tokens only
3. Decide on shadow system (CSS variables or notion classes)
4. Create unified status color palette
5. Document spacing scale for page layouts
6. Define z-index scale (e.g., 0, 10, 20, 50, 100, 1000)
7. Consolidate custom button styles into design system

---

*End of Style Audit*

*This document reflects the state of the design as implemented, not as it should be. All findings are factual observations from the codebase as of the audit date.*

