---
name: Digital Papercraft
colors:
  surface: '#fbf9f5'
  surface-dim: '#dbdad6'
  surface-bright: '#fbf9f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3ef'
  surface-container: '#efeeea'
  surface-container-high: '#eae8e4'
  surface-container-highest: '#e4e2de'
  on-surface: '#1b1c1a'
  on-surface-variant: '#424842'
  inverse-surface: '#30312e'
  inverse-on-surface: '#f2f0ed'
  outline: '#737971'
  outline-variant: '#c2c8bf'
  surface-tint: '#47664b'
  primary: '#47664b'
  on-primary: '#ffffff'
  primary-container: '#86a789'
  on-primary-container: '#1f3c25'
  inverse-primary: '#adcfaf'
  secondary: '#51606b'
  on-secondary: '#ffffff'
  secondary-container: '#d2e2ee'
  on-secondary-container: '#55656f'
  tertiary: '#7e525b'
  on-tertiary: '#ffffff'
  tertiary-container: '#c5919b'
  on-tertiary-container: '#502b33'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#c8ebca'
  primary-fixed-dim: '#adcfaf'
  on-primary-fixed: '#03210c'
  on-primary-fixed-variant: '#304d35'
  secondary-fixed: '#d5e5f1'
  secondary-fixed-dim: '#b9c9d5'
  on-secondary-fixed: '#0e1d26'
  on-secondary-fixed-variant: '#3a4953'
  tertiary-fixed: '#ffd9df'
  tertiary-fixed-dim: '#f0b8c2'
  on-tertiary-fixed: '#311119'
  on-tertiary-fixed-variant: '#643b44'
  background: '#fbf9f5'
  on-background: '#1b1c1a'
  surface-variant: '#e4e2de'
  paper-background: '#FDFBF7'
  sage-primary: '#86A789'
  sage-muted: '#B2C8BA'
  slate-text: '#36454F'
  ink-blue: '#4A6274'
  highlighter-yellow: '#F9E897'
  error-red: '#D9534F'
  success-green: '#5F7A61'
typography:
  display-reading:
    fontFamily: Playfair Display
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 52px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  reading-body:
    fontFamily: Playfair Display
    fontSize: 20px
    fontWeight: '400'
    lineHeight: 32px
  ui-body-lg:
    fontFamily: Outfit
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  ui-body-md:
    fontFamily: Outfit
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  ui-label-bold:
    fontFamily: Outfit
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  ui-label-sm:
    fontFamily: Outfit
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  quote-serif:
    fontFamily: Playfair Display
    fontSize: 22px
    fontWeight: '400'
    lineHeight: 34px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  page-margin: 2.5rem
  section-gap: 3rem
  reading-width-max: 720px
  gutter-ui: 1.5rem
  stack-sm: 0.5rem
  stack-md: 1rem
  stack-lg: 2rem
---

## Brand & Style

The design system moves away from clinical, cold AI tropes in favor of a **Digital Papercraft** aesthetic. This approach centers on a "human-crafted" feel that is approachable, academic, and encouraging. The design narrative is built on the metaphor of physical study materials—layered paper, hand-annotated highlights, and tactile surfaces—reinterpreted for a modern, high-performance learning environment.

### Design Style: Tactile / Layered
This system utilizes a mix of physical metaphors and modern clean UI.
- **Paper Layering:** Surfaces do not just "exist"; they sit on top of one another with subtle depth, mimicking sheets of paper on a desk.
- **Organic Imperfection:** Eschewing perfect geometric precision for slightly irregular border radii and hand-drawn style accents (icons, underlines, and flourishes).
- **Academic Focus:** The interface is designed to "recede" during deep reading, using its tactile nature to provide comfort rather than distraction.

## Colors

