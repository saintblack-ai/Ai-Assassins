# AI Assassins Investor Deck (Starter)

## Vision & Mission
- Build the category-defining AI intelligence operating platform for individuals, teams, and enterprise operators.
- Deliver real-time, structured, decision-ready briefings with monetized tiered access.

## Problem & Market
- Information overload prevents timely and coherent decisions.
- Teams need one trusted briefing layer combining AI synthesis + live context (markets/weather/calendar/signals).
- TAM spans productivity software, intelligence workflows, and AI copilots across B2C and B2B.

## Product Overview
- Multi-surface app:
  - Web/PWA (`/docs`)
  - Native wrappers (iOS/Android via Capacitor)
  - Cloudflare Worker API gateway
- Core outputs:
  - Overnight overview
  - Markets snapshot
  - Weather and schedule context
  - Mission priorities, truthwave, command note

## Current Traction
- Live PWA architecture deployed through GitHub Pages.
- API gateway and monetization primitives active in Cloudflare Worker.
- Tiered pricing and checkout funnel implemented.
- Native wrapper build pipeline and store metadata templates prepared.

## Business Model
- Subscription SaaS with tiered monetization.
- Upsell from individual users to pro power users and enterprise teams.

## Revenue Streams
- Free tier (acquisition + habit loop)
- Pro monthly subscription
- Elite monthly subscription
- Enterprise annual contracts (custom limits, SLA, integrations)

## Tiered Pricing
- Free: 5 briefs/day
- Pro: 50 briefs/day
- Elite: unlimited
- Enterprise: custom limits / custom policy

## Competitive Analysis
- Competes against generic AI chat tools and static market/news dashboards.
- Differentiation:
  - Structured brief format
  - Tier-governed monetization engine
  - Cross-surface deployment (PWA + native wrappers)
  - Backend-enforced entitlement and usage controls

## Technical Architecture
- Client (PWA / iOS / Android)
  - Cloudflare Worker API Gateway
  - Auth + Tier Validation middleware
  - Revenue event + usage KV tracking
  - OpenAI + external market/weather sources
- Security controls:
  - CORS allowlist
  - Rate limiting
  - Security headers
  - Server-side subscription truth

## Go-to-Market Plan
- Phase 1: PWA launch with paid upgrades.
- Phase 2: Native store launch (TestFlight/Internal tracks).
- Phase 3: Enterprise lead conversion and outbound sales.
- Phase 4: Partnerships and API integrations.

## Expansion & Enterprise Strategy
- Add enterprise compliance controls, SSO, and audit exports.
- Team workspace and role-based views.
- Verticalized briefing templates per industry.

## Ask (Funding Request / Use of Funds)
- Raise to accelerate:
  - Product hardening and reliability
  - Enterprise sales motion
  - Native growth and paid acquisition
  - Security/compliance certifications

## Roadmap
- Q1: Monetization + enforcement stabilization
- Q2: Native launch + enterprise lead funnel
- Q3: Team features + enterprise pilots
- Q4: Scale GTM + international expansion
