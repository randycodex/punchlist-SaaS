import 'server-only';

import { auth } from '@clerk/nextjs/server';
import { randomUUID } from 'node:crypto';
import { ensureSaaSSchema } from '@/lib/server/saas-schema';
import { syncClerkState } from '@/lib/server/saas-sync';
import { sql } from '@/lib/server/neon';
import { mockZoningWorksheet } from '@/lib/zoning/mockZoningData';
import type {
  ZoningManualFlag,
  ZoningReference,
  ZoningReport,
  ZoningReportItem,
  ZoningReportSection,
  ZoningReportSummary,
  ZoningSectionKey,
  ZoningWorksheet,
} from '@/lib/zoning/types';

type ZoningReportRow = {
  id: string;
  organization_id: string;
  project_id: string | null;
  title: string;
  address: string | null;
  borough: string | null;
  block: string | null;
  lot: string | null;
  zoning_district: string | null;
  commercial_overlay: string | null;
  special_district: string | null;
  created_at: Date;
  updated_at: Date;
};

type ZoningSectionRow = {
  id: string;
  report_id: string;
  section_key: ZoningSectionKey;
  title: string;
  description: string | null;
  sort_order: number;
};

type ZoningItemRow = {
  id: string;
  report_id: string;
  section: ZoningSectionKey;
  field: string;
  value: string | null;
  source: string | null;
  status: ZoningReportItem['status'];
  notes: string | null;
  created_at: Date;
};

type ZoningManualFlagRow = {
  id: string;
  report_id: string;
  title: string;
  description: string;
  severity: ZoningManualFlag['severity'];
  reference: string | null;
};

type ZoningReferenceRow = {
  id: string;
  report_id: string;
  label: string;
  source: string;
  url: string | null;
  notes: string | null;
};

export type UpsertZoningReportInput = {
  reportId?: string;
  projectId?: string;
  title?: string;
  address?: string;
  borough?: string;
  block?: string;
  lot?: string;
  zoningDistrict?: string;
  commercialOverlay?: string;
  specialDistrict?: string;
};

