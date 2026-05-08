import SettingsNav from '@/components/saas/SettingsNav';

export default function TeamSettingsPage() {
  return (
    <main className="h-full overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl pb-12">
        <SettingsNav />
        <section className="mt-6 rounded-lg border border-black/10 bg-white/80 p-5 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Team</p>
          <h1 className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">Members and roles</h1>
          <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
            Placeholder for organization invitations, roles, project access, and membership management.
          </p>
          <div className="mt-6 rounded-md border border-dashed border-black/20 p-5 text-sm text-gray-600 dark:border-white/15 dark:text-gray-300">
            Future roles: owner, admin, manager, inspector, and client.
          </div>
        </section>
      </div>
    </main>
  );
}
