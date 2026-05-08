import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { updateCurrentOrganization } from '@/lib/server/saas-sync';
import type { Organization } from '@/lib/saas/types';

type RequestBody = {
  name?: string;
  firmType?: Organization['firmType'];
  reportTitle?: string;
  reportFooter?: string;
  primaryColor?: string;
  showPreparedBy?: boolean;
  defaultChecklistTemplateName?: string;
};

export async function PUT(request: Request) {
  const { userId, orgId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  if (!orgId) {
    return NextResponse.json({ error: 'Select or create an organization first.' }, { status: 409 });
  }

  const body = (await request.json()) as RequestBody;

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Organization name is required.' }, { status: 400 });
  }

  try {
    const organization = await updateCurrentOrganization({
      name: body.name.trim(),
      firmType: body.firmType,
      reportTitle: body.reportTitle?.trim() || undefined,
      reportFooter: body.reportFooter?.trim() || undefined,
      primaryColor: body.primaryColor?.trim() || undefined,
      showPreparedBy: body.showPreparedBy,
      defaultChecklistTemplateName: body.defaultChecklistTemplateName?.trim() || undefined,
    });

    return NextResponse.json(organization);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update organization.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
