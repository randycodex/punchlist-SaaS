import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createZoningReport, listZoningReports } from '@/lib/server/zoning-reports';

type CreateReportBody = {
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

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  try {
    const reports = await listZoningReports();
    return NextResponse.json({ reports });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load zoning reports.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as CreateReportBody;
    const worksheet = await createZoningReport(body);
    return NextResponse.json(worksheet, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create zoning report.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
