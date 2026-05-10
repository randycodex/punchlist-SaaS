import type {
  AssetObject,
  OfflineMutation,
  Organization,
  OrganizationMembership,
  ProjectPermission,
  SaaSProject,
  SaaSUser,
  TemplateDefinition,
} from '@/lib/saas/types';
import type { ZoningReport, ZoningReportItem, ZoningReportSummary, ZoningWorksheet } from '@/lib/zoning/types';

export interface SaaSSnapshot {
  user: SaaSUser;
  organizations: Organization[];
  memberships: OrganizationMembership[];
  projects: SaaSProject[];
  permissions: ProjectPermission[];
  templates: TemplateDefinition[];
  assets: AssetObject[];
}

export class SaaSApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'SaaSApiError';
  }
}

type RequestOptions = {
  accessToken?: string;
  signal?: AbortSignal;
};

const API_BASE_URL_RAW = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ?? '';

function getValidatedApiBaseUrl() {
  if (!API_BASE_URL_RAW) return '';

  // Ignore common placeholder values that break deployed fetch calls.
  if (API_BASE_URL_RAW.includes('your-project.vercel.app')) return '';
  if (API_BASE_URL_RAW.includes('api.example.com')) return '';

  try {
    const parsed = new URL(API_BASE_URL_RAW);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

const API_BASE_URL = getValidatedApiBaseUrl();

function getApiUrl(path: string) {
  if (API_BASE_URL) {
    return `${API_BASE_URL}${path}`;
  }

  return `/api${path}`;
}

async function request<T>(path: string, init: RequestInit = {}, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(getApiUrl(path), {
    ...init,
    signal: options.signal,
    headers: {
      'content-type': 'application/json',
      ...(options.accessToken ? { authorization: `Bearer ${options.accessToken}` } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    let details: unknown;
    try {
      details = await response.json();
    } catch {
      details = await response.text().catch(() => undefined);
    }
    const messageFromBody =
      typeof details === 'object' && details !== null && 'error' in details && typeof (details as any).error === 'string'
        ? String((details as any).error)
        : `API request failed: ${response.status}`;
    throw new SaaSApiError(messageFromBody, response.status, details);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function getSaaSSnapshot(options?: RequestOptions) {
  return request<SaaSSnapshot>('/v1/snapshot', {}, options);
}

export function updateCurrentOrganization(
  payload: {
    name: string;
    firmType?: Organization['firmType'];
    reportTitle?: string;
    reportFooter?: string;
    primaryColor?: string;
    showPreparedBy?: boolean;
    defaultChecklistTemplateName?: string;
  },
  options?: RequestOptions
) {
  return request<Organization>(
    '/v1/organizations/current',
    { method: 'PUT', body: JSON.stringify(payload) },
    options
  );
}

export function upsertProject(project: SaaSProject, options?: RequestOptions) {
  return request<SaaSProject>(
    `/v1/organizations/${project.organizationId}/projects/${project.id}`,
    { method: 'PUT', body: JSON.stringify(project) },
    options
  );
}

export function deleteSaaSProject(organizationId: string, projectId: string, options?: RequestOptions) {
  return request<void>(
    `/v1/organizations/${organizationId}/projects/${projectId}`,
    { method: 'DELETE' },
    options
  );
}

export function upsertTemplate(template: TemplateDefinition, options?: RequestOptions) {
  const organizationId = template.organizationId ?? 'system';
  return request<TemplateDefinition>(
    `/v1/organizations/${organizationId}/templates/${template.id}`,
    { method: 'PUT', body: JSON.stringify(template) },
    options
  );
}

export function flushOfflineMutation(mutation: OfflineMutation, options?: RequestOptions) {
  return request<unknown>(
    mutation.endpoint,
    {
      method: mutation.operation === 'delete' ? 'DELETE' : 'PUT',
      body: mutation.operation === 'delete' ? undefined : JSON.stringify(mutation.payload),
    },
    options
  );
}

export function listZoningReports(options?: RequestOptions) {
  return request<{ reports: ZoningReportSummary[] }>('/v1/zoning/reports', {}, options);
}

export function createZoningReport(
  payload: {
    projectId?: string;
    title?: string;
    address?: string;
    borough?: string;
    block?: string;
    lot?: string;
    bbl?: string;
    zipCode?: string;
    zoningDistrict?: string;
    commercialOverlay?: string;
    specialDistrict?: string;
    zoningMap?: string;
  },
  options?: RequestOptions
) {
  return request<ZoningWorksheet>(
    '/v1/zoning/reports',
    { method: 'POST', body: JSON.stringify(payload) },
    options
  );
}

export function getZoningReport(reportId: string, options?: RequestOptions) {
  return request<ZoningWorksheet>(`/v1/zoning/reports/${reportId}`, {}, options);
}

export function updateZoningReport(
  reportId: string,
  payload: {
    title?: string;
    address?: string;
    borough?: string;
    block?: string;
    lot?: string;
    bbl?: string;
    zipCode?: string;
    zoningDistrict?: string;
    commercialOverlay?: string;
    specialDistrict?: string;
    zoningMap?: string;
  },
  options?: RequestOptions
) {
  return request<ZoningReport>(
    `/v1/zoning/reports/${reportId}`,
    { method: 'PUT', body: JSON.stringify(payload) },
    options
  );
}

export function deleteZoningReport(reportId: string, options?: RequestOptions) {
  return request<{ ok: boolean }>(
    `/v1/zoning/reports/${reportId}`,
    { method: 'DELETE' },
    options
  );
}

export function updateZoningReportItem(
  reportId: string,
  itemId: string,
  payload: {
    value: string;
    zrSection?: string;
    itemDescription?: string;
    permittedRequired?: string;
    proposed?: string;
    result?: ZoningReportItem['result'];
    evaluationMode?: ZoningReportItem['evaluationMode'];
    source: string;
    status: ZoningReportItem['status'];
    notes?: string;
  },
  options?: RequestOptions
) {
  return request<ZoningReportItem>(
    `/v1/zoning/reports/${reportId}/items/${itemId}`,
    { method: 'PUT', body: JSON.stringify(payload) },
    options
  );
}
