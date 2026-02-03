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

export async function syncProjectsWithDrive(token: string) {
  const { projectsId } = await ensurePunchListFolders(token);
  const localProjects = await getAllProjects();
  const remoteFiles = await listProjectFiles(token, projectsId);

  const remoteById = new Map(remoteFiles.map((file) => [getProjectIdFromFilename(file.name), file]));
  const localById = new Map(localProjects.map((project) => [project.id, project]));

  // Pull newer or missing projects from Drive
  for (const [projectId, remoteFile] of remoteById.entries()) {
    const localProject = localById.get(projectId);
    if (!localProject || isRemoteNewer(remoteFile.modifiedTime, localProject.updatedAt)) {
      const remoteProject = reviveProject(await downloadProjectFile(token, remoteFile.id));
      await saveProjectPreserveTimestamps(remoteProject);
    }
  }

  // Push local changes to Drive
  for (const project of localProjects) {
    const remoteFile = remoteById.get(project.id);
    if (!remoteFile || isLocalNewer(remoteFile.modifiedTime, project.updatedAt)) {
      await saveProjectFile(token, project, projectsId, remoteFile);
    }
  }
}
