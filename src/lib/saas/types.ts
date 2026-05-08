import type { Project } from '@/types';

export type AuthProvider = 'email' | 'google' | 'microsoft' | 'apple';
export type OrganizationRole = 'owner' | 'admin' | 'manager' | 'inspector' | 'client';
export type ProjectRole = 'manager' | 'editor' | 'viewer';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';
export type TemplateScope = 'system' | 'organization' | 'project';
export type OfflineMutationStatus = 'pending' | 'syncing' | 'failed';

export interface SaaSUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  authProviders: AuthProvider[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoAssetId?: string;
  subscriptionStatus: SubscriptionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationMembership {
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectPermission {
  id: string;
  projectId: string;
  userId?: string;
  membershipId?: string;
  role: ProjectRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateDefinition {
  id: string;
  organizationId?: string;
  projectId?: string;
  scope: TemplateScope;
  name: string;
  description?: string;
  locations: Array<{
    name: string;
    sectionLabel?: string;
    items: Array<{
      name: string;
      checkpoints: string[];
    }>;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssetObject {
  id: string;
  organizationId: string;
  projectId?: string;
  ownerUserId: string;
  bucket: 'logos' | 'photos' | 'files' | 'pdfs';
  objectKey: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  createdAt: Date;
}

export interface SaaSProject extends Project {
  organizationId: string;
  templateId?: string;
  permissionIds?: string[];
  serverVersion?: number;
  lastSyncedAt?: Date;
}

export interface OfflineMutation {
  id: string;
  organizationId?: string;
  projectId?: string;
  entityType: 'organization' | 'project' | 'template' | 'asset' | 'membership' | 'permission';
  operation: 'create' | 'update' | 'delete';
  endpoint: string;
  payload: unknown;
  status: OfflineMutationStatus;
  attempts: number;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}
