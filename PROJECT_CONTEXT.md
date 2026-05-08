# Project Context

This repo is a commercial architect-first operations platform.

It started as a duplicated PunchList PWA and is being evolved into a multi-tenant SaaS with modules:
- Punchlists and field observations
- Zoning research (worksheet-driven due diligence)
- Future: code research, exports, collaboration, billing

## Current stack
- Next.js App Router + TypeScript
- Clerk authentication + organizations
- Neon Postgres for SaaS persistence
- Vercel deployment

## Key routes
- Public marketing: `/`, `/pricing`
- Auth: `/login`, `/signup`
- App shell: `/app/*`
- Punchlist:
  - `/app` project list (legacy local-first)
  - `/app/project/[id]` project detail
  - `/app/project/[id]/area/[areaId]` inspection workflow
- Zoning:
  - `/app/zoning` zoning report list + create
  - `/app/zoning/[reportId]` zoning worksheet + manual review queue

## What is “done”
- SaaS shell with public pages and protected app routes
- Clerk auth + org sync into Neon
- Firm profile settings persisted in Neon
- Zoning module:
  - seeded from workbook-inspired structure
  - persisted in Neon (reports, sections, items, flags, references)
  - row-level editing and saving

## What is intentionally not done
- No Stripe/billing enforcement yet
- No project persistence in Neon yet (punchlist still local-first)
- No PLUTO / GeoSearch / NYC Planning API integrations yet
- No zoning rules engine
- No exports for zoning yet

## Next high-value phases
1. Move punchlist projects/areas/issues into Neon with org-scoped permissions.
2. Add lightweight property lookup integrations (seed zoning facts, keep sources).
3. Add report export generation (PDF) once persistence is stable.

