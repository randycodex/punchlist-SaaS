import { Project } from '@/types';
import {
  getAllProjects,
  saveProjectPreserveTimestamps,
  deleteProject as deleteProjectFromDb,
} from '@/lib/db';
import {
  ensurePunchListFolders,
  listProjectFiles,
  downloadProjectFile,
  uploadProjectFile,
  deleteDriveItem,
  downloadDeletionLog,
  uploadDeletionLog,
} from '@/lib/oneDrive';

export type SyncConflict = { id: string; name: string };

export type SyncResult = {
  conflicts: SyncConflict[];
  syncedAt: string;
};

const STORAGE_KEY = 'punchlist-onedrive-last-sync';
const DELETIONS_KEY = 'punchlist-onedrive-deletions';
// Allow a small clock-skew window between devices/Graph timestamps,
// but do not suppress normal recent edits.
const CLOCK_SKEW_TOLERANCE_MS = 2_000;

function setLastSyncTime(date: Date) {
  localStorage.setItem(STORAGE_KEY, date.toISOString());
}

function timestampMs(value: string | Date | undefined) {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
) {
  if (items.length === 0) return;
  const size = Math.max(1, Math.min(limit, items.length));
  let index = 0;

  const runners = Array.from({ length: size }, async () => {
    while (true) {
      const current = index++;
      if (current >= items.length) return;
      await worker(items[current]);
    }
  });

  await Promise.all(runners);
}

function projectFilename(projectId: string) {
  return `${projectId}.json`;
}

function getLocalDeletions(): Record<string, string> {
  try {
    const raw = localStorage.getItem(DELETIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed ?? {};
  } catch {
    return {};
  }
}

function setLocalDeletions(deletions: Record<string, string>) {
  localStorage.setItem(DELETIONS_KEY, JSON.stringify(deletions));
}

function isAfterOrEqual(left: string, right: string | undefined) {
  if (!right) return true;
  return new Date(left).getTime() >= new Date(right).getTime();
}

function mergeDeletions(
  localDeletions: Record<string, string>,
  remoteDeletions: Record<string, string>
) {
  const merged: Record<string, string> = { ...remoteDeletions };
  for (const [id, localTs] of Object.entries(localDeletions)) {
    const remoteTs = remoteDeletions[id];
    if (!remoteTs || new Date(localTs).getTime() > new Date(remoteTs).getTime()) {
      merged[id] = localTs;
    }
  }
  for (const [id, remoteTs] of Object.entries(remoteDeletions)) {
    const localTs = localDeletions[id];
    if (!localTs || new Date(remoteTs).getTime() > new Date(localTs).getTime()) {
      merged[id] = remoteTs;
    }
  }
  return merged;
}

function deletionMapsEqual(left: Record<string, string>, right: Record<string, string>) {
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);
  if (leftEntries.length !== rightEntries.length) return false;
  for (const [id, value] of leftEntries) {
    if (right[id] !== value) return false;
  }
  return true;
}

export function markProjectDeleted(projectId: string, deletedAt = new Date()) {
  const deletions = getLocalDeletions();
  deletions[projectId] = deletedAt.toISOString();
  setLocalDeletions(deletions);
}

function reviveProjectDates(project: Project): Project {
  return {
    ...project,
    date: new Date(project.date),
    createdAt: new Date(project.createdAt),
    updatedAt: new Date(project.updatedAt),
    areas: (project.areas ?? []).map((area) => ({
      ...area,
      createdAt: new Date(area.createdAt),
      updatedAt: new Date(area.updatedAt),
      locations: (area.locations ?? []).map((location) => ({
        ...location,
        createdAt: new Date(location.createdAt),
        updatedAt: new Date(location.updatedAt),
        items: (location.items ?? []).map((item) => ({
          ...item,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
          checkpoints: (item.checkpoints ?? []).map((checkpoint) => ({
            ...checkpoint,
            createdAt: new Date(checkpoint.createdAt),
            updatedAt: new Date(checkpoint.updatedAt),
            photos: (checkpoint.photos ?? []).map((photo) => ({
              ...photo,
              createdAt: new Date(photo.createdAt),
            })),
            files: (checkpoint.files ?? []).map((file) => ({
              ...file,
              createdAt: new Date(file.createdAt),
            })),
          })),
        })),
      })),
    })),
  };
}

