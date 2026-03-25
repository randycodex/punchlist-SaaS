export type CheckpointStatus = 'pending' | 'ok' | 'needsReview';
export type FixStatus = 'pending' | 'fixed' | 'verified';

export interface PhotoAttachment {
  id: string;
  checkpointId: string;
  imageData: string; // Base64 encoded
  thumbnail: string; // Base64 encoded thumbnail
  createdAt: Date;
}

export interface FileAttachment {
  id: string;
  checkpointId: string;
  name: string;
  mimeType: string;
  size: number;
  data: string; // Base64 encoded
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
  files: FileAttachment[];
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
  areaTypeKey?: string;
  unitType?: string;
  areaNumber?: string;
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
  let total = 0;
  let ok = 0;
  let issues = 0;

  for (const location of area.locations) {
    for (const item of location.items) {
      for (const checkpoint of item.checkpoints) {
        total += 1;
        if (checkpoint.status === 'ok') ok += 1;
        else if (checkpoint.status === 'needsReview') issues += 1;
      }
    }
  }

  return {
    total,
    ok,
    issues,
  };
}

export function getReviewMetrics(total: number, ok: number, issues: number) {
  const pending = Math.max(total - ok - issues, 0);
  const reviewed = ok + issues;
  const reviewedPercent = total > 0 ? (reviewed / total) * 100 : 0;
  const okPercent = reviewed > 0 ? (ok / reviewed) * 100 : 0;
  const issuePercent = reviewed > 0 ? (issues / reviewed) * 100 : 0;

  return {
    pending,
    reviewed,
    reviewedPercent,
    okPercent,
    issuePercent,
  };
}

export function getLocationStats(location: Location) {
  let total = 0;
  let ok = 0;
  let issues = 0;

  for (const item of location.items) {
    for (const checkpoint of item.checkpoints) {
      total += 1;
      if (checkpoint.status === 'ok') ok += 1;
      else if (checkpoint.status === 'needsReview') issues += 1;
    }
  }

  return {
    total,
    ok,
    issues,
  };
}

export function getItemStats(item: Item) {
  let total = 0;
  let ok = 0;
  let issues = 0;

  for (const checkpoint of item.checkpoints) {
    total += 1;
    if (checkpoint.status === 'ok') ok += 1;
    else if (checkpoint.status === 'needsReview') issues += 1;
  }

  return {
    total,
    ok,
    issues,
  };
}

export function getProjectStats(project: Project) {
  let total = 0;
  let ok = 0;
  let issues = 0;

  for (const area of project.areas) {
    for (const location of area.locations) {
      for (const item of location.items) {
        for (const checkpoint of item.checkpoints) {
          total += 1;
          if (checkpoint.status === 'ok') ok += 1;
          else if (checkpoint.status === 'needsReview') issues += 1;
        }
      }
    }
  }

  return {
    total,
    ok,
    issues,
    areas: project.areas.length,
  };
}
