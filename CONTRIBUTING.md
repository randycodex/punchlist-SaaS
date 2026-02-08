# Contributing

## Parallel Work Model

- Use `git worktree` for concurrent threads.
- Keep one concern per branch.
- Merge small PRs frequently.

## Branch Rules

- Required prefix: `codex/`
- Use lowercase kebab-case after prefix.
- Good: `codex/export-sheet-spacing`
- Bad: `feature/exportSpacing`

## PR Scope Rules

- One problem per PR.
- Avoid mixing sync, PDF, and UI in the same PR unless the change is inseparable.
- Include rollout/risk notes for behavior changes.

## Local Commands

- Start thread: `npm run thread:new -- <thread-name>`
- List worktrees: `npm run thread:list`
- Validate build: `npm run build -- --webpack`
