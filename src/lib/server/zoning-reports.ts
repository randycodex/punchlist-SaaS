import 'server-only';

import { auth } from '@clerk/nextjs/server';
import { randomUUID } from 'node:crypto';
import { ensureSaaSSchema } from '@/lib/server/saas-schema';
import { syncClerkState } from '@/lib/server/saas-sync';
import { sql } from '@/lib/server/neon';
import { lookupNYCParcelZoningFacts, type NYCParcelZoningFacts } from '@/lib/server/nyc-zoning-data';
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
  bbl: string | null;
  zip_code: string | null;
  zoning_district: string | null;
  commercial_overlay: string | null;
  special_district: string | null;
  zoning_map: string | null;
  open_data: NYCParcelZoningFacts | null;
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
  zr_section: string | null;
  item_description: string | null;
  permitted_required: string | null;
  proposed: string | null;
  result: ZoningReportItem['result'] | null;
  evaluation_mode: ZoningReportItem['evaluationMode'] | null;
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
  bbl?: string;
  zipCode?: string;
  zoningDistrict?: string;
  commercialOverlay?: string;
  specialDistrict?: string;
  zoningMap?: string;
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
    bbl: row.bbl ?? undefined,
    zipCode: row.zip_code ?? undefined,
    zoningDistrict: row.zoning_district ?? '',
    commercialOverlay: row.commercial_overlay ?? undefined,
    specialDistrict: row.special_district ?? undefined,
    zoningMap: row.zoning_map ?? undefined,
    openData: row.open_data ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function hasMeaningfulOpenData(row: ZoningReportRow) {
  return Boolean(
    row.open_data &&
      Object.keys(row.open_data).length > 0 &&
      row.open_data.latitude &&
      row.open_data.longitude &&
      row.open_data.parcelGeometry,
  );
}

async function hydrateZoningReportIfNeeded(row: ZoningReportRow, organizationId: string) {
  if (row.bbl && row.zoning_district && row.zoning_map && hasMeaningfulOpenData(row)) {
    return row;
  }

  const lookedUp = await lookupNYCParcelZoningFacts({
    address: row.address ?? undefined,
    borough: row.borough ?? undefined,
    bbl: row.bbl ?? undefined,
    zipCode: row.zip_code ?? undefined,
  });

  if (!lookedUp.bbl && !lookedUp.zoningDistrict && !lookedUp.zoningMap) {
    return row;
  }

  const [updated] = await sql<ZoningReportRow[]>`
    update zoning_reports
    set
      address = coalesce(nullif(address, ''), ${lookedUp.address ?? null}),
      borough = coalesce(nullif(borough, ''), ${lookedUp.borough ?? null}),
      block = coalesce(nullif(block, ''), ${lookedUp.block ?? null}),
      lot = coalesce(nullif(lot, ''), ${lookedUp.lot ?? null}),
      bbl = coalesce(bbl, ${lookedUp.bbl ?? null}),
      zip_code = coalesce(zip_code, ${lookedUp.zipCode ?? null}),
      zoning_district = coalesce(nullif(zoning_district, ''), ${lookedUp.zoningDistrict ?? null}),
      commercial_overlay = coalesce(commercial_overlay, ${lookedUp.commercialOverlay ?? null}),
      special_district = coalesce(special_district, ${lookedUp.specialDistrict ?? null}),
      zoning_map = coalesce(zoning_map, ${lookedUp.zoningMap ?? null}),
      open_data = ${sql.json({ ...(row.open_data ?? {}), ...lookedUp })},
      updated_at = now()
    where id = ${row.id}
      and organization_id = ${organizationId}
    returning *
  `;

  const hydrated = updated ?? row;
  await syncObjectiveZoningItems(hydrated.id, mapReport(hydrated));
  return hydrated;
}

function reportValue(report: ZoningReport, key: string) {
  const openData = report.openData ?? {};
  const value = openData[key];
  if (Array.isArray(value)) return value.join(' / ');
  return typeof value === 'string' ? value : '';
}

