---
name: Field Engineering & Heavy Machinery PWA
colors:
  surface: '#f8f9ff'
  surface-dim: '#ccdbf3'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e6eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d5e3fc'
  on-surface: '#0d1c2e'
  on-surface-variant: '#5a4136'
  inverse-surface: '#233144'
  inverse-on-surface: '#eaf1ff'
  outline: '#8e7164'
  outline-variant: '#e2bfb0'
  surface-tint: '#a04100'
  primary: '#a04100'
  on-primary: '#ffffff'
  primary-container: '#ff6b00'
  on-primary-container: '#572000'
  inverse-primary: '#ffb693'
  secondary: '#4b5f80'
  on-secondary: '#ffffff'
  secondary-container: '#c3d8ff'
  on-secondary-container: '#4a5e7f'
  tertiary: '#006c4a'
  on-tertiary: '#ffffff'
  tertiary-container: '#31ac7d'
  on-tertiary-container: '#003925'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbcc'
  primary-fixed-dim: '#ffb693'
  on-primary-fixed: '#351000'
  on-primary-fixed-variant: '#7a3000'
  secondary-fixed: '#d5e3ff'
  secondary-fixed-dim: '#b3c7ee'
  on-secondary-fixed: '#031b39'
  on-secondary-fixed-variant: '#334767'
  tertiary-fixed: '#85f8c4'
  tertiary-fixed-dim: '#68dba9'
  on-tertiary-fixed: '#002114'
  on-tertiary-fixed-variant: '#005137'
  background: '#f8f9ff'
  on-background: '#0d1c2e'
  surface-variant: '#d5e3fc'
typography:
  headline-xl:
    fontFamily: Space Grotesk
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
  headline-xl-mobile:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
  body-lg:
    fontFamily: IBM Plex Sans
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  body-md:
    fontFamily: IBM Plex Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: IBM Plex Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system is engineered specifically for heavy machinery monitoring, civil engineering telemetry, and harsh-condition field operations. It balances utilitarian field resilience with high-precision engineering software semantics.

### Brand Personality & Emotional Impact
- **Utilitarian & Resilient:** Emulates industrial instrumentation, physical ruggedized diagnostics, and aeronautic-grade safety consoles.
- **High-Visibility & Decisive:** Built to prevent costly errors under extreme operational stress and outdoor direct sunlight. Every control communicates clear mechanical intent.
- **Authoritative & Robust:** Combines architectural precision with functional safety accents to instill operational confidence.

### Design Movement
The visual language merges **Tactile Industrial Precision** with **Functional Swiss Modernism**:
- Razor-sharp structural scaffolding with defined containment borders.
- Tactile, high-affordance pressable surfaces optimized for gloved interactions and rugged touchscreens.
- Dense, structured telemetry layouts stripped of superfluous decorative clutter.

## Colors

The palette is tuned specifically for high-glare outdoor environments and critical machinery diagnostics.

### Palette Architecture
- **Primary Accent (`#FF6B00` - Industrial Safety Orange):** Reserved strictly for actionable primary commands, critical warnings, active operational highlights, and key production metrics. Must never be diluted through low-contrast backgrounds.
- **Core Identity (`#0B2240` - Deep Swiss Navy):** Delivers bedrock visual weight. Governs headlines, major container titles, high-priority iconography, and technical status bars. Replaces pure black to preserve depth while maintaining AAA contrast against light grounds.
- **System Status (`#059669` - Forest Green):** Indicates operational health, hardware telemetry locks, and network heartbeats (e.g., active telemetry feeds, online engines, connected sensors).
- **Secondary Neutral (`#475569` - Slate):** High-density technical secondary typography, metadata labels, unit indicators, and structural dividers. Strictly maintained at high contrast to ensure outdoor legibility.
- **Canvas & Surface Base:** Background base is `#F8F9FA` with elevated work surfaces in pure `#FFFFFF`, bounded by `#E2E8F0` structural perimeter lines.

## Typography

The typographic hierarchy uses three specialized typefaces optimized for engineering data density and high legibility.

### Font Role Allocation
- **Display & Section Titles (`Space Grotesk`):** Delivers geometric, industrial authority across dashboard panels, module viewports, and primary equipment titles.
- **Body & Controls (`IBM Plex Sans`):** Pragmatic, robust sans-serif engineered for human-machine interfaces. It remains crisp on anti-glare touch panels.
- **Telemetry & Labels (`JetBrains Mono`):** Dedicated to serial numbers, GPS coordinates, torque/hydraulic values, timestamps, and equipment status pills. Monospaced tabular alignment guarantees instantaneous comparative scanning.