export async function syncProjectsWithOneDrive(token: string): Promise<SyncResult> {
  await ensurePunchListFolders(token);

  const conflictsById = new Map<string, SyncConflict>();
  const addConflict = (id: string, name: string) => {
    if (!conflictsById.has(id)) {
      conflictsById.set(id, { id, name });
    }
  };
  const [remoteFiles, localProjects, remoteDeletions] = await Promise.all([
    listProjectFiles(token),
    getAllProjects(),
    downloadDeletionLog(token),
  ]);
  const localDeletions = getLocalDeletions();
  const mergedDeletions = mergeDeletions(localDeletions, remoteDeletions);
  setLocalDeletions(mergedDeletions);
  if (!deletionMapsEqual(mergedDeletions, remoteDeletions)) {
    await uploadDeletionLog(token, mergedDeletions);
  }

  const remoteById = new Map(
    remoteFiles
      .filter((file) => file.name.endsWith('.json'))
      .map((file) => [file.name.replace(/\.json$/, ''), file])
  );
  const localProjectMap = new Map(localProjects.map((project) => [project.id, project]));
  const remoteDeleteQueue: string[] = [];
  const localDeleteQueue: string[] = [];

  // Apply deletions from the merged tombstone log.
  for (const [projectId, deletedAt] of Object.entries(mergedDeletions)) {
    const remote = remoteById.get(projectId);
    const local = localProjectMap.get(projectId);

    if (remote && isAfterOrEqual(deletedAt, remote.lastModifiedDateTime)) {
      remoteDeleteQueue.push(remote.id);
      remoteById.delete(projectId);
    }

    if (local && new Date(deletedAt).getTime() >= local.updatedAt.getTime()) {
      localDeleteQueue.push(projectId);
      localProjectMap.delete(projectId);
    }
  }

  await Promise.all([
    runWithConcurrency(remoteDeleteQueue, 4, (remoteId) => deleteDriveItem(token, remoteId)),
    runWithConcurrency(localDeleteQueue, 4, (projectId) => deleteProjectFromDb(projectId)),
  ]);

  // Pull newer or missing projects from OneDrive
  const pullQueue = [...remoteById.entries()];
  await runWithConcurrency(pullQueue, 4, async ([projectId, remote]) => {
    if (!remote.name.endsWith('.json') || !remote.id) return;
    const deletedAt = mergedDeletions[projectId];
    if (deletedAt && isAfterOrEqual(deletedAt, remote.lastModifiedDateTime)) {
      return;
    }
    const localProject = localProjectMap.get(projectId);
    const remoteUpdatedAt = timestampMs(remote.lastModifiedDateTime);

    if (!localProject) {
      const raw = await downloadProjectFile(token, remote.id);
      try {
        const parsed = reviveProjectDates(JSON.parse(raw) as Project);
        await saveProjectPreserveTimestamps(parsed);
        localProjectMap.set(projectId, parsed);
      } catch {
        // Ignore malformed files
      }
      return;
    }

    const localUpdatedAt = localProject.updatedAt.getTime();
    if (remoteUpdatedAt > localUpdatedAt + CLOCK_SKEW_TOLERANCE_MS) {
      const raw = await downloadProjectFile(token, remote.id);
      try {
        const parsed = reviveProjectDates(JSON.parse(raw) as Project);
        await saveProjectPreserveTimestamps(parsed);
        localProjectMap.set(projectId, parsed);
      } catch {
        // Ignore malformed files
      }
    }
  });

  // Push local changes to OneDrive
  const pushQueue = [...localProjectMap.values()];
  await runWithConcurrency(pushQueue, 3, async (project) => {
    const filename = projectFilename(project.id);
    const remote = remoteById.get(project.id);
    const deletedAt = mergedDeletions[project.id];
    if (deletedAt && new Date(deletedAt).getTime() >= project.updatedAt.getTime()) {
      return;
    }

    if (remote) {
      const localUpdatedAt = project.updatedAt.getTime();
      const remoteUpdatedAt = timestampMs(remote.lastModifiedDateTime);
      if (localUpdatedAt <= remoteUpdatedAt + CLOCK_SKEW_TOLERANCE_MS) {
        return;
      }
    }

    try {
      await uploadProjectFile(
        token,
        filename,
        JSON.stringify(project),
        remote?.eTag
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes('Precondition Failed')) {
        addConflict(project.id, project.projectName);
      } else {
        throw error;
      }
    }
  });

  const syncedAt = new Date();
  setLastSyncTime(syncedAt);

  return { conflicts: [...conflictsById.values()], syncedAt: syncedAt.toISOString() };
}
