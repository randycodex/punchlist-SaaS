import type { Area as PunchlistArea, PhotoAttachment, Project as PunchlistProject } from '@/types';

export type AuthProvider = 'email' | 'google' | 'microsoft' | 'apple';
export type OrganizationRole = 'owner' | 'admin' | 'member' | 'viewer';
export type ProjectRole = 'manager' | 'editor' | 'viewer';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';
export type SubscriptionTier = 'individual' | 'team' | 'enterprise';
export type TemplateScope = 'system' | 'organization' | 'project';
export type OfflineMutationStatus = 'pending' | 'syncing' | 'failed';
export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'verified' | 'closed';
export type IssuePriority = 'low' | 'medium' | 'high' | 'critical';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  defaultOrganizationId?: string;
  avatarUrl?: string;
  authProviders: AuthProvider[];
  createdAt: Date;
  updatedAt: Date;
}

export type SaaSUser = UserProfile;

export interface FirmBrandingSettings {
  logoAssetId?: string;
  primaryColor?: string;
  reportTitle?: string;
  reportFooter?: string;
  showPreparedBy?: boolean;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  firmType?: 'architecture' | 'construction' | 'owner' | 'consultant' | 'developer' | 'other';
  defaultChecklistTemplateName?: string;
  logoAssetId?: string;
  branding?: FirmBrandingSettings;
  subscriptionTier?: SubscriptionTier;
  subscriptionStatus: SubscriptionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  invitedEmail?: string;
  joinedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type OrganizationMembership = OrganizationMember;

export interface ProjectPermission {
  id: string;
  projectId: string;
  userId?: string;
  membershipId?: string;
  role: ProjectRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChecklistItem {
  id: string;
  templateId: string;
  name: string;
  category?: string;
  sortOrder: number;
  required?: boolean;
}

export interface ChecklistTemplate {
  id: string;
  organizationId?: string;
  projectId?: string;
  scope: TemplateScope;
  name: string;
  description?: string;
  items: ChecklistItem[];
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

export interface Photo extends PhotoAttachment {
  organizationId?: string;
  assetId?: string;
  caption?: string;
}

export interface Issue {
  id: string;
  organizationId: string;
  projectId: string;
  areaId?: string;
  checkpointId?: string;
  title: string;
  description?: string;
  status: IssueStatus;
  priority: IssuePriority;
  photoIds?: string[];
  assignedMemberId?: string;
  dueAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Report {
  id: string;
  organizationId: string;
  projectId: string;
  title: string;
  assetId?: string;
  generatedByUserId: string;
  generatedAt: Date;
}

export type Area = PunchlistArea;

export interface Project extends PunchlistProject {
  organizationId?: string;
  templateId?: string;
  serverVersion?: number;
  lastSyncedAt?: Date;
}

export interface SaaSProject extends PunchlistProject {
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
