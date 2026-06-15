<div align="center">

# Pathfinder

**Emergency floorplan mapping and 3D facility documentation - open source, white-label.**

*A platform by [Pathfinder LiDAR Solutions](https://pathfinder-lidar.pages.dev).*

</div>

---

Pathfinder is a web portal where facility owners (schools, 911 centers, universities, government,
healthcare) and the teams that map them collaborate on emergency floorplans, place NFPA-standard
safety markers, and explore survey-grade 3D scans of the building - mp4 walkthroughs plus interactive
Gaussian-splat scenes captured with FJD Trion LiDAR. It exports responder-ready printed maps and
NG911-aligned data.

It is a ground-up SvelteKit rewrite of the original ELS911 portal, keeping the battle-tested 2D
annotation and NFPA map-export engines and adding 3D scans, a multi-school hierarchy, collaboration,
global search, and a drop-in white-label brand layer.

## Editions

Pathfinder is **open core**.

| | Community Edition | Pathfinder Pro |
|---|---|---|
| License | AGPL-3.0 (this repo) | Commercial ([`COMMERCIAL.md`](./COMMERCIAL.md)) |
| Hosting | Self-host | Hosted SaaS by Pathfinder LiDAR |
| Branding | Single brand | **White-label, multi-brand, drop-in** |
| 2D annotation engine | Yes | Yes |
| NFPA safety mapping + PDF export | Yes (single map) | Yes + **batch pipeline** |
| 3D scans | **mp4 walkthrough playback** | + **interactive splat viewer, measurement, 3D markers, version compare** |
| Org hierarchy + dashboards | Single org | **District > Facility > Building** |
| Collaboration | Comments + resolve | + **@mentions, email notifications, share links** |
| Global search | Per project | **Cross-org** |
| Compliance | In-app audit log | + **NG911/NENA export, audit export, trust page** |
| Auth | JWT + roles | + **SSO/SAML/MFA** |
| Billing | n/a | **Stripe subscriptions** |
| Support | Community | Priority + SLA |

Pathfinder Pro is operated commercially by Pathfinder LiDAR Solutions with paying customers. The
Community Edition is a genuinely useful self-hostable portal, not a crippled demo.

## White-label in one step

The brand layer (`src/lib/brand/`) is the single source of truth. To rebrand:

1. Add a profile: `src/lib/brand/profiles/<id>.ts` (name, logo, colors, fonts, contact, legal).
2. Set `VITE_BRAND=<id>`.

No component edits - every component reads `var(--brand-*)` tokens. Ships with the **Pathfinder**
(default) and **ELS911** profiles.

## Stack

SvelteKit (Svelte 5) - Cloudflare Pages / Workers - D1 (SQLite) - R2 (object storage) - KV -
PDF.js (2D) - Spark / THREE.js (3D Gaussian splats, delivered as SPZ) - Vitest + Playwright.

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
npm run test:unit    # Vitest
npm run test:e2e     # Playwright (captures screenshots)
npm run deploy       # wrangler pages deploy (direct)
```

Cloudflare resources (D1/R2/KV) and secrets are configured per `docs/01-specification.md` section 12.

## Development

This project is **test-first (TDD)**. Every acceptance criterion in
[`docs/03-acceptance-criteria.md`](./docs/03-acceptance-criteria.md) maps to a test; user-visible
behavior is verified with Playwright screenshots. See [`AGENTS.md`](./AGENTS.md) for the rules every
contributor (human or AI) follows, and [`CONTRIBUTING.md`](./CONTRIBUTING.md) to get started.

## Documentation

| Doc | What |
|---|---|
| [Specification](./docs/01-specification.md) | Product + technical spec (architecture, data model, API) |
| [User Stories](./docs/02-user-stories.md) | 70 stories across 14 epics |
| [Acceptance Criteria](./docs/03-acceptance-criteria.md) | 97 Given/When/Then criteria |
| [TDD Plan](./docs/04-tdd-plan.md) | Test-writing prompts, one per criterion |
| [Sprint Plan](./docs/05-sprint-plan.md) | Retroactive baseline + 8-sprint roadmap |
| [Editions & Integrations](./docs/06-editions-and-integrations.md) | Open-core model + third-party services |
| [Research](./docs/research/) | Competitive, compliance, 3D, and UX briefs (cited) |

Polished PDFs of these live in [`docs/pdf/`](./docs/pdf/).

## Security

Facility safety maps are sensitive-but-unclassified. The code is public; **secrets and real facility
data never are**. See `AGENTS.md` (Never section) and the spec's Security chapter.

## License

Community Edition: [AGPL-3.0](./LICENSE). Commercial licensing for Pathfinder Pro: see
[`COMMERCIAL.md`](./COMMERCIAL.md). Copyright (c) 2026 Pathfinder LiDAR Solutions.
