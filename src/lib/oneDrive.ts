const GRAPH_API = 'https://graph.microsoft.com/v1.0';
const PUNCHLIST_ROOT = 'PunchList';
const SHARED_EXPORTS_PATH = `${PUNCHLIST_ROOT}/exports`;
const LEGACY_PROJECTS_PATH = `${PUNCHLIST_ROOT}/projects`;
const LEGACY_PHOTOS_PATH = `${PUNCHLIST_ROOT}/photos`;
const RESERVED_PUNCHLIST_FOLDER_NAMES = new Set(['exports', 'projects', 'photos']);
let hasEnsuredPunchListFolders = false;

export type DriveItem = {
  id: string;
  name: string;
  eTag?: string;
  lastModifiedDateTime?: string;
  folder?: { childCount: number };
};

async function graphFetch<T>(token: string, path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${GRAPH_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = '';
    try {
      const data = await response.json();
      message = data?.error?.message ?? '';
    } catch {
      message = '';
    }
    throw new Error(message || `Graph request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return {} as T;
  }
  return response.json() as Promise<T>;
}

async function getItemByPath(token: string, path: string): Promise<DriveItem | null> {
  try {
    return await graphFetch<DriveItem>(
      token,
      `/me/drive/root:/${encodeURI(path)}?$select=id,name,eTag,lastModifiedDateTime,folder`
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (
        error.message.includes('itemNotFound') ||
        error.message.includes('404') ||
        error.message.includes('The resource could not be found') ||
        error.message.includes('resource could not be found')
      )
    ) {
      return null;
    }
    throw error;
  }
}

async function createFolder(
  token: string,
  name: string,
  parentId?: string
): Promise<DriveItem> {
  const endpoint = parentId ? `/me/drive/items/${parentId}/children` : '/me/drive/root/children';

  return graphFetch<DriveItem>(token, endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'fail',
    }),
  });
}

async function ensureFolder(token: string, path: string): Promise<DriveItem> {
  const existing = await getItemByPath(token, path);
  if (existing?.folder) return existing;
  if (existing) {
    throw new Error(`Expected folder at ${path}, but found a file instead.`);
  }

  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) {
    throw new Error('Folder path cannot be empty.');
  }

  const folderName = segments[segments.length - 1];
  const parentPath = segments.slice(0, -1).join('/');
  const parentFolder = parentPath ? await ensureFolder(token, parentPath) : null;

  try {
    return await createFolder(token, folderName, parentFolder?.id);
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('already exists')) {
      const created = await getItemByPath(token, path);
      if (created?.folder) return created;
    }
    throw error;
  }
}

function getProjectRootPath(projectFolderName: string) {
  return `${PUNCHLIST_ROOT}/${projectFolderName}`;
}

function getProjectFilePath(projectFolderName: string, filename: string) {
  return `${getProjectRootPath(projectFolderName)}/${filename}`;
}

function getProjectPhotosPath(projectFolderName: string) {
  return `${getProjectRootPath(projectFolderName)}/photos`;
}

function getProjectExportsPath(projectFolderName: string) {
  return `${getProjectRootPath(projectFolderName)}/exports`;
}

async function listProjectRootFolders(token: string): Promise<DriveItem[]> {
  const children = await listFolderChildrenByPath(token, PUNCHLIST_ROOT);
  return children.filter(
    (item) => item.folder && !RESERVED_PUNCHLIST_FOLDER_NAMES.has(item.name)
  );
}

function dedupeDriveItems(items: DriveItem[]) {
  const seenIds = new Set<string>();
  const deduped: DriveItem[] = [];
  for (const item of items) {
    if (item.id && seenIds.has(item.id)) continue;
    if (item.id) {
      seenIds.add(item.id);
    }
    deduped.push(item);
  }
  return deduped;
}

export async function ensurePunchListFolders(token: string) {
  if (hasEnsuredPunchListFolders) {
    return;
  }
  await ensureFolder(token, PUNCHLIST_ROOT);
  await ensureFolder(token, SHARED_EXPORTS_PATH);
  hasEnsuredPunchListFolders = true;
}

async function listFolderChildrenByPath(token: string, path: string): Promise<DriveItem[]> {
  try {
    const result = await graphFetch<{ value: DriveItem[] }>(
      token,
      `/me/drive/root:/${encodeURI(path)}:/children?$select=id,name,lastModifiedDateTime,eTag,folder`
    );
    return result.value ?? [];
  } catch (error) {
    if (
      error instanceof Error &&
      (
        error.message.includes('itemNotFound') ||
        error.message.includes('404') ||
        error.message.includes('The resource could not be found') ||
        error.message.includes('resource could not be found')
      )
    ) {
      return [];
    }
    throw error;
  }
}

export async function listProjectFiles(token: string) {
  await ensurePunchListFolders(token);
  const [legacyFiles, projectFolders] = await Promise.all([
    listFolderChildrenByPath(token, LEGACY_PROJECTS_PATH),
    listProjectRootFolders(token),
  ]);
  const nestedFiles = await Promise.all(
    projectFolders.map((folder) => listFolderChildrenByPath(token, getProjectRootPath(folder.name)))
  );
  return [...legacyFiles, ...nestedFiles.flat()].filter((item) => item.name.endsWith('.json'));
}

export async function getProjectFileMetadata(token: string, filename: string): Promise<DriveItem | null> {
  await ensurePunchListFolders(token);
  const projectFolders = await listProjectRootFolders(token);
  for (const folder of projectFolders) {
    const match = await getItemByPath(token, getProjectFilePath(folder.name, filename));
    if (match) return match;
  }
  return getItemByPath(token, `${LEGACY_PROJECTS_PATH}/${filename}`);
}

export async function downloadProjectFile(token: string, id: string): Promise<string> {
  const response = await fetch(`${GRAPH_API}/me/drive/items/${id}/content`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Drive download failed: ${response.status}`);
  }
  return response.text();
}

