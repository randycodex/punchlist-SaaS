import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { updateZoningReportItem } from '@/lib/server/zoning-reports';
import type { ZoningReportItem } from '@/lib/zoning/types';

type RouteContext = {
  params: Promise<{
    reportId: string;
    itemId: string;
  }>;
};

type UpdateItemBody = {
  value?: string;
  source?: string;
  status?: ZoningReportItem['status'];
  notes?: string;
};

const allowedStatuses: ZoningReportItem['status'][] = [
  'auto_filled',
  'calculated',
  'guidance',
  'manual_review_required',
];

export async function PUT(request: Request, context: RouteContext) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const { reportId, itemId } = await context.params;
  const body = (await request.json()) as UpdateItemBody;

  if (!body.status || !allowedStatuses.includes(body.status)) {
    return NextResponse.json({ error: 'Valid status is required.' }, { status: 400 });
  }

  try {
    const item = await updateZoningReportItem({
      reportId,
      itemId,
      value: body.value ?? '',
      source: body.source ?? '',
      status: body.status,
      notes: body.notes,
    });
    return NextResponse.json(item);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update zoning item.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
