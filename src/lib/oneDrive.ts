const GRAPH_API = 'https://graph.microsoft.com/v1.0';

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
    if (error instanceof Error && error.message.includes('itemNotFound')) {
      return null;
    }
    return null;
  }
}

async function ensureFolder(token: string, path: string): Promise<DriveItem> {
  const existing = await getItemByPath(token, path);
  if (existing?.folder) return existing;

  return await graphFetch<DriveItem>(token, `/me/drive/root:/${encodeURI(path)}:/`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      folder: {},
      '@microsoft.graph.conflictBehavior': 'fail',
    }),
  });
}

export async function ensurePunchListFolders(token: string) {
  await ensureFolder(token, 'PunchList');
  const projects = await ensureFolder(token, 'PunchList/projects');
  const exports = await ensureFolder(token, 'PunchList/exports');
  return { projectsId: projects.id, exportsId: exports.id };
}

export async function listProjectFiles(token: string) {
  const result = await graphFetch<{ value: DriveItem[] }>(
    token,
    `/me/drive/root:/PunchList/projects:/children?$select=id,name,lastModifiedDateTime,eTag`
  );
  return result.value ?? [];
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
  return graphFetch<DriveItem>(token, `/me/drive/root:/PunchList/exports/${encodeURI(filename)}:/content`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/pdf',
    },
    body: blob,
  });
}

export function buildExportPdfFilename(baseName: string, now = new Date()): string {
  const cleanBase = baseName
    .trim()
    .replace(/[^a-z0-9._-]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const stamp = `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
  return `${cleanBase || 'PunchList_Report'}_${stamp}.pdf`;
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