export async function downloadDriveItemAsDataUrl(token: string, id: string): Promise<string> {
  const response = await fetch(`${GRAPH_API}/me/drive/items/${id}/content`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Drive download failed: ${response.status}`);
  }

  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Drive download produced a non-string result.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Drive download failed.'));
    reader.readAsDataURL(blob);
  });
}

export async function uploadProjectFile(
  token: string,
  projectFolderName: string,
  filename: string,
  content: string,
  etag?: string
) {
  await ensurePunchListFolders(token);
  await ensureFolder(token, getProjectRootPath(projectFolderName));
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (etag) {
    headers['If-Match'] = etag;
  }
  return graphFetch<DriveItem>(token, `/me/drive/root:/${encodeURI(getProjectFilePath(projectFolderName, filename))}:/content`, {
    method: 'PUT',
    headers,
    body: content,
  });
}

export async function listProjectPhotoFiles(token: string, projectFolderName: string): Promise<DriveItem[]> {
  await ensurePunchListFolders(token);
  const [projectFolderPhotos, legacyPhotos] = await Promise.all([
    listFolderChildrenByPath(token, getProjectPhotosPath(projectFolderName)),
    listFolderChildrenByPath(token, `${LEGACY_PHOTOS_PATH}/${projectFolderName}`),
  ]);
  return dedupeDriveItems([...projectFolderPhotos, ...legacyPhotos]);
}

export async function listPhotoProjectFolders(token: string): Promise<DriveItem[]> {
  await ensurePunchListFolders(token);
  const [projectFolders, legacyPhotoFolders] = await Promise.all([
    listProjectRootFolders(token),
    listFolderChildrenByPath(token, LEGACY_PHOTOS_PATH),
  ]);
  const byName = new Map<string, DriveItem>();
  for (const folder of projectFolders) {
    byName.set(folder.name, folder);
  }
  for (const folder of legacyPhotoFolders.filter((item) => item.folder)) {
    if (!byName.has(folder.name)) {
      byName.set(folder.name, folder);
    }
  }
  return [...byName.values()];
}

export async function uploadProjectPhotoFile(
  token: string,
  projectFolderName: string,
  filename: string,
  blob: Blob
) {
  await ensurePunchListFolders(token);
  await ensureFolder(token, getProjectRootPath(projectFolderName));
  await ensureFolder(token, getProjectPhotosPath(projectFolderName));
  return graphFetch<DriveItem>(
    token,
    `/me/drive/root:/${encodeURI(getProjectPhotosPath(projectFolderName))}/${encodeURI(filename)}:/content`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': blob.type || 'image/jpeg',
      },
      body: blob,
    }
  );
}

export async function deleteProjectPhotoFolder(token: string, projectFolderName: string): Promise<void> {
  await ensurePunchListFolders(token);
  const [projectFolderPhotos, legacyFolder] = await Promise.all([
    getItemByPath(token, getProjectPhotosPath(projectFolderName)),
    getItemByPath(token, `${LEGACY_PHOTOS_PATH}/${projectFolderName}`),
  ]);
  const folders = dedupeDriveItems(
    [projectFolderPhotos, legacyFolder].filter((item): item is DriveItem => !!item?.id)
  );
  for (const folder of folders) {
    await deleteDriveItem(token, folder.id);
  }
}

export async function deleteProjectFolder(token: string, projectFolderName: string): Promise<void> {
  await ensurePunchListFolders(token);
  const folder = await getItemByPath(token, getProjectRootPath(projectFolderName));
  if (!folder?.id) return;
  await deleteDriveItem(token, folder.id);
}

export async function uploadPdfToOneDrive(
  token: string,
  filename: string,
  blob: Blob,
  projectFolderName?: string
) {
  await ensurePunchListFolders(token);
  const exportPath = projectFolderName
    ? getProjectExportsPath(projectFolderName)
    : SHARED_EXPORTS_PATH;
  if (projectFolderName) {
    await ensureFolder(token, getProjectRootPath(projectFolderName));
    await ensureFolder(token, exportPath);
  }
  return graphFetch<DriveItem>(token, `/me/drive/root:/${encodeURI(exportPath)}/${encodeURI(filename)}:/content`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/pdf',
    },
    body: blob,
  });
}

function sanitizeExportNamePart(name: string): string {
  const cleaned = name
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/gi, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'Project';
}

function formatDateForExport(now: Date): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd}`;
}

export async function getNextOneDriveExportFilename(
  token: string,
  projectNames: string[],
  now = new Date(),
  projectFolderName?: string
): Promise<string> {
  await ensurePunchListFolders(token);
  const base = projectNames.map(sanitizeExportNamePart).join('_') || 'PunchList';
  const date = formatDateForExport(now);
  const exportPath = projectFolderName
    ? getProjectExportsPath(projectFolderName)
    : SHARED_EXPORTS_PATH;
  if (projectFolderName) {
    await ensureFolder(token, getProjectRootPath(projectFolderName));
    await ensureFolder(token, exportPath);
  }
  const existingFiles = await graphFetch<{ value: DriveItem[] }>(
    token,
    `/me/drive/root:/${encodeURI(exportPath)}:/children?$select=name`
  );
  const prefix = `${base}_${date}_`;
  const matchingVersions = (existingFiles.value ?? [])
    .map((item) => item.name)
    .filter((name) => name.startsWith(prefix) && name.toLowerCase().endsWith('.pdf'))
    .map((name) => name.slice(prefix.length, -4))
    .map((rawVersion) => Number.parseInt(rawVersion, 10))
    .filter((version) => Number.isFinite(version) && version > 0);

  const nextVersion = (matchingVersions.length > 0 ? Math.max(...matchingVersions) : 0) + 1;
  return `${base}_${date}_${nextVersion}.pdf`;
}

export async function deleteDriveItem(token: string, id: string): Promise<void> {
  await graphFetch(token, `/me/drive/items/${id}`, {
    method: 'DELETE',
  });
}

export async function downloadDeletionLog(token: string): Promise<Record<string, unknown>> {
  try {
    const response = await fetch(`${GRAPH_API}/me/drive/root:/PunchList/deletions.json:/content`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      return {};
    }
    const text = await response.text();
    if (!text) return {};
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return parsed ?? {};
  } catch {
    return {};
  }
}

export async function uploadDeletionLog(
  token: string,
  data: Record<string, unknown>
): Promise<DriveItem> {
  return graphFetch<DriveItem>(token, '/me/drive/root:/PunchList/deletions.json:/content', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}
