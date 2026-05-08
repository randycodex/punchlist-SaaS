import SettingsNav from '@/components/saas/SettingsNav';

const templates = ['General punchlist', 'Architectural closeout', 'Facade inspection', 'Residential unit turnover'];

export default function ChecklistSettingsPage() {
  return (
    <main className="h-full overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl pb-12">
        <SettingsNav />
        <section className="mt-6 rounded-lg border border-black/10 bg-white/80 p-5 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Checklists</p>
          <h1 className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">Default inspection templates</h1>
          <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
            Placeholder for organization-level checklist management and future template import tools.
          </p>
          <div className="mt-6 grid gap-3">
            {templates.map((template) => (
              <div key={template} className="rounded-md border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold text-gray-900 dark:text-white">{template}</span>
                  <span className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-white/[0.08] dark:text-gray-300">System</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
