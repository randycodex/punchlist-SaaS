# Decisions Log

## Platform
- Framework: Next.js App Router (keep; no migration planned).
- Hosting: Vercel.
- Auth: Clerk.
- Database: Neon Postgres.

## Tenancy
- Users can belong to multiple organizations.
- App supports running without an active org selected; server code may fall back to the first membership when needed.

## Modules
- Punchlist and Zoning are separate modules inside `/app`.
- Shared information between Punchlist and Zoning should be limited (at most project address seed).

## Zoning philosophy
- Zoning is workflow-oriented and report-oriented, not an automated rules engine.
- Must clearly distinguish:
  - auto-filled data
  - calculated values
  - guidance/interpretation
  - manual review required

## References
- `docs/reference/zoning/1760 Jerome Ave Zoning 241101.xlsx` is the primary UX/workflow reference for the zoning module.

