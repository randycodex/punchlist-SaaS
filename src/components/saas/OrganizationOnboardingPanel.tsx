import { CreateOrganization } from '@clerk/nextjs';
import { isClerkConfigured } from '@/lib/auth/clerkConfig';

function PlaceholderOrganizationForm() {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <label className="space-y-2 text-sm font-medium text-gray-700 dark:text-gray-200">
        Firm name
        <input className="w-full rounded-md border border-black/10 bg-white px-3 py-2.5 text-sm text-gray-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white" placeholder="Northline Architects" />
      </label>
      <label className="space-y-2 text-sm font-medium text-gray-700 dark:text-gray-200">
        Firm type
        <select className="w-full rounded-md border border-black/10 bg-white px-3 py-2.5 text-sm text-gray-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white">
          <option>Architecture firm</option>
          <option>Construction team</option>
          <option>Owner representative</option>
          <option>Consultant</option>
          <option>Developer</option>
        </select>
      </label>
      <label className="space-y-2 text-sm font-medium text-gray-700 dark:text-gray-200">
        Default report title
        <input className="w-full rounded-md border border-black/10 bg-white px-3 py-2.5 text-sm text-gray-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white" placeholder="Field Inspection Report" />
      </label>
      <label className="space-y-2 text-sm font-medium text-gray-700 dark:text-gray-200">
        Default checklist
        <select className="w-full rounded-md border border-black/10 bg-white px-3 py-2.5 text-sm text-gray-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white">
          <option>General punchlist</option>
          <option>Architectural closeout</option>
          <option>Facade inspection</option>
          <option>Residential unit turnover</option>
        </select>
      </label>
      <label className="space-y-2 text-sm font-medium text-gray-700 dark:text-gray-200">
        Create first project
        <input className="w-full rounded-md border border-black/10 bg-white px-3 py-2.5 text-sm text-gray-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white" placeholder="Project name" />
      </label>
      <label className="space-y-2 text-sm font-medium text-gray-700 dark:text-gray-200">
        Invite team members
        <input className="w-full rounded-md border border-black/10 bg-white px-3 py-2.5 text-sm text-gray-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white" placeholder="name@firm.com, name@client.com" />
      </label>
    </div>
  );
}

export default function OrganizationOnboardingPanel() {
  if (!isClerkConfigured) {
    return <PlaceholderOrganizationForm />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-5">
        <PlaceholderOrganizationForm />
        <div className="rounded-md border border-dashed border-black/20 bg-black/[0.02] p-5 text-sm text-gray-600 dark:border-white/15 dark:bg-white/[0.03] dark:text-gray-300">
          Firm profile fields are UI-only until Neon-backed organization settings are added. Use the Clerk panel to create the default firm account now.
        </div>
      </div>
      <div className="rounded-md border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
        <CreateOrganization
          routing="hash"
          afterCreateOrganizationUrl="/app"
          appearance={{
            elements: {
              cardBox: 'shadow-none',
              card: 'shadow-none',
            },
          }}
        />
      </div>
    </div>
  );
}
