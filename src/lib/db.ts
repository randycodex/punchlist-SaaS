import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Project, Area, Location, Item, Checkpoint, PhotoAttachment, FileAttachment } from '@/types';
import type { AreaTypeKey, ApartmentUnitType } from '@/lib/areas';
import { v4 as uuidv4 } from 'uuid';

interface PunchListDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
    indexes: { 'by-name': string; 'by-date': Date };
  };
}

let dbPromise: Promise<IDBPDatabase<PunchListDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<PunchListDB>('punchlist-db', 1, {
      upgrade(db) {
        const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
        projectStore.createIndex('by-name', 'projectName');
        projectStore.createIndex('by-date', 'updatedAt');
      },
    });
  }
  return dbPromise;
}

// Project operations
export async function getAllProjects(): Promise<Project[]> {
  const db = await getDB();
  return db.getAll('projects');
}

export async function getProject(id: string): Promise<Project | undefined> {
  const db = await getDB();
  return db.get('projects', id);
}

export async function saveProject(project: Project): Promise<void> {
  await saveProjectInternal(project, { touch: true });
}

export async function saveProjectPreserveTimestamps(project: Project): Promise<void> {
  await saveProjectInternal(project, { touch: false });
}

async function saveProjectInternal(project: Project, options: { touch: boolean }): Promise<void> {
  const db = await getDB();
  if (options.touch) {
    project.updatedAt = new Date();
  }
  await db.put('projects', project);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('projects', id);
}

export function createProject(name: string, address: string = '', inspector: string = ''): Project {
  const now = new Date();
  return {
    id: uuidv4(),
    projectName: name,
    address,
    date: now,
    inspector,
    gcName: '',
    gcSignoff: '',
    areas: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createArea(
  projectId: string,
  name: string,
  sortOrder: number,
  options?: {
    areaTypeKey?: AreaTypeKey;
    unitType?: ApartmentUnitType | '';
    customAreaName?: string;
    areaNumber?: string;
  }
): Area {
  const now = new Date();
  return {
    id: uuidv4(),
    projectId,
    name,
    areaTypeKey: options?.areaTypeKey,
    unitType: options?.unitType || undefined,
    customAreaName: options?.customAreaName?.trim() || undefined,
    areaNumber: options?.areaNumber?.trim() || undefined,
    sortOrder,
    isComplete: false,
    notes: '',
    locations: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createLocation(areaId: string, name: string, sortOrder: number): Location {
  const now = new Date();
  return {
    id: uuidv4(),
    areaId,
    name,
    sortOrder,
    items: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createItem(locationId: string, name: string, sortOrder: number): Item {
  const now = new Date();
  return {
    id: uuidv4(),
    locationId,
    name,
    sortOrder,
    checkpoints: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createCheckpoint(itemId: string, name: string, sortOrder: number): Checkpoint {
  const now = new Date();
  return {
    id: uuidv4(),
    itemId,
    name,
    status: 'pending',
    fixStatus: 'pending',
    comments: '',
    sortOrder,
    photos: [],
    files: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createPhotoAttachment(checkpointId: string, imageData: string, thumbnail: string): PhotoAttachment {
  return {
    id: uuidv4(),
    checkpointId,
    imageData,
    thumbnail,
    createdAt: new Date(),
  };
}

export function createFileAttachment(
  checkpointId: string,
  data: string,
  name: string,
  mimeType: string,
  size: number
): FileAttachment {
  return {
    id: uuidv4(),
    checkpointId,
    data,
    name,
    mimeType,
    size,
    createdAt: new Date(),
  };
}
