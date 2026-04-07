type PendingSyncState = {
  projectIds: string[];
  fullSyncNeeded: boolean;
};

const PENDING_SYNC_STORAGE_KEY = 'punchlist-pending-sync';

function getDefaultPendingSyncState(): PendingSyncState {
  return {
    projectIds: [],
    fullSyncNeeded: false,
  };
}

function normalizePendingSyncState(raw: unknown): PendingSyncState {
  if (!raw || typeof raw !== 'object') {
    return getDefaultPendingSyncState();
  }

  const projectIds = Array.isArray((raw as { projectIds?: unknown }).projectIds)
    ? [...new Set((raw as { projectIds: unknown[] }).projectIds.filter((value): value is string => typeof value === 'string' && value.length > 0))]
    : [];
  const fullSyncNeeded = Boolean((raw as { fullSyncNeeded?: unknown }).fullSyncNeeded);

  return {
    projectIds,
    fullSyncNeeded,
  };
}

function persistPendingSyncState(state: PendingSyncState) {
  if (typeof window === 'undefined') return;

  if (state.projectIds.length === 0 && !state.fullSyncNeeded) {
    localStorage.removeItem(PENDING_SYNC_STORAGE_KEY);
    return;
  }

  localStorage.setItem(PENDING_SYNC_STORAGE_KEY, JSON.stringify(state));
}

export function loadPendingSyncState(): PendingSyncState {
  if (typeof window === 'undefined') {
    return getDefaultPendingSyncState();
  }

  try {
    const raw = localStorage.getItem(PENDING_SYNC_STORAGE_KEY);
    if (!raw) {
      return getDefaultPendingSyncState();
    }
    return normalizePendingSyncState(JSON.parse(raw));
  } catch {
    return getDefaultPendingSyncState();
  }
}

export function hasPendingSyncState() {
  const state = loadPendingSyncState();
  return state.projectIds.length > 0 || state.fullSyncNeeded;
}

export function queuePendingSync(projectId?: string, options?: { fullSync?: boolean }) {
  const state = loadPendingSyncState();
  const projectIds = new Set(state.projectIds);
  if (projectId) {
    projectIds.add(projectId);
  }

  persistPendingSyncState({
    projectIds: [...projectIds],
    fullSyncNeeded: state.fullSyncNeeded || Boolean(options?.fullSync),
  });
}

export function clearPendingSyncState() {
  persistPendingSyncState(getDefaultPendingSyncState());
}

export function clearPendingProjectSync(projectIds: string[]) {
  if (projectIds.length === 0) return;
  const state = loadPendingSyncState();
  const completedIds = new Set(projectIds);
  persistPendingSyncState({
    projectIds: state.projectIds.filter((projectId) => !completedIds.has(projectId)),
    fullSyncNeeded: state.fullSyncNeeded,
  });
}

export function clearPendingFullSyncFlag() {
  const state = loadPendingSyncState();
  persistPendingSyncState({
    projectIds: state.projectIds,
    fullSyncNeeded: false,
  });
}
