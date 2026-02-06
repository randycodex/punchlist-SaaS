import { Project } from '@/types';
import { getAllProjects, saveProject } from '@/lib/db';
import {
  ensurePunchListFolders,
  listProjectFiles,
  downloadProjectFile,
  uploadProjectFile,
} from '@/lib/oneDrive';

export type SyncConflict = { id: string; name: string };

export type SyncResult = {
  conflicts: SyncConflict[];
  syncedAt: string;
};

const STORAGE_KEY = 'punchlist-onedrive-last-sync';

function getLastSyncTime() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? new Date(stored) : null;
}

function setLastSyncTime(date: Date) {
  localStorage.setItem(STORAGE_KEY, date.toISOString());
}

function projectFilename(projectId: string) {
  return `${projectId}.json`;
}

export async function syncProjectsWithOneDrive(token: string): Promise<SyncResult> {
  await ensurePunchListFolders(token);

  const lastSync = getLastSyncTime();
  const conflicts: SyncConflict[] = [];
  const remoteFiles = await listProjectFiles(token);
  const localProjects = await getAllProjects();
  const localProjectMap = new Map(localProjects.map((project) => [project.id, project]));

  // Pull newer or missing projects from OneDrive
  for (const remote of remoteFiles) {
    if (!remote.name.endsWith('.json') || !remote.id) continue;
    const projectId = remote.name.replace(/\.json$/, '');
    const localProject = localProjectMap.get(projectId);
    const remoteChangedSinceSync =
      remote.lastModifiedDateTime && lastSync
        ? new Date(remote.lastModifiedDateTime).getTime() > lastSync.getTime()
        : !lastSync;

    if (!localProject || remoteChangedSinceSync) {
      const raw = await downloadProjectFile(token, remote.id);
      try {
        const parsed = JSON.parse(raw) as Project;
        await saveProject(parsed);
      } catch {
        // Ignore malformed files
      }
    }

    if (localProject && remoteChangedSinceSync && lastSync) {
      const localChangedSinceSync = localProject.updatedAt.getTime() > lastSync.getTime();
      if (localChangedSinceSync) {
        conflicts.push({ id: localProject.id, name: localProject.projectName });
      }
    }
  }

  // Push local changes to OneDrive
  for (const project of localProjects) {
    const filename = projectFilename(project.id);
    const remote = remoteFiles.find((file) => file.name === filename);
    const localChangedSinceSync =
      lastSync ? project.updatedAt.getTime() > lastSync.getTime() : true;
    const remoteChangedSinceSync =
      remote?.lastModifiedDateTime && lastSync
        ? new Date(remote.lastModifiedDateTime).getTime() > lastSync.getTime()
        : false;

    if (remote && localChangedSinceSync && remoteChangedSinceSync) {
      conflicts.push({ id: project.id, name: project.projectName });
      continue;
    }

    if (!remote || localChangedSinceSync) {
      try {
        await uploadProjectFile(
          token,
          filename,
          JSON.stringify(project),
          remote?.eTag
        );
      } catch (error) {
        if (error instanceof Error && error.message.includes('Precondition Failed')) {
          conflicts.push({ id: project.id, name: project.projectName });
        } else {
          throw error;
        }
      }
    }
  }

  const syncedAt = new Date();
  setLastSyncTime(syncedAt);

  return { conflicts, syncedAt: syncedAt.toISOString() };
}
