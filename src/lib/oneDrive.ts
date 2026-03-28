const GRAPH_API = 'https://graph.microsoft.com/v1.0';
let ensuredFolderIds: { projectsId: string; exportsId: string } | null = null;

type DriveItem = {
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

export async function ensurePunchListFolders(token: string) {
  if (ensuredFolderIds) {
    return ensuredFolderIds;
  }
  await ensureFolder(token, 'PunchList');
  const projects = await ensureFolder(token, 'PunchList/projects');
  const exports = await ensureFolder(token, 'PunchList/exports');
  ensuredFolderIds = { projectsId: projects.id, exportsId: exports.id };
  return ensuredFolderIds;
}

export async function listProjectFiles(token: string) {
  const result = await graphFetch<{ value: DriveItem[] }>(
    token,
    `/me/drive/root:/PunchList/projects:/children?$select=id,name,lastModifiedDateTime,eTag`
  );
  return result.value ?? [];
}

export async function getProjectFileMetadata(token: string, filename: string): Promise<DriveItem | null> {
  return getItemByPath(token, `PunchList/projects/${filename}`);
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

export async function uploadProjectFile(
  token: string,
  filename: string,
  content: string,
  etag?: string
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (etag) {
    headers['If-Match'] = etag;
  }
  return graphFetch<DriveItem>(token, `/me/drive/root:/PunchList/projects/${encodeURI(filename)}:/content`, {
    method: 'PUT',
    headers,
    body: content,
  });
}

export async function uploadPdfToOneDrive(token: string, filename: string, blob: Blob) {
  await ensurePunchListFolders(token);
  return graphFetch<DriveItem>(token, `/me/drive/root:/PunchList/exports/${encodeURI(filename)}:/content`, {
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
  now = new Date()
): Promise<string> {
  await ensurePunchListFolders(token);
  const base = projectNames.map(sanitizeExportNamePart).join('_') || 'PunchList';
  const date = formatDateForExport(now);
  const existingFiles = await graphFetch<{ value: DriveItem[] }>(
    token,
    '/me/drive/root:/PunchList/exports:/children?$select=name'
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

export async function downloadDeletionLog(token: string): Promise<Record<string, string>> {
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
    const parsed = JSON.parse(text) as Record<string, string>;
    return parsed ?? {};
  } catch {
    return {};
  }
}

export async function uploadDeletionLog(
  token: string,
  data: Record<string, string>
): Promise<DriveItem> {
  return graphFetch<DriveItem>(token, '/me/drive/root:/PunchList/deletions.json:/content', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}
