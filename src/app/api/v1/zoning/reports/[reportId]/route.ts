import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { deleteZoningReport, getOrCreateZoningReport, getZoningWorksheet, updateZoningReport } from '@/lib/server/zoning-reports';

type RouteContext = {
  params: Promise<{
    reportId: string;
  }>;
};

type UpdateReportBody = {
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

export async function GET(_request: Request, context: RouteContext) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const { reportId } = await context.params;

  try {
    const worksheet = reportId === 'new' ? await getOrCreateZoningReport() : await getZoningWorksheet(reportId);
    return NextResponse.json(worksheet);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load zoning report.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const { reportId } = await context.params;

  if (reportId === 'new') {
    return NextResponse.json({ error: 'Create a report before updating it.' }, { status: 400 });
  }

  try {
    const body = (await request.json()) as UpdateReportBody;
    const report = await updateZoningReport({ reportId, ...body });
    return NextResponse.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update zoning report.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const { reportId } = await context.params;

  if (reportId === 'new') {
    return NextResponse.json({ error: 'Invalid report id.' }, { status: 400 });
  }

  try {
    await deleteZoningReport(reportId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete zoning report.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