function objectiveItemValues(report: ZoningReport) {
  const district = [report.zoningDistrict, report.commercialOverlay].filter(Boolean).join(' / ');
  const specialDistrict = report.specialDistrict ? ` / Special District ${report.specialDistrict}` : '';
  const blockLot = [report.block ? `Block ${report.block}` : '', report.lot ? `Lot ${report.lot}` : '']
    .filter(Boolean)
    .join(', ');
  const addressParts = [report.address, report.zipCode].filter(Boolean).join(', ');
  const transitNote = reportValue(report, 'communityDistrict')
    ? `Community District ${reportValue(report, 'communityDistrict')}; verify Transit Zone applicability against ZR Appendix I.`
    : '';

  return [
    {
      itemId: 'address',
      permittedRequired: addressParts,
      source: 'NYC GeoSearch / PLUTO',
      status: 'auto_filled' as const,
      notes: report.openData?.sourceVersion ? `PLUTO ${report.openData.sourceVersion}` : '',
    },
    {
      itemId: 'block-lot',
      permittedRequired: blockLot,
      source: 'NYC GeoSearch / Zoning Tax Lot Database',
      status: 'auto_filled' as const,
      notes: report.bbl ? `BBL ${report.bbl}` : '',
    },
    {
      itemId: 'zoning-district',
      permittedRequired: `${district || report.zoningDistrict}${specialDistrict}`,
      source: 'NYC Zoning Tax Lot Database / PLUTO',
      status: 'auto_filled' as const,
      notes: reportValue(report, 'zoningDistricts') ? `Districts: ${reportValue(report, 'zoningDistricts')}` : '',
    },
    {
      itemId: 'zoning-map',
      permittedRequired: report.zoningMap ?? '',
      source: 'NYC Zoning Tax Lot Database / PLUTO',
      status: 'auto_filled' as const,
      notes: reportValue(report, 'zoningMapCode') ? `Map code: ${reportValue(report, 'zoningMapCode')}` : '',
    },
    {
      itemId: 'transit-designation',
      permittedRequired: transitNote,
      source: 'PLUTO community district / ZR Appendix I',
      status: 'manual_review_required' as const,
      notes: 'Open data can identify the community district; Transit Zone status still needs ZR Appendix confirmation.',
    },
    {
      itemId: 'lot-area',
      permittedRequired: reportValue(report, 'lotArea'),
      source: 'PLUTO',
      status: 'auto_filled' as const,
      notes: [reportValue(report, 'lotFront') ? `Frontage: ${reportValue(report, 'lotFront')}` : '', reportValue(report, 'lotDepth') ? `Depth: ${reportValue(report, 'lotDepth')}` : '']
        .filter(Boolean)
        .join('; '),
    },
  ].filter((item) => item.permittedRequired);
}

async function syncObjectiveZoningItems(reportId: string, report: ZoningReport) {
  for (const item of objectiveItemValues(report)) {
    await sql`
      update zoning_report_items
      set
        permitted_required = ${item.permittedRequired},
        source = ${item.source},
        status = ${item.status},
        notes = ${item.notes || null},
        evaluation_mode = 'lookup_only',
        updated_at = now()
      where id = ${`${reportId}:${item.itemId}`}
        and report_id = ${reportId}
    `;
  }
}

async function ensureZoningReportColumns() {
  await sql`alter table zoning_reports add column if not exists bbl text`.catch(() => undefined);
  await sql`alter table zoning_reports add column if not exists zip_code text`.catch(() => undefined);
  await sql`alter table zoning_reports add column if not exists zoning_map text`.catch(() => undefined);
  await sql`alter table zoning_reports add column if not exists open_data jsonb not null default '{}'::jsonb`.catch(() => undefined);
}

