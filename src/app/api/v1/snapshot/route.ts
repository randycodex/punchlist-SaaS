import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getCurrentSnapshot } from '@/lib/server/saas-sync';

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  try {
    const snapshot = await getCurrentSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load account snapshot.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
