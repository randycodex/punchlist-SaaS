# Active Threads

Use one branch + one worktree per workstream.

## Naming Rules

- Branches must start with `codex/`
- Branch format: `codex/<scope>-<topic>`
- Examples:
  - `codex/pdf-layout`
  - `codex/sync-conflicts`
  - `codex/ui-header`

## Quick Start

1. Create a thread worktree:
   - `npm run thread:new -- <thread-name>`
2. Work only inside that worktree.
3. Open a PR scoped to one concern.
4. Keep this file updated.

## Thread Board

| Thread | Branch | Worktree Path | Scope | Status | Owner | Notes |
|---|---|---|---|---|---|---|
| Main integration | `main` | `.` | Stable baseline + merges | Active | You | Do release checks here |
| PDF layout | `codex/pdf-layout` | `.worktrees/pdf-layout` | PDF headers, spacing, summaries | Planned | You | |
| Sync behavior | `codex/sync-behavior` | `.worktrees/sync-behavior` | pull-to-sync, conflict handling | Planned | You | |
| UI polish | `codex/ui-polish` | `.worktrees/ui-polish` | header, card spacing, interaction polish | Planned | You | |
