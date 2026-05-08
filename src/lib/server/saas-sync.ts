import 'server-only';

import { auth, clerkClient, currentUser } from '@clerk/nextjs/server';
import type { OrganizationMembershipRole } from '@clerk/backend';
import { ensureSaaSSchema } from '@/lib/server/saas-schema';
import { sql } from '@/lib/server/neon';
import type {
  AssetObject,
  Organization,
  OrganizationMembership,
  ProjectPermission,
  SaaSProject,
  SaaSUser,
  TemplateDefinition,
} from '@/lib/saas/types';

type SnapshotRow = {
  user: SaaSUser;
  organizations: Organization[];
  memberships: OrganizationMembership[];
  projects: SaaSProject[];
  permissions: ProjectPermission[];
  templates: TemplateDefinition[];
  assets: AssetObject[];
};

function slugifyOrganizationName(name: string, fallbackId: string) {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return slug || `org-${fallbackId.slice(0, 8)}`;
}

function normalizeAuthProviders(user: Awaited<ReturnType<typeof currentUser>>): SaaSUser['authProviders'] {
  if (!user) {
    return ['email'];
  }

  const providers = new Set<SaaSUser['authProviders'][number]>();
  providers.add('email');

  for (const account of user.externalAccounts ?? []) {
    const provider = String(account.provider).toLowerCase();
    if (provider.includes('google')) providers.add('google');
    if (provider.includes('microsoft')) providers.add('microsoft');
    if (provider.includes('apple')) providers.add('apple');
  }

  return [...providers];
}

function mapOrganization(row: {
  id: string;
  name: string;
  slug: string;
  firm_type: Organization['firmType'] | null;
  logo_asset_id: string | null;
  primary_color: string | null;
  report_title: string | null;
  report_footer: string | null;
  show_prepared_by: boolean;
  default_checklist_template_name: string | null;
  subscription_tier: Organization['subscriptionTier'] | null;
  subscription_status: Organization['subscriptionStatus'];
  created_at: Date;
  updated_at: Date;
}): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    firmType: row.firm_type ?? undefined,
    logoAssetId: row.logo_asset_id ?? undefined,
    subscriptionTier: row.subscription_tier ?? undefined,
    subscriptionStatus: row.subscription_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    branding: {
      primaryColor: row.primary_color ?? undefined,
      reportTitle: row.report_title ?? undefined,
      reportFooter: row.report_footer ?? undefined,
      showPreparedBy: row.show_prepared_by,
    },
    defaultChecklistTemplateName: row.default_checklist_template_name ?? undefined,
  };
}

async function upsertCurrentUser(userId: string, activeOrganizationId?: string | null) {
  const user = await currentUser();

  if (!user) {
    return null;
  }

  const email =
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses?.[0]?.emailAddress ??
    `${userId}@clerk.local`;
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.username || email;
  const providers = normalizeAuthProviders(user);

  const [row] = await sql<{
    id: string;
    email: string;
    name: string;
    avatar_url: string | null;
    default_organization_id: string | null;
    auth_providers: string[];
    created_at: Date;
    updated_at: Date;
  }[]>`
    insert into app_users (
      id,
      email,
      name,
      avatar_url,
      default_organization_id,
      auth_providers
    ) values (
      ${userId},
      ${email},
      ${name},
      ${user.imageUrl ?? null},
      ${activeOrganizationId ?? null},
      ${sql.array(providers)}
    )
    on conflict (id) do update set
      email = excluded.email,
      name = excluded.name,
      avatar_url = excluded.avatar_url,
      default_organization_id = coalesce(excluded.default_organization_id, app_users.default_organization_id),
      auth_providers = excluded.auth_providers,
      updated_at = now()
    returning *
  `;

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatar_url ?? undefined,
    defaultOrganizationId: row.default_organization_id ?? undefined,
    authProviders: row.auth_providers as SaaSUser['authProviders'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } satisfies SaaSUser;
}

async function upsertOrganizationAndMembership(
  userId: string,
  organizationId: string,
  fallbackRole?: OrganizationMembershipRole | null
) {
  const client = await clerkClient();
  const organization = await client.organizations.getOrganization({ organizationId });
  const membershipList = await client.organizations.getOrganizationMembershipList({
    organizationId,
    userId,
    limit: 1,
  } as never);
  const membership = membershipList.data?.[0];
  const role = (membership?.role ?? fallbackRole ?? 'member') as OrganizationMembership['role'];
  const slug = slugifyOrganizationName(organization.name, organization.id);

  await sql`
    insert into organizations (
      id,
      name,
      slug
    ) values (
      ${organization.id},
      ${organization.name},
      ${slug}
    )
    on conflict (id) do update set
      name = excluded.name,
      slug = excluded.slug,
      updated_at = now()
  `;

  const membershipId = membership?.id ?? `${organization.id}:${userId}`;
  const invitedEmail = membership?.publicUserData?.identifier ?? null;
  const joinedAt = membership?.createdAt ? new Date(membership.createdAt) : new Date();

  await sql`
    insert into organization_memberships (
      id,
      organization_id,
      user_id,
      role,
      invited_email,
      joined_at
    ) values (
      ${membershipId},
      ${organization.id},
      ${userId},
      ${role},
      ${invitedEmail},
      ${joinedAt}
    )
    on conflict (id) do update set
      role = excluded.role,
      invited_email = excluded.invited_email,
      joined_at = coalesce(organization_memberships.joined_at, excluded.joined_at),
      updated_at = now()
  `;
}