The color palette is anchored in a **warm cream background** (#FDFBF7) that reduces eye strain compared to pure white, mimicking high-quality book paper. 

- **Primary (Soft Sage):** Used for focus areas, primary actions, and progress indicators. It represents growth and calm.
- **Secondary (Deep Slate):** Reserved for high-contrast reading text to ensure maximum legibility and an "ink-on-paper" feel.
- **Neutral:** A range of cream and off-white tones used to define different layers of paper surfaces.
- **Functional Accents:** A "Highlighter Yellow" is used for student evidence selection, while "Ink Blue" is used for teacher-specific annotations and secondary UI elements.

## Typography

The typography system creates a sharp distinction between **The Content** (Source text/Passages) and **The Interface** (Quiz controls/Navigation).

- **Serif (Playfair Display):** Used for all "Reading Content." It evokes the feeling of a literary journal or a classic textbook. Increased line height (1.6x) and generous font sizing are used to enhance long-form reading comfort.
- **Sans-Serif (Outfit):** Used for "Assessment Content" and UI. Its clean, geometric nature provides a functional contrast to the serif reading pane, signaling to the student when they are in "active task mode" vs. "passive reading mode."

## Layout & Spacing

The layout philosophy is **Content-First Minimalism**. It utilizes a fixed-width central column for reading to maintain optimal line lengths (around 65–75 characters).

- **Reading Mode:** A centered, focused column with massive side margins to eliminate peripheral distractions.
- **Dashboard Mode:** A more dense, 12-column grid for Teacher Analytics, using "cards" as paper modules on the cream desktop surface.
- **Mobile Adaptivity:** On mobile, margins shrink to 1rem, and the "layered" paper effect is simplified to avoid visual clutter on smaller screens. 
- **The "Gutter" Rule:** Interaction elements (buttons/chips) never crowd the text; they are separated by at least 2rem of whitespace to preserve the "clean paper" feel.

## Elevation & Depth

Depth is communicated through **Tonal Layering** and **Soft Ambient Shadows** rather than heavy gradients.

- **Level 0 (Base):** The Cream (#FDFBF7) background represents the physical desk.
- **Level 1 (Paper):** Secondary surfaces like cards or reading panes use a slightly lighter or pure white background with a very soft, wide-spread shadow (15% opacity Slate) to look like a sheet of paper laying flat.
- **Level 2 (Active Paper):** Modals or floating feedback chips use a more pronounced shadow with a slight vertical offset, suggesting they are being "held" above the surface.
- **Depth Texture:** Apply a very subtle noise/grain texture (3-5% opacity) to paper surfaces to enhance the tactile feel and break the digital "flatness."

## Shapes

The shape language is defined by **Organic Irregularity**. While mostly "Rounded" (0.5rem), key UI elements should avoid perfect symmetry.

- **Container Corners:** Main containers use a 0.5rem radius, but for a "hand-cut" effect, consider using CSS `border-radius` values that vary slightly (e.g., `12px 10px 14px 11px`) to mimic manual paper cutting.
- **Highlights:** Evidence selection should use a "rough-edge" background-color box that looks like a felt-tip highlighter stroke.
- **Icons:** Use hand-drawn style iconography with variable line weights to reinforce the "human-crafted" brand personality.

## Components

### Buttons & CTAs
- **Primary:** Sage Green background with Deep Slate text. Use a "thick" bottom border (2px) in a slightly darker sage to give the button a physical, pressable feel.
- **Secondary:** Ghost style with a "sketchy" hand-drawn border.

### Reading Pane & Highlighter
- **Reading Container:** A "sheet" of paper that spans the max-reading-width. 
- **Highlighter Tool:** When text is selected, the background-color transitions to `highlighter-yellow` with a slight "bleed" over the line height to look authentic.

### Assessment Cards
- **Quiz Questions:** Each question sits on its own white "index card" component. Transitions between questions should feel like sliding one card off the stack to reveal the next.
- **Checkboxes/Radios:** Use hand-drawn "X" or "Check" marks inside slightly wobbly boxes rather than standard browser circles/squares.

### Feedback & Gamification
- **Streaks & Badges:** Use "sticker" metaphors. These components should have a white border and a slightly more aggressive drop shadow, looking like physical stickers placed on the page.
- **Progress Bars:** Designed to look like a pencil-shaded bar, filling with Sage Green as the student progresses.