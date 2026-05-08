# Punchlist SaaS (Codex / AI Working Notes)

This repository is a commercial architecture operations SaaS built on Next.js App Router.

## Non-negotiables
- Do not break existing Punchlist functionality under `/app/project/[id]` and related routes.
- Do not break Clerk auth, organization selection, or onboarding flows.
- Do not remove PWA behavior unless explicitly requested.
- Do not treat zoning as a deterministic rules engine.

## Product shape
- Public site: `/`, `/pricing`
- Auth: `/login`, `/signup` (Clerk)
- Private app: `/app/*`
- Punchlist module (legacy PWA workflow): `/app` (project list) and `/app/project/[id]`
- Zoning module (separate workspace): `/app/zoning` and `/app/zoning/[reportId]`

## Zoning philosophy
- Zoning is a workflow + reporting module.
- Every row is tagged as one of: `auto_filled`, `calculated`, `guidance`, `manual_review_required`.
- “Manual review required” items must remain explicit and cannot be auto-resolved by code.
- The Excel workbook in `docs/reference/zoning/` is the primary UX/workflow reference.

## Data sources and persistence (current)
- Punchlist project data: IndexedDB (see `src/lib/db.ts`) plus OneDrive legacy sync.
- SaaS org/account layer: Clerk + Neon (see `src/lib/server/saas-sync.ts`).
- Zoning reports: Neon tables created in `src/lib/server/saas-schema.ts` and accessed via `src/lib/server/zoning-reports.ts`.

## Dev commands
- Dev: `npm run dev`
- Build: `npm run build`

## Where to put things
- Zoning client components: `src/components/zoning/*`
- Zoning types: `src/lib/zoning/*`
- Zoning server persistence: `src/lib/server/zoning-reports.ts`
- API routes: `src/app/api/v1/*`

## Style and safety
- Prefer minimal, scoped changes.
- Preserve existing routes; add new routes/modules rather than refactoring punchlist internals.
- When adding schema, include a safe `ALTER TABLE` for existing DBs and guard with `.catch(() => undefined)` if needed.