async function getActiveOrganizationId() {
  await ensureSaaSSchema();
  await ensureZoningReportColumns();
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

export async function deleteZoningReport(reportId: string): Promise<void> {
  const organizationId = await getActiveOrganizationId();

  const deleted = await sql<{ id: string }[]>`
    delete from zoning_reports
    where id = ${reportId}
      and organization_id = ${organizationId}
    returning id
  `;

  if (!deleted[0]) {
    throw new Error('Zoning report not found.');
  }
}

export async function createZoningReport(input: UpsertZoningReportInput = {}) {
  const organizationId = await getActiveOrganizationId();
  const reportId = input.reportId ?? randomUUID();
  const lookedUp = await lookupNYCParcelZoningFacts(input);

  let row: ZoningReportRow | undefined;
  try {
    [row] = await sql<ZoningReportRow[]>`
      insert into zoning_reports (
        id,
        organization_id,
        project_id,
        title,
        address,
        borough,
        block,
        lot,
        bbl,
        zip_code,
        zoning_district,
        commercial_overlay,
        special_district,
        zoning_map,
        open_data
      ) values (
        ${reportId},
        ${organizationId},
        ${input.projectId ?? null},
        ${input.title?.trim() || ''},
        ${input.address?.trim() || lookedUp.address || ''},
        ${input.borough?.trim() || lookedUp.borough || ''},
        ${input.block?.trim() || lookedUp.block || ''},
        ${input.lot?.trim() || lookedUp.lot || ''},
        ${input.bbl?.trim() || lookedUp.bbl || null},
        ${input.zipCode?.trim() || lookedUp.zipCode || null},
        ${input.zoningDistrict?.trim() || lookedUp.zoningDistrict || ''},
        ${input.commercialOverlay?.trim() || lookedUp.commercialOverlay || null},
        ${input.specialDistrict?.trim() || lookedUp.specialDistrict || null},
        ${input.zoningMap?.trim() || lookedUp.zoningMap || null},
        ${sql.json(lookedUp)}
      )
      returning *
    `;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (!message.includes('column "bbl"')) throw error;
    [row] = await sql<ZoningReportRow[]>`
      insert into zoning_reports (
        id,
        organization_id,
        project_id,
        title,
        address,
        borough,
        block,
        lot,
        zip_code,
        zoning_district,
        commercial_overlay,
        special_district,
        zoning_map,
        open_data
      ) values (
        ${reportId},
        ${organizationId},
        ${input.projectId ?? null},
        ${input.title?.trim() || ''},
        ${input.address?.trim() || lookedUp.address || ''},
        ${input.borough?.trim() || lookedUp.borough || ''},
        ${input.block?.trim() || lookedUp.block || ''},
        ${input.lot?.trim() || lookedUp.lot || ''},
        ${input.zipCode?.trim() || lookedUp.zipCode || null},
        ${input.zoningDistrict?.trim() || lookedUp.zoningDistrict || ''},
        ${input.commercialOverlay?.trim() || lookedUp.commercialOverlay || null},
        ${input.specialDistrict?.trim() || lookedUp.specialDistrict || null},
        ${input.zoningMap?.trim() || lookedUp.zoningMap || null},
        ${sql.json(lookedUp)}
      )
      returning *
    `;
  }

  await seedZoningWorksheetContent(reportId);
  await syncObjectiveZoningItems(reportId, mapReport(row));

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
  const reportRow = await hydrateZoningReportIfNeeded(await assertReportAccess(reportId, organizationId), organizationId);
  await syncObjectiveZoningItems(reportId, mapReport(reportRow));

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
      zrSection: row.zr_section ?? undefined,
      itemDescription: row.item_description ?? undefined,
      permittedRequired: row.permitted_required ?? row.value ?? '',
      proposed: row.proposed ?? undefined,
      result: row.result ?? undefined,
      evaluationMode: row.evaluation_mode ?? undefined,
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
  const lookedUp = await lookupNYCParcelZoningFacts(input);

  let row: ZoningReportRow | undefined;
  try {
    [row] = await sql<ZoningReportRow[]>`
      update zoning_reports
      set
        title = ${input.title?.trim() || 'Zoning Research Worksheet'},
        address = ${input.address?.trim() || ''},
        borough = ${input.borough?.trim() || lookedUp.borough || ''},
        block = ${input.block?.trim() || lookedUp.block || ''},
        lot = ${input.lot?.trim() || lookedUp.lot || ''},
        bbl = ${input.bbl?.trim() || lookedUp.bbl || null},
        zip_code = ${input.zipCode?.trim() || lookedUp.zipCode || null},
        zoning_district = ${input.zoningDistrict?.trim() || lookedUp.zoningDistrict || ''},
        commercial_overlay = ${input.commercialOverlay?.trim() || lookedUp.commercialOverlay || null},
        special_district = ${input.specialDistrict?.trim() || lookedUp.specialDistrict || null},
        zoning_map = ${input.zoningMap?.trim() || lookedUp.zoningMap || null},
        open_data = ${sql.json(lookedUp)},
        updated_at = now()
      where id = ${input.reportId}
        and organization_id = ${organizationId}
      returning *
    `;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (!message.includes('column "bbl"')) throw error;
    [row] = await sql<ZoningReportRow[]>`
      update zoning_reports
      set
        title = ${input.title?.trim() || 'Zoning Research Worksheet'},
        address = ${input.address?.trim() || ''},
        borough = ${input.borough?.trim() || lookedUp.borough || ''},
        block = ${input.block?.trim() || lookedUp.block || ''},
        lot = ${input.lot?.trim() || lookedUp.lot || ''},
        zip_code = ${input.zipCode?.trim() || lookedUp.zipCode || null},
        zoning_district = ${input.zoningDistrict?.trim() || lookedUp.zoningDistrict || ''},
        commercial_overlay = ${input.commercialOverlay?.trim() || lookedUp.commercialOverlay || null},
        special_district = ${input.specialDistrict?.trim() || lookedUp.specialDistrict || null},
        zoning_map = ${input.zoningMap?.trim() || lookedUp.zoningMap || null},
        open_data = ${sql.json(lookedUp)},
        updated_at = now()
      where id = ${input.reportId}
        and organization_id = ${organizationId}
      returning *
    `;
  }

  const report = mapReport(row);
  await syncObjectiveZoningItems(input.reportId, report);

  return report;
}

export async function updateZoningReportItem(input: {
  reportId: string;
  itemId: string;
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
}) {
  const organizationId = await getActiveOrganizationId();
  await assertReportAccess(input.reportId, organizationId);

  const [row] = await sql<ZoningItemRow[]>`
    update zoning_report_items
    set
      value = ${input.value.trim()},
      zr_section = ${input.zrSection?.trim() || null},
      item_description = ${input.itemDescription?.trim() || null},
      permitted_required = ${input.permittedRequired?.trim() || null},
      proposed = ${input.proposed?.trim() || null},
      result = ${input.result ?? null},
      evaluation_mode = ${input.evaluationMode ?? null},
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
    zrSection: row.zr_section ?? undefined,
    itemDescription: row.item_description ?? undefined,
    permittedRequired: row.permitted_required ?? row.value ?? '',
    proposed: row.proposed ?? undefined,
    result: row.result ?? undefined,
    evaluationMode: row.evaluation_mode ?? undefined,
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
          zr_section,
          item_description,
          permitted_required,
          proposed,
          result,
          evaluation_mode,
          source,
          status,
          notes,
          created_at
        ) values (
          ${`${reportId}:${item.id}`},
          ${reportId},
          ${item.section},
          ${item.field},
          ${''},
          ${null},
          ${item.itemDescription ?? item.field},
          ${''},
          ${''},
          ${null},
          ${item.evaluationMode ?? 'manual_input'},
          ${''},
          ${item.status},
          ${null},
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