function mapReport(row: ZoningReportRow): ZoningReport {
  return {
    id: row.id,
    organizationId: row.organization_id,
    projectId: row.project_id ?? undefined,
    title: row.title,
    address: row.address ?? '',
    borough: row.borough ?? '',
    block: row.block ?? '',
    lot: row.lot ?? '',
    zoningDistrict: row.zoning_district ?? '',
    commercialOverlay: row.commercial_overlay ?? undefined,
    specialDistrict: row.special_district ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getActiveOrganizationId() {
  await ensureSaaSSchema();
  await syncClerkState();

  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    const [membership] = await sql<{ organization_id: string }[]>`
      select organization_id
      from organization_memberships
      where user_id = ${userId}
      order by created_at asc
      limit 1
    `;

    if (membership?.organization_id) {
      return membership.organization_id;
    }

    throw new Error('An active organization is required.');
  }

  return orgId;
}

async function assertReportAccess(reportId: string, organizationId: string) {
  const [row] = await sql<ZoningReportRow[]>`
    select *
    from zoning_reports
    where id = ${reportId}
      and organization_id = ${organizationId}
    limit 1
  `;

  if (!row) {
    throw new Error('Zoning report not found.');
  }

  return row;
}

export async function listZoningReports(): Promise<ZoningReportSummary[]> {
  const organizationId = await getActiveOrganizationId();

  const rows = await sql<ZoningReportRow[]>`
    select *
    from zoning_reports
    where organization_id = ${organizationId}
    order by updated_at desc
  `;

  return rows.map(mapReport);
}

export async function createZoningReport(input: UpsertZoningReportInput = {}) {
  const organizationId = await getActiveOrganizationId();
  const reportId = input.reportId ?? randomUUID();
  const seed = mockZoningWorksheet.report;

  const [row] = await sql<ZoningReportRow[]>`
    insert into zoning_reports (
      id,
      organization_id,
      project_id,
      title,
      address,
      borough,
      block,
      lot,
      zoning_district,
      commercial_overlay,
      special_district
    ) values (
      ${reportId},
      ${organizationId},
      ${input.projectId ?? null},
      ${input.title?.trim() || seed.title},
      ${input.address?.trim() || seed.address},
      ${input.borough?.trim() || seed.borough},
      ${input.block?.trim() || seed.block},
      ${input.lot?.trim() || seed.lot},
      ${input.zoningDistrict?.trim() || seed.zoningDistrict},
      ${input.commercialOverlay?.trim() || seed.commercialOverlay || null},
      ${input.specialDistrict?.trim() || seed.specialDistrict || null}
    )
    returning *
  `;

  await seedZoningWorksheetContent(reportId);

  return getZoningWorksheet(row.id);
}

export async function getOrCreateZoningReport(input: UpsertZoningReportInput = {}) {
  const organizationId = await getActiveOrganizationId();

  if (input.reportId) {
    const [row] = await sql<ZoningReportRow[]>`
      select *
      from zoning_reports
      where id = ${input.reportId}
        and organization_id = ${organizationId}
      limit 1
    `;

    if (row) {
      return getZoningWorksheet(row.id);
    }
  }

  if (input.projectId) {
    const [row] = await sql<ZoningReportRow[]>`
      select *
      from zoning_reports
      where organization_id = ${organizationId}
        and project_id = ${input.projectId}
      order by updated_at desc
      limit 1
    `;

    if (row) {
      return getZoningWorksheet(row.id);
    }
  }

  return createZoningReport(input);
}

export async function getZoningWorksheet(reportId: string): Promise<ZoningWorksheet> {
  const organizationId = await getActiveOrganizationId();
  const reportRow = await assertReportAccess(reportId, organizationId);

  const [sectionRows, itemRows, manualFlagRows, referenceRows] = await Promise.all([
    sql<ZoningSectionRow[]>`
      select *
      from zoning_report_sections
      where report_id = ${reportId}
      order by sort_order asc
    `,
    sql<ZoningItemRow[]>`
      select *
      from zoning_report_items
      where report_id = ${reportId}
      order by created_at asc
    `,
    sql<ZoningManualFlagRow[]>`
      select *
      from zoning_manual_flags
      where report_id = ${reportId}
      order by created_at asc
    `,
    sql<ZoningReferenceRow[]>`
      select *
      from zoning_references
      where report_id = ${reportId}
      order by created_at asc
    `,
  ]);

  const itemsBySection = new Map<ZoningSectionKey, ZoningReportItem[]>();
  for (const row of itemRows) {
    const items = itemsBySection.get(row.section) ?? [];
    items.push({
      id: row.id,
      reportId: row.report_id,
      section: row.section,
      field: row.field,
      value: row.value ?? '',
      source: row.source ?? '',
      status: row.status,
      notes: row.notes ?? undefined,
      createdAt: row.created_at,
    });
    itemsBySection.set(row.section, items);
  }

  return {
    report: mapReport(reportRow),
    sections: sectionRows.map((row) => ({
      id: row.id,
      reportId: row.report_id,
      key: row.section_key,
      title: row.title,
      description: row.description ?? undefined,
      sortOrder: row.sort_order,
      items: itemsBySection.get(row.section_key) ?? [],
    })),
    manualFlags: manualFlagRows.map((row) => ({
      id: row.id,
      reportId: row.report_id,
      title: row.title,
      description: row.description,
      severity: row.severity,
      reference: row.reference ?? undefined,
    })),
    references: referenceRows.map((row) => ({
      id: row.id,
      reportId: row.report_id,
      label: row.label,
      source: row.source,
      url: row.url ?? undefined,
      notes: row.notes ?? undefined,
    })),
  };
}

export async function updateZoningReport(input: Required<Pick<UpsertZoningReportInput, 'reportId'>> & UpsertZoningReportInput) {
  const organizationId = await getActiveOrganizationId();
  await assertReportAccess(input.reportId, organizationId);

  const [row] = await sql<ZoningReportRow[]>`
    update zoning_reports
    set
      title = ${input.title?.trim() || 'Zoning Research Worksheet'},
      address = ${input.address?.trim() || ''},
      borough = ${input.borough?.trim() || ''},
      block = ${input.block?.trim() || ''},
      lot = ${input.lot?.trim() || ''},
      zoning_district = ${input.zoningDistrict?.trim() || ''},
      commercial_overlay = ${input.commercialOverlay?.trim() || null},
      special_district = ${input.specialDistrict?.trim() || null},
      updated_at = now()
    where id = ${input.reportId}
      and organization_id = ${organizationId}
    returning *
  `;

  return mapReport(row);
}

export async function updateZoningReportItem(input: {
  reportId: string;
  itemId: string;
  value: string;
  source: string;
  status: ZoningReportItem['status'];
  notes?: string;
}) {
  const organizationId = await getActiveOrganizationId();
  await assertReportAccess(input.reportId, organizationId);

  const [row] = await sql<ZoningItemRow[]>`
    update zoning_report_items
    set
      value = ${input.value.trim()},
      source = ${input.source.trim()},
      status = ${input.status},
      notes = ${input.notes?.trim() || null},
      updated_at = now()
    where id = ${input.itemId}
      and report_id = ${input.reportId}
    returning *
  `;

  if (!row) {
    throw new Error('Zoning report item not found.');
  }

  await sql`
    update zoning_reports
    set updated_at = now()
    where id = ${input.reportId}
  `;

  return {
    id: row.id,
    reportId: row.report_id,
    section: row.section,
    field: row.field,
    value: row.value ?? '',
    source: row.source ?? '',
    status: row.status,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  } satisfies ZoningReportItem;
}

async function seedZoningWorksheetContent(reportId: string) {
  for (const section of mockZoningWorksheet.sections) {
    await sql`
      insert into zoning_report_sections (
        id,
        report_id,
        section_key,
        title,
        description,
        sort_order
      ) values (
        ${`${reportId}:${section.key}`},
        ${reportId},
        ${section.key},
        ${section.title},
        ${section.description ?? null},
        ${section.sortOrder}
      )
      on conflict (id) do nothing
    `;

    for (const item of section.items) {
      await sql`
        insert into zoning_report_items (
          id,
          report_id,
          section,
          field,
          value,
          source,
          status,
          notes,
          created_at
        ) values (
          ${`${reportId}:${item.id}`},
          ${reportId},
          ${item.section},
          ${item.field},
          ${item.value},
          ${item.source},
          ${item.status},
          ${item.notes ?? null},
          now()
        )
        on conflict (id) do nothing
      `;
    }
  }

  for (const flag of mockZoningWorksheet.manualFlags) {
    await sql`
      insert into zoning_manual_flags (
        id,
        report_id,
        title,
        description,
        severity,
        reference
      ) values (
        ${`${reportId}:${flag.id}`},
        ${reportId},
        ${flag.title},
        ${flag.description},
        ${flag.severity},
        ${flag.reference ?? null}
      )
      on conflict (id) do nothing
    `;
  }

  for (const reference of mockZoningWorksheet.references) {
    await sql`
      insert into zoning_references (
        id,
        report_id,
        label,
        source,
        url,
        notes
      ) values (
        ${`${reportId}:${reference.id}`},
        ${reportId},
        ${reference.label},
        ${reference.source},
        ${reference.url ?? null},
        ${reference.notes ?? null}
      )
      on conflict (id) do nothing
    `;
  }
}
