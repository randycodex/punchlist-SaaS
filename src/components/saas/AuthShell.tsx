import Link from 'next/link';
import PublicNav from '@/components/saas/PublicNav';

export default function AuthShell({
  mode,
  children,
}: {
  mode: 'login' | 'signup';
  children: React.ReactNode;
}) {
  const isSignup = mode === 'signup';

  return (
    <main className="min-h-screen bg-[#f7f3ea] text-[#161a1d]">
      <PublicNav />
      <section className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-5 pb-16 pt-28 lg:grid-cols-[1fr_0.9fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#9b3418]">Commercial field inspections</p>
          <h1 className="mt-5 max-w-xl text-4xl font-semibold leading-tight sm:text-5xl">
            {isSignup ? 'Create a firm workspace for punchlists and reports.' : 'Return to your projects, issues, and field reports.'}
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-[#596167]">
            Placeholder authentication for phase 1. This screen is structured for future provider login, organization setup, and subscription checks.
          </p>
        </div>
        <section className="rounded-lg border border-black/10 bg-white p-6 shadow-sm">
          {children}
          <p className="mt-6 text-center text-sm text-[#596167]">
            {isSignup ? 'Already have an account?' : 'New to Punchlist?'}{' '}
            <Link href={isSignup ? '/login' : '/signup'} className="font-semibold text-[#9b3418]">
              {isSignup ? 'Log in' : 'Create an account'}
            </Link>
          </p>
        </section>
      </section>
    </main>
  );
}