### Outdoor Legibility Constraints
- Body and label copy used in operational contexts must never fall below `13px` to preserve legibility under direct sunlight.
- `label-sm` (11px) is restricted strictly to non-critical auxiliary metadata and hardware pin diagrams.

## Layout & Spacing

Field operations require rapid touch targeting, even when wearing work gloves or operating in high-vibration cabins.

### Grid & Ergonomics
- **Touch Target Threshold:** All actionable elements maintain a minimum physical hit target of `48px x 48px` regardless of screen density.
- **Adaptive Canvas Model:**
  - **Handheld / Mobile (Field PWA):** Single-column stack with dynamic full-width equipment telemetry modules, a fixed bottom execution dock, and `1rem` safe-area canvas margins.
  - **Rugged Tablet / In-Cab Display:** 6-column fluid structure with split viewport: machinery diagram/status on the primary 4-column span, live parameter controls on the secondary 2-column dock.
  - **Desktop / Engineering Workstation:** 12-column fixed grid (max-width `1600px`), dual-pane side navigation, persistent system telemetry header, and `1.5rem` internal gutters.

## Elevation & Depth

To prevent wash-out under high ambient daylight, this design system rejects blurry, low-contrast shadows in favor of **Crisp Borders and Direct Surface Tiers**.

### Depth Layers
- **Base Layer (Ground `#F8F9FA`):** The structural viewport foundation for non-interactive gutters and workspace framing.
- **Surface Layer (Module Surface `#FFFFFF`):** High-contrast containment cards framed by a solid `1px` stroke in `#E2E8F0`. No ambient blur required for separation.
- **Elevated Controls (Interactive Tools & Overlays):** Interactive elements employ a crisp directional offset (`0px 2px 0px #CBD5E1`) paired with a tight contact shadow (`0px 3px 6px rgba(11, 34, 64, 0.08)`). This provides a physical, mechanical keycap appearance.
- **Critical Interventions (Modals & Emergency Stops):** Framed with a prominent `2px` border in `#0B2240` and a high-density drop shadow (`0px 12px 28px rgba(11, 34, 64, 0.22)`).

## Shapes

The interface balances modern ergonomics with the structured geometry of industrial instrumentation.

### Corner Radius System
- The base radius scale uses `roundedness: 2` (8px base radius, 16px for large containment cards).
- **8px (`rounded-md`):** Buttons, segmented switches, telemetry inputs, chips, and field dialogs.
- **12px to 16px (`rounded-lg` / `rounded-xl`):** Machinery parameter cards, hydraulic monitoring widgets, map overlays, and modal views.
- **Pill / Fully-Rounded:** Restricted solely to operational pulse chips and real-time status pills (e.g., active telemetry connection badges).

## Components

### Buttons & Critical Triggers
- **Primary Machinery Trigger:** Solid `#FF6B00` fill, white `#FFFFFF` text in `Space Grotesk` (semi-bold), 8px border radius, minimum height of `48px`. Pressed state applies a physical mechanical inset (`transform: translateY(1px)`).
- **Secondary Command:** `#0B2240` background with pure white typography, providing solid optical contrast for high-priority secondary operations.
- **Structural Outline Button:** `#FFFFFF` background, `1.5px` border in `#E2E8F0`, text colored `#0B2240`. Hover transitions border to `#0B2240`.

### Status Pills & Live Telemetry Indicators
- **Connection Pulses:** Background `#ECFDF5`, border `1px solid #A7F3D0`, text `#059669` in `JetBrains Mono` 13px. Features an animated `8px` pulsating dot in `#059669` denoting live telemetry locks (e.g., "SMTP Connecté", "Actif", "En ligne").
- **Warning & Fault Indicators:** Background `#FFF7ED`, border `1px solid #FFEDD5`, text `#FF6B00` with warning iconography.

### Cards & Telemetry Containers
- Pure white `#FFFFFF` container surfaces framed by `1px solid #E2E8F0`. 
- Card headers feature an internal border divider in `#F1F5F9`, isolating equipment metadata (`Space Grotesk` 16px) from body operational parameters.

### Data Inputs & Steppers
- Minimum input height of `48px` to facilitate reliable field data entry.
- Background `#FFFFFF`, border `1.5px solid #CBD5E1`, text `#0B2240` in `IBM Plex Sans` 14px. Focus states display a crisp `2px` outline in `#FF6B00` with zero blur.
- Number incrementers feature large split tactile stepper buttons (`+` / `-`) on opposing edges for rapid thumb input.

### Checkboxes, Toggles & Switches
- **Switches:** Heavy industrial sliding toggles with a defined `28px` physical track height and a pure white elevated mechanical thumb knob.
- **Checkboxes:** `20px x 20px` touch box, `2px solid #475569`, filling with `#FF6B00` upon selection with an industrial-weight white checkmark.