export async function syncClerkState() {
  await ensureSaaSSchema();

  const { userId, orgId, orgRole } = await auth();

  if (!userId) {
    return null;
  }

  const client = await clerkClient();
  const orgList = await client.users.getOrganizationMembershipList({
    userId,
    limit: 100,
  } as never);

  const activeOrganizationId = orgId ?? orgList.data?.[0]?.organization?.id ?? null;
  const user = await upsertCurrentUser(userId, activeOrganizationId);

  for (const membership of orgList.data ?? []) {
    await upsertOrganizationAndMembership(
      userId,
      membership.organization.id,
      membership.role as OrganizationMembershipRole
    );
  }

  if (orgId && !(orgList.data ?? []).some((membership) => membership.organization.id === orgId)) {
    await upsertOrganizationAndMembership(userId, orgId, (orgRole as OrganizationMembershipRole | null) ?? null);
  }

  if (activeOrganizationId) {
    await sql`
      update app_users
      set default_organization_id = ${activeOrganizationId},
          updated_at = now()
      where id = ${userId}
    `;
  }

  return user;
}

export async function getCurrentSnapshot(): Promise<SnapshotRow> {
  const user = await syncClerkState();

  if (!user) {
    throw new Error('Not authenticated.');
  }

  const organizationRows = await sql<{
    id: string;
    name: string;
    slug: string;
    firm_type: Organization['firmType'] | null;
    logo_asset_id: string | null;
    primary_color: string | null;
    report_title: string | null;
    report_footer: string | null;
    show_prepared_by: boolean;
    default_checklist_template_name: string | null;
    subscription_tier: Organization['subscriptionTier'] | null;
    subscription_status: Organization['subscriptionStatus'];
    created_at: Date;
    updated_at: Date;
  }[]>`
    select o.*
    from organizations o
    inner join organization_memberships m
      on m.organization_id = o.id
    where m.user_id = ${user.id}
    order by o.created_at asc
  `;

  const membershipRows = await sql<{
    id: string;
    organization_id: string;
    user_id: string;
    role: OrganizationMembership['role'];
    invited_email: string | null;
    joined_at: Date | null;
    created_at: Date;
    updated_at: Date;
  }[]>`
    select *
    from organization_memberships
    where user_id = ${user.id}
    order by created_at asc
  `;

  return {
    user,
    organizations: organizationRows.map(mapOrganization),
    memberships: membershipRows.map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      userId: row.user_id,
      role: row.role,
      invitedEmail: row.invited_email ?? undefined,
      joinedAt: row.joined_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    projects: [],
    permissions: [],
    templates: [],
    assets: [],
  };
}

export async function updateCurrentOrganization(input: {
  name: string;
  firmType?: Organization['firmType'];
  reportTitle?: string;
  reportFooter?: string;
  primaryColor?: string;
  showPreparedBy?: boolean;
  defaultChecklistTemplateName?: string;
}) {
  await ensureSaaSSchema();

  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    throw new Error('An active organization is required.');
  }

  await syncClerkState();

  const slug = slugifyOrganizationName(input.name, orgId);
  const [row] = await sql<{
    id: string;
    name: string;
    slug: string;
    firm_type: Organization['firmType'] | null;
    logo_asset_id: string | null;
    primary_color: string | null;
    report_title: string | null;
    report_footer: string | null;
    show_prepared_by: boolean;
    default_checklist_template_name: string | null;
    subscription_tier: Organization['subscriptionTier'] | null;
    subscription_status: Organization['subscriptionStatus'];
    created_at: Date;
    updated_at: Date;
  }[]>`
    update organizations
    set
      name = ${input.name},
      slug = ${slug},
      firm_type = ${input.firmType ?? null},
      report_title = ${input.reportTitle ?? null},
      report_footer = ${input.reportFooter ?? null},
      primary_color = ${input.primaryColor ?? null},
      show_prepared_by = ${input.showPreparedBy ?? true},
      default_checklist_template_name = ${input.defaultChecklistTemplateName ?? null},
      updated_at = now()
    where id = ${orgId}
    returning *
  `;

  return mapOrganization(row);
}
