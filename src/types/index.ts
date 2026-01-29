export type CheckpointStatus = 'pending' | 'ok' | 'needsReview';
export type FixStatus = 'pending' | 'fixed' | 'verified';

export interface PhotoAttachment {
  id: string;
  checkpointId: string;
  imageData: string; // Base64 encoded
  thumbnail: string; // Base64 encoded thumbnail
  createdAt: Date;
}

export interface Checkpoint {
  id: string;
  itemId: string;
  name: string;
  status: CheckpointStatus;
  fixStatus: FixStatus;
  comments: string;
  sortOrder: number;
  photos: PhotoAttachment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Item {
  id: string;
  locationId: string;
  name: string;
  sortOrder: number;
  checkpoints: Checkpoint[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Location {
  id: string;
  areaId: string;
  name: string;
  sortOrder: number;
  items: Item[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Area {
  id: string;
  projectId: string;
  name: string;
  sortOrder: number;
  isComplete: boolean;
  notes: string;
  locations: Location[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  projectName: string;
  address: string;
  date: Date;
  inspector: string;
  gcName: string;
  gcSignoff: string;
  areas: Area[];
  createdAt: Date;
  updatedAt: Date;
}

// Helper functions for calculating stats
export function getAreaStats(area: Area) {
  const checkpoints = area.locations.flatMap(l => l.items.flatMap(i => i.checkpoints));
  return {
    total: checkpoints.length,
    ok: checkpoints.filter(c => c.status === 'ok').length,
    issues: checkpoints.filter(c => c.status === 'needsReview').length,
  };
}

export function getLocationStats(location: Location) {
  const checkpoints = location.items.flatMap(i => i.checkpoints);
  return {
    total: checkpoints.length,
    ok: checkpoints.filter(c => c.status === 'ok').length,
    issues: checkpoints.filter(c => c.status === 'needsReview').length,
  };
}

export function getItemStats(item: Item) {
  return {
    total: item.checkpoints.length,
    ok: item.checkpoints.filter(c => c.status === 'ok').length,
    issues: item.checkpoints.filter(c => c.status === 'needsReview').length,
  };
}

export function getProjectStats(project: Project) {
  const checkpoints = project.areas.flatMap(a =>
    a.locations.flatMap(l => l.items.flatMap(i => i.checkpoints))
  );
  return {
    total: checkpoints.length,
    ok: checkpoints.filter(c => c.status === 'ok').length,
    issues: checkpoints.filter(c => c.status === 'needsReview').length,
    areas: project.areas.length,
  };
}
