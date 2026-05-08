import SettingsNav from '@/components/saas/SettingsNav';

export default function BillingSettingsPage() {
  return (
    <main className="h-full overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl pb-12">
        <SettingsNav />
        <section className="mt-6 rounded-lg border border-black/10 bg-white/80 p-5 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Billing</p>
          <h1 className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">Subscription placeholder</h1>
          <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
            Stripe checkout, billing portal, entitlement checks, and invoice history are intentionally not implemented in phase 1.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {['Individual', 'Team', 'Firm / Enterprise'].map((tier) => (
              <div key={tier} className="rounded-md border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
                <p className="font-semibold text-gray-900 dark:text-white">{tier}</p>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">Plan definition placeholder.</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
