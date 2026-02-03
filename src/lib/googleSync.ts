import { Project } from '@/types';
import { getAllProjects, saveProjectPreserveTimestamps } from '@/lib/db';
import {
  ensurePunchListFolders,
  listProjectFiles,
  downloadProjectFile,
  saveProjectFile,
  reviveProject,
  getProjectIdFromFilename,
} from '@/lib/googleDrive';

function isRemoteNewer(remoteModifiedTime: string | undefined, localUpdatedAt: Date) {
  if (!remoteModifiedTime) return false;
  return new Date(remoteModifiedTime).getTime() > localUpdatedAt.getTime();
}

function isLocalNewer(remoteModifiedTime: string | undefined, localUpdatedAt: Date) {
  if (!remoteModifiedTime) return true;
  return localUpdatedAt.getTime() > new Date(remoteModifiedTime).getTime();
}

export type SyncConflict = { id: string; name: string };

export type SyncResult = {
  conflicts: SyncConflict[];
  syncedAt: string;
};

const LAST_SYNC_KEY = 'punchlist-drive-last-sync';

function getLastSyncTime() {
  const raw = localStorage.getItem(LAST_SYNC_KEY);
  return raw ? new Date(raw) : null;
}

function setLastSyncTime(date: Date) {
  localStorage.setItem(LAST_SYNC_KEY, date.toISOString());
}

export async function syncProjectsWithDrive(token: string): Promise<SyncResult> {
  const { projectsId } = await ensurePunchListFolders(token);
  const localProjects = await getAllProjects();
  const remoteFiles = await listProjectFiles(token, projectsId);

  const remoteById = new Map(remoteFiles.map((file) => [getProjectIdFromFilename(file.name), file]));
  const localById = new Map(localProjects.map((project) => [project.id, project]));
  const lastSync = getLastSyncTime();
  const conflicts: SyncConflict[] = [];

  // Pull newer or missing projects from Drive
  for (const [projectId, remoteFile] of remoteById.entries()) {
    const localProject = localById.get(projectId);
    const localChangedSinceSync =
      localProject && lastSync ? localProject.updatedAt.getTime() > lastSync.getTime() : false;
    const remoteChangedSinceSync =
      remoteFile.modifiedTime && lastSync
        ? new Date(remoteFile.modifiedTime).getTime() > lastSync.getTime()
        : false;

    if (localProject && localChangedSinceSync && remoteChangedSinceSync) {
      conflicts.push({ id: projectId, name: localProject.projectName });
      continue;
    }

    if (!localProject || isRemoteNewer(remoteFile.modifiedTime, localProject.updatedAt)) {
      const remoteProject = reviveProject(await downloadProjectFile(token, remoteFile.id));
      await saveProjectPreserveTimestamps(remoteProject);
    }
  }

  // Push local changes to Drive
  for (const project of localProjects) {
    const remoteFile = remoteById.get(project.id);
    const localChangedSinceSync =
      lastSync ? project.updatedAt.getTime() > lastSync.getTime() : true;
    const remoteChangedSinceSync =
      remoteFile?.modifiedTime && lastSync
        ? new Date(remoteFile.modifiedTime).getTime() > lastSync.getTime()
        : false;

    if (remoteFile && localChangedSinceSync && remoteChangedSinceSync) {
      if (!conflicts.find((conflict) => conflict.id === project.id)) {
        conflicts.push({ id: project.id, name: project.projectName });
      }
      continue;
    }
    if (!remoteFile || isLocalNewer(remoteFile.modifiedTime, project.updatedAt)) {
      await saveProjectFile(token, project, projectsId, remoteFile);
    }
  }

  const syncedAt = new Date();
  setLastSyncTime(syncedAt);
  return { conflicts, syncedAt: syncedAt.toISOString() };
}
