# Archaios Launch Marketing Content

## 1) Brand Messaging & Positioning

### Core Value Proposition
Archaios gives operators a daily command brief that turns market, mission, and monetization signals into immediate actions.

### Hero Headline
Run your day like a command operation.

### Hero Subheadline
AI Assassins / Archaios delivers a 07:00 strategic brief with priorities, revenue moves, and execution directives so you can move with clarity.

### Feature Highlights
- 07:00 Daily Commander Brief
- Tier-aware access controls (Free, Pro, Elite, Enterprise)
- Revenue and usage insight APIs
- Stripe-powered upgrades in one click
- Operational dashboard for briefing + action

### Why Archaios Is Unique
- Built for execution, not dashboard noise
- Combines intelligence output + monetization control
- PWA-first with mobile-ready interface
- Server-side entitlement enforcement via Worker + KV

### Target User Profiles
- Solo founders and operators
- Growth-focused creators and analysts
- Lean startup teams
- Enterprise innovation squads

## 2) Landing Page Copy

### Hero
Headline: Your Daily Command Brief, Ready Before You Are  
Subheadline: Start every morning with structured intelligence across strategy, revenue, and execution.

Primary CTA: Start Free  
Secondary CTA: Open Control Center

### Benefits
- Daily clarity in one view
- Faster decisions with fewer tabs
- Built-in monetization pathways
- Scales from solo to enterprise

### Social Proof
"Archaios became our daily operating ritual."  
"We replaced fragmented tools with one command workflow."

### Feature Explanations
- Commander Mode: mission, risks, and priorities
- Revenue Layer: checkout, webhook, tier updates
- Dashboard Layer: status, latest brief, upgrade actions

### CTA Statements
- Start your first brief in under one minute.
- Upgrade when your velocity grows.
- Move from free signal to premium execution.

## 3) Pricing Page Copy

### Free Tier
For builders getting started.  
Includes: 5 briefs/day, core dashboard, baseline commander outputs.

### Pro Tier
For active operators who need higher throughput.  
Includes: 50 briefs/day, premium daily brief unlocks, stronger execution cadence.

### Elite Tier
For power users and high-output teams.  
Includes: unlimited briefs, advanced strategic depth, priority workflows.

### Enterprise Tier
For organizations with custom deployment and scale requirements.  
Includes: custom limits, premium controls, dedicated onboarding path.

### Comparison (Monthly / Yearly)
- Free: $0 / $0
- Pro: $4.99 / $49
- Elite: $14.99 / $149
- Enterprise: Custom / Custom

### Payment Reassurance
- Secure checkout by Stripe
- No card data stored in our app
- Cancel anytime
- Server-side subscription enforcement

## 4) Stripe Payment Flow (Product Copy)

1. User selects Pro, Elite, or Enterprise.
2. Frontend calls `POST /api/checkout`.
3. Worker creates Stripe Checkout Session.
4. User completes payment on Stripe-hosted page.
5. Stripe sends `checkout.session.completed` (and related events) to `/api/webhook`.
6. Worker verifies signature and updates `USER_STATE` tier.
7. Dashboard refreshes via `GET /api/me`.

## 5) Email Sequence

### Welcome
Subject: Welcome to Archaios  
Body: Your command center is live. Generate your first brief and set your operating rhythm.

### Trial Expiration Reminder
Subject: Your premium window is ending soon  
Body: Keep premium briefing unlocked by upgrading to Pro.

### Free → Pro Conversion
Subject: Unlock full Commander Mode  
Body: You’re close to your free limit. Upgrade to Pro for deeper daily execution.

### Pro → Elite Conversion
Subject: Ready for Elite depth?  
Body: Move to unlimited brief generation and advanced strategic output.

### Failed Payment
Subject: Payment update needed  
Body: We couldn’t process your subscription renewal. Update billing to keep your tier active.

## 6) FAQ

### How does billing work?
Monthly or yearly subscriptions through Stripe Checkout.

### Do you offer trials?
Free tier is always available; premium trial campaigns can be run as promotions.

### Can I upgrade or downgrade?
Yes. Tier state updates after Stripe webhook confirmation.

### Is payment secure?
Yes. Stripe-hosted checkout and server-side webhook verification are used.

### What happens when I hit usage limits?
You receive `limit reached` until the daily window resets or you upgrade.

## 7) Social Prompts

### X / Twitter
- "0700 Commander Brief is live. Execute with signal, not noise. #SaaS #BuildInPublic"
- "Free gives baseline clarity. Pro gives velocity. Elite gives depth."

### Instagram
- "Daily command clarity for operators. Archaios is live."
- "Mission. Revenue. Execution. Every morning."

### LinkedIn
- "We launched Revenue Fortress Phase 2: checkout + webhook + tier enforcement + daily command briefing."
- "Archaios now combines intelligence automation with monetization architecture in one operating surface."

### Twitch
- "Live build: scaling the Revenue Fortress stack (Worker + Stripe + KV)."
- "Come watch us tune daily brief automation and conversion flows."
