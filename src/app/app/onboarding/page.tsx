import Link from 'next/link';
import OrganizationOnboardingPanel from '@/components/saas/OrganizationOnboardingPanel';

export default function OnboardingPage() {
  return (
    <main className="h-full overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-4xl pb-12">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Firm setup</p>
          <h1 className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">Set up your organization</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
            Phase 1 placeholder for the future organization onboarding flow. These fields are not persisted yet.
          </p>
        </div>

        <section className="rounded-lg border border-black/10 bg-white/80 p-5 dark:border-white/10 dark:bg-white/[0.04]">
          <OrganizationOnboardingPanel />

          <div className="mt-5 rounded-md border border-dashed border-black/20 bg-black/[0.02] p-5 text-sm text-gray-600 dark:border-white/15 dark:bg-white/[0.03] dark:text-gray-300">
            Logo upload placeholder. Future implementation should store logo assets in organization-scoped object storage and apply them to reports.
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/app" className="rounded-md bg-gray-900 px-4 py-2.5 text-center text-sm font-semibold text-white dark:bg-white dark:text-gray-900">
              Continue to app
            </Link>
            <Link href="/app/settings/firm" className="rounded-md border border-black/10 px-4 py-2.5 text-center text-sm font-semibold text-gray-800 dark:border-white/10 dark:text-gray-100">
              Open firm settings
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
