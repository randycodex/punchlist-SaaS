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
  zrSection?: string;
  itemDescription?: string;
  permittedRequired?: string;
  proposed?: string;
  result?: ZoningReportItem['result'];
  evaluationMode?: ZoningReportItem['evaluationMode'];
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

const allowedResults: NonNullable<ZoningReportItem['result']>[] = [
  'complies',
  'does_not_comply',
  'incomplete',
  'manual_review_required',
];

const allowedEvaluationModes: NonNullable<ZoningReportItem['evaluationMode']>[] = [
  'lookup_only',
  'manual_input',
  'formula_check',
  'manual_review',
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

  if (body.result && !allowedResults.includes(body.result)) {
    return NextResponse.json({ error: 'Valid compliance result is required.' }, { status: 400 });
  }

  if (body.evaluationMode && !allowedEvaluationModes.includes(body.evaluationMode)) {
    return NextResponse.json({ error: 'Valid evaluation mode is required.' }, { status: 400 });
  }

  try {
    const item = await updateZoningReportItem({
      reportId,
      itemId,
      value: body.value ?? '',
      zrSection: body.zrSection,
      itemDescription: body.itemDescription,
      permittedRequired: body.permittedRequired,
      proposed: body.proposed,
      result: body.result,
      evaluationMode: body.evaluationMode,
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
