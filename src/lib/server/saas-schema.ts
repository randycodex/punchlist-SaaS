import 'server-only';

import { sql } from '@/lib/server/neon';

declare global {
  // eslint-disable-next-line no-var
  var __punchlistSchemaReady: Promise<void> | undefined;
}

async function runSchema() {
  await sql`
    create table if not exists app_users (
      id text primary key,
      email text not null,
      name text not null,
      avatar_url text,
      default_organization_id text,
      auth_providers text[] not null default '{}',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  await sql`
    create table if not exists organizations (
      id text primary key,
      name text not null,
      slug text not null unique,
      firm_type text,
      logo_asset_id text,
      primary_color text,
      report_title text,
      report_footer text,
      show_prepared_by boolean not null default true,
      default_checklist_template_name text,
      subscription_tier text not null default 'individual',
      subscription_status text not null default 'trialing',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  await sql`
    create table if not exists organization_memberships (
      id text primary key,
      organization_id text not null references organizations(id) on delete cascade,
      user_id text not null references app_users(id) on delete cascade,
      role text not null,
      invited_email text,
      joined_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (organization_id, user_id)
    )
  `;

  await sql`
    alter table app_users
    add constraint app_users_default_organization_fk
    foreign key (default_organization_id)
    references organizations(id)
    on delete set null
  `.catch(() => undefined);
}

export function ensureSaaSSchema() {
  if (!globalThis.__punchlistSchemaReady) {
    globalThis.__punchlistSchemaReady = runSchema();
  }

  return globalThis.__punchlistSchemaReady;
}
