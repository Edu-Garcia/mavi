# MAVI Design System

Generated for an accessibility-audit SaaS dashboard (professional, academic, high contrast).
Palette aligned with the project presentation.

## Product

- Type: SaaS dashboard / audit tool
- Audience: developers, QA, researchers
- Tone: clear, calm, trustworthy

## Style

- Pattern: Soft UI Evolution (clean surfaces, visible borders, no glassmorphism)
- Avoid: emoji icons, layout-shifting hover scale, low-contrast muted text

## Color

| Token | Hex | Use |
| --- | --- | --- |
| `--color-bg` | `#F7F5F0` | Cream page background |
| `--color-alt` | `#EDEFF3` | Alternate surfaces, inputs, snippets |
| `--color-surface` | `#FFFEFB` | Cards, form |
| `--color-peach` | `#FCE6D5` | Labels, selected chips |
| `--color-ink` | `#4A5568` | Body text |
| `--color-muted` | `#6B7280` | Secondary text |
| `--color-on-navy` | `#D6DCE8` | Text on navy |
| `--color-primary` | `#14213D` | Titles, dark header, primary actions |
| `--color-primary-hover` | `#1D2D52` | Hover on navy |
| `--color-accent` | `#F08A3C` | Highlights on dark |
| `--color-accent-dark` | `#A8470F` | Overtitles, emphasis on light |
| `--color-border` | `#141413` | Thin card borders |
| `--color-critical` | `#B42318` | Severity critical |
| `--color-serious` | `#A8470F` | Severity serious |
| `--color-moderate` | `#C45C26` | Severity moderate |
| `--color-minor` | `#4A5568` | Severity minor |

## Typography

- Headings: Plus Jakarta Sans
- Body: Source Sans 3
- Scale: `text-sm` / `text-base` / `text-lg` / `text-2xl` / `text-4xl`
- Body line-height: `leading-relaxed`

## Effects

- Radius: `rounded-xl` (12px) for cards, `rounded-lg` for controls
- Shadow: `shadow-sm` only
- Transition: `duration-200`
- Focus: `focus-visible:ring-2 focus-visible:ring-accent`

## Overflow

- Page never grows a horizontal scrollbar
- Long HTML snippets and diffs scroll horizontally inside their own row
- Print/PDF reports wrap snippets (`pre-wrap`) instead of clipping

## Anti-patterns

- No emoji as icons
- No `scale` hover that shifts layout
- No `text-slate-400` body text
- No invisible borders (`border-white/10`)
- No page-wide `overflow-x` caused by `<pre>` content
