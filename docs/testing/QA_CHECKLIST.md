# QA Checklist

## Core Functionality
- [ ] Login required before brief generation
- [ ] Free tier quota enforced
- [ ] Pro tier allows unlimited briefs
- [ ] Brief cards render all sections
- [ ] Weather and markets load with live data

## Subscription
- [ ] Upgrade flow starts from app UI
- [ ] Restore purchases works on native build
- [ ] Billing status badge updates

## Persistence
- [ ] Generated brief returns `id`
- [ ] `/briefs` lists prior briefs
- [ ] Selecting past brief reloads content

## PWA/Native
- [ ] Service worker updates and clears old caches
- [ ] iOS Home Screen install opens correct scope
- [ ] Android install opens and refreshes correctly

## Security
- [ ] Authorization header required when `REQUIRE_AUTH=true`
- [ ] No API secrets exposed client-side
