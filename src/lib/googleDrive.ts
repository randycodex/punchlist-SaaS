import { Project, Area, Location, Item, Checkpoint, PhotoAttachment, FileAttachment } from '@/types';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

type DriveFile = {
  id: string;
  name: string;
  modifiedTime?: string;
  etag?: string;
};

type PunchListFolders = {
  rootId: string;
  projectsId: string;
  exportsId: string;
};

async function driveFetch<T>(
  token: string,
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Drive request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function listFiles(token: string, query: string, fields: string) {
  const params = new URLSearchParams({
    q: query,
    fields,
    pageSize: '1000',
  });
  return driveFetch<{ files: DriveFile[] }>(
    token,
    `${DRIVE_API}/files?${params.toString()}`
  );
}

async function ensureFolder(token: string, name: string, parentId?: string): Promise<string> {
  const parentClause = parentId ? ` and '${parentId}' in parents` : '';
  const query = `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false${parentClause}`;
  const list = await listFiles(token, query, 'files(id,name)');
  if (list.files.length > 0) {
    return list.files[0].id;
  }

  const metadata: { name: string; mimeType: string; parents?: string[] } = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) {
    metadata.parents = [parentId];
  }

  const created = await driveFetch<{ id: string }>(token, `${DRIVE_API}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata),
  });

  return created.id;
}

export async function ensurePunchListFolders(token: string): Promise<PunchListFolders> {
  const rootId = await ensureFolder(token, 'PunchList');
  const projectsId = await ensureFolder(token, 'projects', rootId);
  const exportsId = await ensureFolder(token, 'exports', rootId);
  return { rootId, projectsId, exportsId };
}

function buildMultipartBody(
  boundary: string,
  metadata: Record<string, unknown>,
  mimeType: string,
  data: Blob | string
) {
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;
  const metadataPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
    metadata
  )}`;
  const dataHeader = `${delimiter}Content-Type: ${mimeType}\r\n\r\n`;
  return new Blob([metadataPart, dataHeader, data, closeDelimiter], {
    type: `multipart/related; boundary=${boundary}`,
  });
}

async function uploadMultipart(
  token: string,
  url: string,
  method: 'POST' | 'PATCH',
  metadata: Record<string, unknown>,
  mimeType: string,
  data: Blob | string,
  etag?: string
) {
  const boundary = `punchlist_${Math.random().toString(36).slice(2)}`;
  const body = buildMultipartBody(boundary, metadata, mimeType, data);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': `multipart/related; boundary=${boundary}`,
  };
  if (etag) {
    headers['If-Match'] = etag;
  }

  const response = await fetch(url, {
    method,
    headers,
    body,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Drive upload failed: ${response.status}`);
  }

  return response.json();
}

async function createFile(
  token: string,
  name: string,
  parentId: string,
  mimeType: string,
  data: Blob | string
) {
  const metadata = { name, parents: [parentId], mimeType };
  const url = `${DRIVE_UPLOAD_API}/files?uploadType=multipart`;
  return uploadMultipart(token, url, 'POST', metadata, mimeType, data);
}

async function updateFile(
  token: string,
  fileId: string,
  mimeType: string,
  data: Blob | string,
  etag?: string
) {
  const metadata = { mimeType };
  const url = `${DRIVE_UPLOAD_API}/files/${fileId}?uploadType=multipart`;
  return uploadMultipart(token, url, 'PATCH', metadata, mimeType, data, etag);
}

export async function listProjectFiles(token: string, projectsFolderId: string) {
  const query = `'${projectsFolderId}' in parents and mimeType='application/json' and trashed=false`;
  const result = await listFiles(
    token,
    query,
    'files(id,name,modifiedTime,etag)'
  );
  return result.files;
}

export async function downloadProjectFile(token: string, fileId: string) {
  const response = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Drive download failed: ${response.status}`);
  }
  return response.json();
}

export async function saveProjectFile(
  token: string,
  project: Project,
  projectsFolderId: string,
  existing?: DriveFile
) {
  const name = `${project.id}.json`;
  const data = JSON.stringify(project);
  if (existing) {
    return updateFile(token, existing.id, 'application/json', data, existing.etag);
  }
  return createFile(token, name, projectsFolderId, 'application/json', data);
}

export async function uploadPdfToDrive(
  token: string,
  filename: string,
  pdfBlob: Blob
) {
  const { exportsId } = await ensurePunchListFolders(token);
  return createFile(token, filename, exportsId, 'application/pdf', pdfBlob);
}

function reviveDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value);
}

function revivePhotos(photos: PhotoAttachment[] = []) {
  return photos.map((photo) => ({
    ...photo,
    createdAt: reviveDate(photo.createdAt),
  }));
}

function reviveFiles(files: FileAttachment[] = []) {
  return files.map((file) => ({
    ...file,
    createdAt: reviveDate(file.createdAt),
  }));
}

function reviveCheckpoints(checkpoints: Checkpoint[] = []) {
  return checkpoints.map((checkpoint) => ({
    ...checkpoint,
    photos: revivePhotos(checkpoint.photos ?? []),
    files: reviveFiles(checkpoint.files ?? []),
    createdAt: reviveDate(checkpoint.createdAt),
    updatedAt: reviveDate(checkpoint.updatedAt),
  }));
}

function reviveItems(items: Item[] = []) {
  return items.map((item) => ({
    ...item,
    checkpoints: reviveCheckpoints(item.checkpoints ?? []),
    createdAt: reviveDate(item.createdAt),
    updatedAt: reviveDate(item.updatedAt),
  }));
}

function reviveLocations(locations: Location[] = []) {
  return locations.map((location) => ({
    ...location,
    items: reviveItems(location.items ?? []),
    createdAt: reviveDate(location.createdAt),
    updatedAt: reviveDate(location.updatedAt),
  }));
}

function reviveAreas(areas: Area[] = []) {
  return areas.map((area) => ({
    ...area,
    locations: reviveLocations(area.locations ?? []),
    createdAt: reviveDate(area.createdAt),
    updatedAt: reviveDate(area.updatedAt),
  }));
}

export function reviveProject(project: Project): Project {
  return {
    ...project,
    areas: reviveAreas(project.areas ?? []),
    createdAt: reviveDate(project.createdAt),
    updatedAt: reviveDate(project.updatedAt),
  };
}

export function getProjectIdFromFilename(name: string) {
  return name.endsWith('.json') ? name.replace(/\.json$/, '') : name;
}
