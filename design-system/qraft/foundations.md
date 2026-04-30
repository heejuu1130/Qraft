# Qraft Foundations

## 1. Color System

Qraft color is independent from MiniMax and Runway. Preserve the current desert landing palette as the brand base.

### Brand Desert

| Token | Value | Role |
| --- | --- | --- |
| `qraft.background` | `#120b07` | Primary landing background |
| `qraft.backgroundRaised` | `#2a170e` | Shader depth and warm surface undertone |
| `qraft.ink` | `#f5dfbd` | Primary warm text on dark desert |
| `qraft.inkMuted` | `#d2ad7c` | Secondary text and quiet labels |
| `qraft.line` | `#d9ad73` | Hairline dividers and subtle borders |
| `qraft.ember` | `#8d4f31` | Brand accent and active state |
| `qraft.clay` | `#b87345` | Motion dots, hover warmth, secondary accent |
| `qraft.sand` | `#efd3a2` | Highlight and shader light |

### Future UI Component Neutrals

Runway's color lesson is not copied as landing background. For future product UI, use cool neutrals only as component utility layers when a feature needs separation from the desert canvas.

| Token | Value | Role |
| --- | --- | --- |
| `ui.black` | `#000000` | Maximum contrast utility |
| `ui.deep` | `#030303` | Deep modal or media surface |
| `ui.surface` | `#1a1a1a` | Dark component container |
| `ui.border` | `#27272a` | Cool dark border |
| `ui.silver` | `#c9ccd1` | Light divider on dark UI |
| `ui.muted` | `#a7a7a7` | Metadata and subdued copy |
| `ui.light` | `#fefefe` | Light panel background only when needed |
| `ui.cloud` | `#e9ecf2` | Cool light section background only when needed |

## 2. Typography

Typography is adapted from MiniMax and re-scoped for Qraft.

### Font Roles

| Role | Family | Use |
| --- | --- | --- |
| Display | `Outfit` | Hero, section headings, card titles |
| UI | `DM Sans` | Body, navigation, buttons, forms |
| Technical | `DM Mono` | CLI, labels, metadata, code-like interface text |

### Type Scale

| Token | Family | Size | Weight | Line Height | Letter Spacing | Use |
| --- | --- | ---: | ---: | ---: | --- | --- |
| `display.hero` | Outfit | 80px | 500 | 1.10 | 0 | Landing or major page headline |
| `heading.section` | Outfit | 31px | 600 | 1.50 | 0 | Section title |
| `heading.compact` | DM Sans | 32px | 600 | 0.88 | 0 | Dense dashboard or compact header |
| `title.card` | Outfit | 28px | 600 | 1.71 | 0 | Card title |
| `heading.sub` | DM Sans | 24px | 500 | 1.50 | 0 | Mid-tier heading |
| `label.feature` | DM Sans | 18px | 500 | 1.50 | 0 | Feature label |
| `body.large` | DM Sans | 20px | 500 | 1.50 | 0 | Emphasized paragraph |
| `body.default` | DM Sans | 16px | 400 | 1.50 | -0.16px | Standard body |
| `body.strong` | DM Sans | 16px | 700 | 1.50 | 0 | Strong emphasis only |
| `nav.link` | DM Sans | 14px | 500 | 1.50 | 0 | Navigation and links |
| `button.small` | DM Sans | 13px | 600 | 1.50 | 0 | Compact button label |
| `caption` | DM Sans | 13px | 400 | 1.70 | 0 | Metadata and caption |
| `label.small` | DM Sans | 12px | 600 | 1.50 | 0.12em | Tags and badges |
| `micro` | DM Mono | 10px | 500 | 1.80 | 0.18em | Tiny annotations |

### Typography Rules

- Use `DM Sans` for functional UI and product workflows.
- Use `Outfit` only where hierarchy needs architectural presence.
- Use `DM Mono` for command, system, state, and metadata language.
- Prefer 500 weight for emphasis and 600 for section-level clarity.
- Reserve 700 for actual semantic emphasis, not visual decoration.
- Keep uppercase text to structural labels, metadata, and short navigation.

## 3. Layout And Spacing

Layout follows Runway's cinematic and minimal approach, translated to Qraft's service UI.

### Spacing Scale

Use an 8px base rhythm.

`4, 6, 8, 12, 16, 20, 24, 28, 32, 48, 64, 78, 80`

### Layout Rules

- Hero and media-first surfaces may be full-bleed.
- Product UI should use wide, quiet layouts with generous vertical breathing.
- Use spacing and alignment to create hierarchy before adding borders or filled surfaces.
- Avoid stacked decorative cards. Use cards only for repeated items, tools, modals, and true containers.
- Keep max content widths intentional: 1440px for broad pages, 960-1120px for reading/product content, 640-720px for focused forms.

## 4. Containers And Cards

Use Runway's restrained containment model, not MiniMax's rounded card-heavy product gallery.

| Container | Treatment | Use |
| --- | --- | --- |
| Transparent | No fill, optional hairline | Default content grouping |
| Bordered | `1px` line with low opacity | Tool panels, settings, data groups |
| Dark Surface | `ui.surface` or Qraft raised dark | Modals and focused workflows |
| Light Surface | `ui.light` or `ui.cloud` | Rare contrast sections in future service UI |

### Rules

- Components should retreat visually unless they are the active tool.
- Prefer a single hairline border over shadows.
- Do not use purple-tinted MiniMax shadows in Qraft.
- Avoid colorful product-card gradients unless the content itself requires visualization.

## 5. Radius

Runway uses subtle radius only. Qraft should remain sharper and more architectural.

| Token | Value | Use |
| --- | ---: | --- |
| `radius.none` | 0px | Primary Qraft controls and landing overlays |
| `radius.sharp` | 4px | Buttons, small controls |
| `radius.subtle` | 6px | Links, inline controls |
| `radius.card` | 8px | Product UI cards when required |
| `radius.alert` | 16px | Rare status or alert containers |

No pill buttons by default. Pills are allowed only when a mature product pattern clearly needs segmented filtering or chip-like selection.

## 6. Elevation

Qraft uses zero CSS box-shadow by default.

| Level | Treatment | Use |
| --- | --- | --- |
| 0 | Flat, no border | Full-bleed shader or content area |
| 1 | `1px` hairline | Standard containment |
| 2 | Dark or cool surface contrast | Active panel, modal body |
| 3 | Section alternation | Large workflow shift |

Depth should come from:

- shader and media layers
- opacity contrast
- full-width section alternation
- hairline borders
- backdrop blur when content overlays motion or media

## 7. Motion

Motion follows Runway's cinematic restraint and Qraft's silence.

| Element | Duration / Speed | Rule |
| --- | --- | --- |
| Shader motion | 0.02-0.08 preferred | Nearly still |
| UI transition | 500-900ms | Smooth, non-playful |
| Feedback state | Immediate to 2000ms | Clear but quiet |
| Page transition | 700-1000ms | Slow enough to feel intentional |

Avoid bounce, spring, elastic easing, confetti, and decorative micro-motion.

## 8. Application Rules

- Build service screens as tools first, not landing pages.
- Preserve Qraft's desert background identity for brand-level pages.
- Use Runway-derived cool neutrals only for future component surfaces, not as the main brand color.
- Use MiniMax-derived type scale consistently before inventing new text sizes.
- Do not create components from this system until the service surface is defined.

