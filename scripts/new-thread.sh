#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: ./scripts/new-thread.sh <thread-name> [base-ref] [worktree-root]"
  echo "Example: ./scripts/new-thread.sh pdf-layout main .worktrees"
  exit 1
fi

THREAD_NAME="$1"
BASE_REF="${2:-main}"
WORKTREE_ROOT="${3:-.worktrees}"

slugify() {
  echo "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g' \
    | sed -E 's/^-+|-+$//g'
}

SLUG="$(slugify "$THREAD_NAME")"
if [[ -z "$SLUG" ]]; then
  echo "Error: thread name resolves to an empty slug."
  exit 1
fi

BRANCH="codex/${SLUG}"
ROOT_DIR="$(pwd)"
TARGET_DIR="${WORKTREE_ROOT}/${SLUG}"

mkdir -p "$WORKTREE_ROOT"

if [[ -e "$TARGET_DIR" ]]; then
  echo "Error: target worktree path already exists: $TARGET_DIR"
  exit 1
fi

if git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
  git worktree add "$TARGET_DIR" "$BRANCH"
else
  git worktree add -b "$BRANCH" "$TARGET_DIR" "$BASE_REF"
fi

cat <<MSG
Created thread worktree:
- Branch: $BRANCH
- Path:   $TARGET_DIR

Next:
1. cd "$ROOT_DIR/$TARGET_DIR"
2. npm run dev
3. Update THREADS.md with this thread
MSG
