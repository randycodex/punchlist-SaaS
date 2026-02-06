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
const CONFLICT_CHANGE_TOLERANCE_MS = 30_000;

function getLastSyncTime() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? new Date(stored) : null;
}

function setLastSyncTime(date: Date) {
  localStorage.setItem(STORAGE_KEY, date.toISOString());
}

function changedAfterLastSync(timestamp: string | Date, lastSync: Date | null) {
  if (!lastSync) return true;
  const value = new Date(timestamp).getTime();
  return value > lastSync.getTime() + CONFLICT_CHANGE_TOLERANCE_MS;
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

  const lastSync = getLastSyncTime();
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
  await uploadDeletionLog(token, mergedDeletions);

  const remoteById = new Map(
    remoteFiles
      .filter((file) => file.name.endsWith('.json'))
      .map((file) => [file.name.replace(/\.json$/, ''), file])
  );
  const localProjectMap = new Map(localProjects.map((project) => [project.id, project]));

  // Apply deletions from the merged tombstone log.
  for (const [projectId, deletedAt] of Object.entries(mergedDeletions)) {
    const remote = remoteById.get(projectId);
    const local = localProjectMap.get(projectId);

    if (remote && isAfterOrEqual(deletedAt, remote.lastModifiedDateTime)) {
      await deleteDriveItem(token, remote.id);
      remoteById.delete(projectId);
    }

    if (local && new Date(deletedAt).getTime() >= local.updatedAt.getTime()) {
      await deleteProjectFromDb(projectId);
      localProjectMap.delete(projectId);
    }
  }

  // Pull newer or missing projects from OneDrive
  for (const [projectId, remote] of remoteById.entries()) {
    if (!remote.name.endsWith('.json') || !remote.id) continue;
    const deletedAt = mergedDeletions[projectId];
    if (deletedAt && isAfterOrEqual(deletedAt, remote.lastModifiedDateTime)) {
      continue;
    }
    const localProject = localProjectMap.get(projectId);
    const remoteChangedSinceSync =
      remote.lastModifiedDateTime ? changedAfterLastSync(remote.lastModifiedDateTime, lastSync) : !lastSync;

    if (!localProject || remoteChangedSinceSync) {
      const raw = await downloadProjectFile(token, remote.id);
      try {
        const parsed = reviveProjectDates(JSON.parse(raw) as Project);
        await saveProjectPreserveTimestamps(parsed);
        localProjectMap.set(projectId, parsed);
      } catch {
        // Ignore malformed files
      }
    }

    if (localProject && remoteChangedSinceSync && lastSync) {
      const localChangedSinceSync = changedAfterLastSync(localProject.updatedAt, lastSync);
      if (localChangedSinceSync) {
        addConflict(localProject.id, localProject.projectName);
      }
    }
  }

  // Push local changes to OneDrive
  for (const project of localProjectMap.values()) {
    const filename = projectFilename(project.id);
    const remote = remoteById.get(project.id);
    const deletedAt = mergedDeletions[project.id];
    if (deletedAt && new Date(deletedAt).getTime() >= project.updatedAt.getTime()) {
      continue;
    }
    const localChangedSinceSync =
      changedAfterLastSync(project.updatedAt, lastSync);
    const remoteChangedSinceSync =
      remote?.lastModifiedDateTime ? changedAfterLastSync(remote.lastModifiedDateTime, lastSync) : false;

    if (remote && localChangedSinceSync && remoteChangedSinceSync) {
      addConflict(project.id, project.projectName);
      continue;
    }

    // Do not resurrect remotely deleted projects unless this project changed locally after last sync.
    if ((remote && localChangedSinceSync) || (!remote && (lastSync ? localChangedSinceSync : true))) {
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
    }
  }

  const syncedAt = new Date();
  setLastSyncTime(syncedAt);

  return { conflicts: [...conflictsById.values()], syncedAt: syncedAt.toISOString() };
}
