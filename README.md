# Punchlist SaaS

Multi-tenant inspection and punchlist product. The current app remains a PWA, but the target architecture is an open SaaS product with native iOS and Android distribution later.

## Product Direction

- Open signup with multiple login providers: email, Google, Microsoft, and Apple.
- Team workspaces own projects, templates, memberships, branding, subscriptions, and storage.
- Backend is the system of record for users, organizations, memberships, roles, projects, templates, media, and exports.
- Offline-first remains mandatory. Field edits are saved locally first and queued for API sync when connectivity returns.
- Management roles can see every project in their organization. Project-level roles control editor/viewer access for non-management users.
- Monthly subscription billing is organization-scoped.
- Firm logos are uploaded to object storage and reused in the app shell and PDF exports.
- The built-in inspection list stays available as the default system template; firms can create or upload organization templates.
- OneDrive can be offered later as an optional export/integration target, but it is not the primary team sync or storage layer.

## Architecture Baseline

The SaaS backend should provide:

- Postgres for relational records: users, organizations, memberships, roles, projects, templates, subscription state, and asset metadata.
- API routes for sync snapshots, project upserts, template management, permission management, logo/media upload intent, and billing portal/checkout.
- Object storage for logos, photos, files, and generated PDFs.
- A conflict-aware sync protocol using server versions or revision tokens.

Client-side baseline now in this repo:

- `src/lib/saas/types.ts` defines the SaaS domain model.
- `src/lib/saas/api.ts` defines the first API contract for snapshots, project/template upserts, deletes, and offline mutation flushes.
- `src/lib/db.ts` keeps the existing IndexedDB project/media storage and adds an `offlineMutations` outbox for no-data-loss field work.

## Local Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Environment baseline:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
NEXT_PUBLIC_MS_CLIENT_ID=376ef496-5fa7-447d-9559-2e128a6b74a4
NEXT_PUBLIC_MS_TENANT_ID=organizations
NEXT_PUBLIC_MS_REDIRECT_URI=http://localhost:3000/
```

Microsoft auth is currently still used by the legacy OneDrive sync path. The SaaS auth layer should replace that with backend-issued sessions and make Microsoft just one provider among several.

## Important Repo Boundary

Work in this repository only:

```text
/Users/randy/Documents/X_CODING/punchlist-SaaS
```

Do not modify the old repo:

```text
/Users/randy/Documents/X_CODING/punchlist-pwa
```
