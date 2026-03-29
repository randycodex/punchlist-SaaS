import { PhotoAttachment, Project } from '@/types';
import {
  getAllProjects,
  getProject,
  saveProjectPreserveTimestamps,
  deleteProject as deleteProjectFromDb,
} from '@/lib/db';
import {
  ensurePunchListFolders,
  listProjectFiles,
  downloadProjectFile,
  uploadProjectFile,
  listPhotoProjectFolders,
  listProjectPhotoFiles,
  uploadProjectPhotoFile,
  deleteDriveItem,
  deleteProjectPhotoFolder,
  downloadDeletionLog,
  uploadDeletionLog,
} from '@/lib/oneDrive';

export type SyncConflict = { id: string; name: string };

export type SyncResult = {
  conflicts: SyncConflict[];
  syncedAt: string;
};

export type PushSyncResult = {
  conflicts: SyncConflict[];
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

function getProjectUpdatedAt(project: Pick<Project, 'updatedAt'> | null | undefined) {
  return timestampMs(project?.updatedAt);
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

function sanitizeNamePart(value: string | undefined, fallback: string) {
  const cleaned = (value ?? '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return cleaned || fallback;
}

function projectJsonFilename(project: Pick<Project, 'id' | 'projectName'>) {
  return `${sanitizeNamePart(project.projectName, 'project')}_${project.id}.json`;
}

function projectPhotoFolderName(project: Pick<Project, 'id' | 'projectName'>) {
  return `${sanitizeNamePart(project.projectName, 'project')}_${project.id}`;
}

function getProjectIdFromFilename(name: string) {
  const match = name.match(/([0-9a-f-]{36})\.json$/i);
  return match?.[1] ?? null;
}

function buildRemoteProjectFileIndex(remoteFiles: Array<{ id: string; name: string; eTag?: string; lastModifiedDateTime?: string }>) {
  const remoteById = new Map<string, typeof remoteFiles>();
  for (const file of remoteFiles) {
    if (!file.name.endsWith('.json')) continue;
    const projectId = getProjectIdFromFilename(file.name);
    if (!projectId) continue;
    const existing = remoteById.get(projectId);
    if (existing) {
      existing.push(file);
    } else {
      remoteById.set(projectId, [file]);
    }
  }
  return remoteById;
}

function pickPrimaryRemoteProjectFile(remoteFiles: Array<{ lastModifiedDateTime?: string }>) {
  return [...remoteFiles].sort(
    (left, right) => timestampMs(right.lastModifiedDateTime) - timestampMs(left.lastModifiedDateTime)
  )[0];
}

async function deleteStaleRemoteProjectFiles(
  token: string,
  project: Pick<Project, 'id' | 'projectName'>,
  remoteFiles: Array<{ id: string; name: string }>
) {
  const targetFilename = projectJsonFilename(project);
  await runWithConcurrency(
    remoteFiles.filter((file) => file.name !== targetFilename),
    2,
    async (file) => {
      await deleteDriveItem(token, file.id);
    }
  );
}

function getProjectAreaNames(project: Project) {
  return new Map(project.areas.map((area) => [area.id, area.name]));
}

function getCheckpointAreaIdByCheckpointId(project: Project) {
  const checkpointAreaIds = new Map<string, string>();
  for (const area of project.areas ?? []) {
    for (const location of area.locations ?? []) {
      for (const item of location.items ?? []) {
        for (const checkpoint of item.checkpoints ?? []) {
          checkpointAreaIds.set(checkpoint.id, area.id);
        }
      }
    }
  }
  return checkpointAreaIds;
}

function projectPhotoFilename(
  project: Project,
  photo: Pick<PhotoAttachment, 'id' | 'checkpointId'>,
  index: number
) {
  const areaNames = getProjectAreaNames(project);
  const checkpointAreaIds = getCheckpointAreaIdByCheckpointId(project);
  const areaId = checkpointAreaIds.get(photo.checkpointId);
  const areaName = areaId ? areaNames.get(areaId) : undefined;
  const projectName = sanitizeNamePart(project.projectName, 'project');
  const safeAreaName = sanitizeNamePart(areaName, 'area');
  const sequence = String(index + 1).padStart(3, '0');
  return `${projectName}_${safeAreaName}_${sequence}_${photo.id}.jpg`;
}

function getLegacyPhotoFolderNames(projectId: string) {
  return [projectId];
}

function getProjectFolderIdFromName(name: string) {
  const match = name.match(/_([0-9a-f-]{36})$/i);
  return match?.[1] ?? null;
}

function getProjectPhotos(project: Project) {
  const photos: PhotoAttachment[] = [];
  for (const area of project.areas ?? []) {
    for (const location of area.locations ?? []) {
      for (const item of location.items ?? []) {
        for (const checkpoint of item.checkpoints ?? []) {
          photos.push(...(checkpoint.photos ?? []));
        }
      }
    }
  }
  return photos;
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

async function syncProjectPhotosToOneDrive(token: string, project: Project): Promise<void> {
  const localPhotos = getProjectPhotos(project);
  const folderName = projectPhotoFolderName(project);
  const expectedNames = new Set(
    localPhotos.map((photo, index) => projectPhotoFilename(project, photo, index))
  );
  const remoteFolders = await listPhotoProjectFolders(token);
  const matchingFolder = remoteFolders.find((folder) => folder.name === folderName);
  const legacyFolders = remoteFolders.filter((folder) => {
    if (folder.name === folderName) return false;
    const folderProjectId = getProjectFolderIdFromName(folder.name);
    return folderProjectId === project.id || getLegacyPhotoFolderNames(project.id).includes(folder.name);
  });
  const remotePhotos = matchingFolder ? await listProjectPhotoFiles(token, matchingFolder.name) : [];
  const remoteNames = new Set(remotePhotos.map((photo) => photo.name));

  await runWithConcurrency(localPhotos.map((photo, index) => ({ photo, index })), 3, async ({ photo, index }) => {
    const filename = projectPhotoFilename(project, photo, index);
    if (remoteNames.has(filename) || !photo.imageData) {
      return;
    }
    const blob = await dataUrlToBlob(photo.imageData);
    await uploadProjectPhotoFile(token, folderName, filename, blob);
  });

  await runWithConcurrency(
    remotePhotos.filter((photo) => !expectedNames.has(photo.name) && photo.id),
    3,
    async (photo) => {
      await deleteDriveItem(token, photo.id);
    }
  );

  await runWithConcurrency(
    legacyFolders.filter((folder) => folder.id),
    2,
    async (folder) => {
      await deleteDriveItem(token, folder.id);
    }
  );
}

async function deleteProjectPhotosFromOneDrive(token: string, project: Pick<Project, 'id' | 'projectName'>) {
  const folderNames = [projectPhotoFolderName(project), ...getLegacyPhotoFolderNames(project.id)];
  await runWithConcurrency(folderNames, 2, async (folderName) => {
    await deleteProjectPhotoFolder(token, folderName);
  });
}

function isConflictError(error: unknown) {
  return error instanceof Error && error.message.includes('Precondition Failed');
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
    deletedAt: project.deletedAt ? new Date(project.deletedAt) : undefined,
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

async function downloadRemoteProject(token: string, remoteId: string): Promise<Project | null> {
  const raw = await downloadProjectFile(token, remoteId);
  try {
    return reviveProjectDates(JSON.parse(raw) as Project);
  } catch {
    return null;
  }
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

  const remoteFilesById = buildRemoteProjectFileIndex(remoteFiles);
  const localProjectMap = new Map(localProjects.map((project) => [project.id, project]));
  const remoteDeleteQueue: string[] = [];
  const remotePhotoDeleteQueue: string[] = [];
  const localDeleteQueue: string[] = [];

  // Apply deletions from the merged tombstone log.
  for (const [projectId, deletedAt] of Object.entries(mergedDeletions)) {
    const remoteEntries = remoteFilesById.get(projectId) ?? [];
    const remote = pickPrimaryRemoteProjectFile(remoteEntries);
    const local = localProjectMap.get(projectId);

    if (remote && isAfterOrEqual(deletedAt, remote.lastModifiedDateTime)) {
      remoteDeleteQueue.push(...remoteEntries.map((entry) => entry.id));
      remotePhotoDeleteQueue.push(projectId);
      remoteFilesById.delete(projectId);
    }

    if (local && new Date(deletedAt).getTime() >= local.updatedAt.getTime()) {
      localDeleteQueue.push(projectId);
      localProjectMap.delete(projectId);
    }
  }

  await Promise.all([
    runWithConcurrency(remoteDeleteQueue, 4, (remoteId) => deleteDriveItem(token, remoteId)),
    runWithConcurrency(remotePhotoDeleteQueue, 2, async (projectId) => {
      const project = localProjectMap.get(projectId) ?? { id: projectId, projectName: 'project' };
      await deleteProjectPhotosFromOneDrive(token, project);
    }),
    runWithConcurrency(localDeleteQueue, 4, (projectId) => deleteProjectFromDb(projectId)),
  ]);

  // Pull newer or missing projects from OneDrive
  const pullQueue = [...remoteFilesById.entries()];
  await runWithConcurrency(pullQueue, 4, async ([projectId, remoteEntries]) => {
    const remote = pickPrimaryRemoteProjectFile(remoteEntries);
    if (!remote.name.endsWith('.json') || !remote.id) return;
    const deletedAt = mergedDeletions[projectId];
    if (deletedAt && isAfterOrEqual(deletedAt, remote.lastModifiedDateTime)) {
      return;
    }
    const localProject = localProjectMap.get(projectId);
    const remoteProject = await downloadRemoteProject(token, remote.id);
    if (!remoteProject) {
      return;
    }
    const remoteUpdatedAt = getProjectUpdatedAt(remoteProject);

    if (!localProject) {
      await saveProjectPreserveTimestamps(remoteProject);
      localProjectMap.set(projectId, remoteProject);
      return;
    }

    const localUpdatedAt = getProjectUpdatedAt(localProject);
    if (remoteUpdatedAt > localUpdatedAt + CLOCK_SKEW_TOLERANCE_MS) {
      await saveProjectPreserveTimestamps(remoteProject);
      localProjectMap.set(projectId, remoteProject);
    }
  });

  // Push local changes to OneDrive
  const pushQueue = [...localProjectMap.values()];
  await runWithConcurrency(pushQueue, 3, async (project) => {
    const filename = projectJsonFilename(project);
    const remoteEntries = remoteFilesById.get(project.id) ?? [];
    const remote = pickPrimaryRemoteProjectFile(remoteEntries);
    const deletedAt = mergedDeletions[project.id];
    if (deletedAt && new Date(deletedAt).getTime() >= project.updatedAt.getTime()) {
      return;
    }

    const fullProject = await getProject(project.id);
    if (!fullProject) {
      return;
    }

    const localUpdatedAt = getProjectUpdatedAt(project);
    const remoteUpdatedAt = timestampMs(remote?.lastModifiedDateTime);
    if (localUpdatedAt <= remoteUpdatedAt + CLOCK_SKEW_TOLERANCE_MS) {
      await syncProjectPhotosToOneDrive(token, fullProject);
      return;
    }

    try {
      await uploadProjectFile(
        token,
        filename,
        JSON.stringify(fullProject),
        remote?.eTag
      );
      await deleteStaleRemoteProjectFiles(token, fullProject, remoteEntries);
      await syncProjectPhotosToOneDrive(token, fullProject);
    } catch (error) {
      if (isConflictError(error)) {
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

export async function pushProjectsToOneDrive(token: string, projectIds: string[]): Promise<PushSyncResult> {
  if (projectIds.length === 0) return { conflicts: [] };

  await ensurePunchListFolders(token);
  const deletionMap = getLocalDeletions();
  const uniqueProjectIds = [...new Set(projectIds)];
  const conflictsById = new Map<string, SyncConflict>();
  const remoteFilesById = buildRemoteProjectFileIndex(await listProjectFiles(token));

  await runWithConcurrency(uniqueProjectIds, 2, async (projectId) => {
    if (deletionMap[projectId]) return;

    const localProject = await getProject(projectId);
    if (!localProject) return;

    const filename = projectJsonFilename(localProject);
    const remoteEntries = remoteFilesById.get(projectId) ?? [];
    const remote = pickPrimaryRemoteProjectFile(remoteEntries);
    const remoteUpdatedAt = timestampMs(remote?.lastModifiedDateTime);
    const localUpdatedAt = getProjectUpdatedAt(localProject);

    if (localUpdatedAt <= remoteUpdatedAt + CLOCK_SKEW_TOLERANCE_MS) {
      return;
    }

    try {
      await uploadProjectFile(token, filename, JSON.stringify(localProject), remote?.eTag);
      await deleteStaleRemoteProjectFiles(token, localProject, remoteEntries);
      await syncProjectPhotosToOneDrive(token, localProject);
    } catch (error) {
      // Background push should not interrupt the editing flow; full sync can resolve conflicts.
      if (isConflictError(error)) {
        conflictsById.set(projectId, { id: projectId, name: localProject.projectName });
        return;
      }
      throw error;
    }
  });

  return { conflicts: [...conflictsById.values()] };
}
