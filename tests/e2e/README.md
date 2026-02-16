# E2E Test Structure (Playwright Suggested)

## Suggested files
- `tests/e2e/auth.spec.ts`
- `tests/e2e/brief.spec.ts`
- `tests/e2e/pricing.spec.ts`
- `tests/e2e/subscription-status.spec.ts`

## Example commands
```bash
npm init -y
npm i -D @playwright/test
npx playwright install
npx playwright test
```

## Core scenarios
1. Login required gate appears before brief generation.
2. Generate brief populates overview/markets/weather cards.
3. Pricing page buttons hit checkout endpoint and handle graceful errors.
4. Success/cancel routes return to app with proper notices.
5. Premium tier status unlocks premium UI sections.
