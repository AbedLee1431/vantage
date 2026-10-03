# UI / UX Design

> **Status: PROPOSED.** A professional analytics product — never a storefront look. Branding is
> centralized so a rename is a two-file change.

## 1. Design principles

1. **Data-first hierarchy** — the numbers and their provenance are the hero.
2. **Calm density** — information-rich but never cluttered; generous whitespace.
3. **Honest labeling** — demo/estimated/AI content is visibly differentiated, not hidden.
4. **State-complete** — every view handles loading, empty, error, partial, demo, unavailable.
5. **Desktop-first, responsive** — works on tablet/mobile (spec §34), but not re-designed for
   mobile as an MVP goal.

## 2. Brand (centralized, changeable)

- **Working name:** Vantage (placeholder; see ADR-010).
- **Brand module:** one config file exporting name, tagline, legal name, URLs, and links.
- **Tokens:** one Tailwind theme file (colors, typography, radii, shadows, spacing).
- **Rename procedure:** edit the brand config + theme file only.

### Palette (proposal)

| Token | Value | Use |
|-------|-------|-----|
| `primary` | deep slate/navy (`#0F172A`-family) | chrome, headers, primary buttons |
| `accent` | teal/emerald (`#0D9488`-family) | highlights, positive trends, CTAs |
| `accent-2` | amber | warnings, "needs validation" tags |
| `danger` | red | negative trends, errors, alerts |
| `neutral` | gray ramp | backgrounds, borders, text |
| `demo` | violet | **demo data badge** — distinct from real-data color |

### Typography

- Sans (e.g., Inter) for UI/body; **tabular monospace** for numbers/IDs/dates so tables align.
- Clear scale: page title → section → card title → body → caption/metadata.

## 3. Provenance & evidence visual language

Consistent badges and tag styles across every module (spec §26):

| Label | Meaning |
|-------|---------|
| **Demo** | Seeded fictional data |
| **Mock** | Provider-shaped sample, not from any external service |
| **Estimated** | Approximate value, labeled as approximate |
| **Calculated** | Computed by the app from stored data |
| **External** | Actually sourced from a live external service |
| **AI Interpretation** | Model-generated interpretation of evidence |
| **Assumption** | Inferred, not verified |
| **User-provided** | Entered by the user |

AI sections always render evidence as **Observed → Calculated → AI Interpretation → Assumption →
Needs validation** blocks in that fixed order.

## 4. Component library (Tailwind + Radix primitives)

Built as needed (no big prebuilt kit): Button, Input, Select, Badge, Tag, Card, Table
(data-table with sort/filter), StatCard, ChartCard, EmptyState, ErrorState, Skeleton
(loading), DataTable, Drawer/Sheet, Modal, Tabs, Toast, Tooltip, Avatar, Pagination,
ProvenanceBadge, EvidenceBlock, JobStatusPill, UsageMeter.

Accessibility: Radix primitives give keyboard/ARIA support for free; color is never the only
signal (icons + text).

## 5. Application chrome

- **Left sidebar** with grouped nav (see `docs/Features.md` module map) that collapses to icons.
- **Top bar:** global search (⌘K), active organization switcher (read-only in MVP), usage meter,
  plan badge, account menu.
- **Content area:** consistent max-width, breadcrumbs on detail pages, sticky table headers.

### Navigation structure

```
Dashboard
Discover: Products · Stores · Ads · Trends
Research: Competitors · Opportunities · Customer Intelligence
Monitor:  Watchlist · Alerts
AI:       AI Analyst · Reports
Account:  Billing · Settings
```

## 6. Required states (every async view)

| State | Treatment |
|-------|-----------|
| Loading | Skeleton placeholders matching layout; never blank spinners alone |
| Empty | Illustration-free, actionable: what to do next (e.g., "Add products to your watchlist") |
| Error | Clear message + retry; never silent failures |
| Success | Toast/inline confirmation |
| Partial data | Show what exists + an explicit "N records missing" note |
| Demo data | Violet "Demo data" badge + per-card provenance |
| Provider unavailable | Inline "Demo provider in use — no live provider configured" |
| AI processing | Job status pill + progress messaging; results stream in when ready |

## 7. Landing page

Sections: hero (headline + product mock/dashboard screenshot), value props, feature sections,
workflow (Discover→Analyze→Monitor), pricing (from central plan config), FAQ, CTA, footer.
Original copy and design only (spec §33). SEO polish in Phase 9.

## 8. Data presentation rules

- Money always shows currency; never float artifacts.
- Dates show timezone-neutral relative + absolute ("Mar 2, 2026 · 3d ago").
- Trends charts include a plain-language explanation line beneath the chart (FR-TREND-02).
- Tables default to sensible sort; every column is provenance-aware where applicable.
