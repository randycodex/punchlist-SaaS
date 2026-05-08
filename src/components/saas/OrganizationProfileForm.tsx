'use client';

import { useEffect, useState, useTransition } from 'react';
import { CreateOrganization } from '@clerk/nextjs';
import { isClerkClientConfigured } from '@/lib/auth/clerkConfig';
import { getSaaSSnapshot, type SaaSSnapshot, updateCurrentOrganization } from '@/lib/saas/api';
import type { Organization } from '@/lib/saas/types';

type Mode = 'onboarding' | 'settings';

type FormState = {
  name: string;
  firmType: NonNullable<Organization['firmType']>;
  reportTitle: string;
  reportFooter: string;
  primaryColor: string;
  showPreparedBy: boolean;
  defaultChecklistTemplateName: string;
  firstProjectName: string;
  inviteTeamMembers: string;
};

const emptyForm: FormState = {
  name: '',
  firmType: 'architecture',
  reportTitle: 'Field Inspection Report',
  reportFooter: '',
  primaryColor: '#ef4e24',
  showPreparedBy: true,
  defaultChecklistTemplateName: 'General punchlist',
  firstProjectName: '',
  inviteTeamMembers: '',
};

function getActiveOrganization(snapshot: SaaSSnapshot) {
  if (!snapshot.organizations.length) {
    return null;
  }

  return (
    snapshot.organizations.find((organization) => organization.id === snapshot.user.defaultOrganizationId) ??
    snapshot.organizations[0]
  );
}

function buildFormState(snapshot: SaaSSnapshot): FormState {
  const organization = getActiveOrganization(snapshot);

  if (!organization) {
    return emptyForm;
  }

  return {
    name: organization.name,
    firmType: organization.firmType ?? 'architecture',
    reportTitle: organization.branding?.reportTitle ?? 'Field Inspection Report',
    reportFooter: organization.branding?.reportFooter ?? '',
    primaryColor: organization.branding?.primaryColor ?? '#ef4e24',
    showPreparedBy: organization.branding?.showPreparedBy ?? true,
    defaultChecklistTemplateName: organization.defaultChecklistTemplateName ?? 'General punchlist',
    firstProjectName: '',
    inviteTeamMembers: '',
  };
}

export default function OrganizationProfileForm({ mode }: { mode: Mode }) {
  const [snapshot, setSnapshot] = useState<SaaSSnapshot | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let isActive = true;

    async function loadSnapshot() {
      try {
        const nextSnapshot = await getSaaSSnapshot();
        if (!isActive) return;
        setSnapshot(nextSnapshot);
        setForm(buildFormState(nextSnapshot));
        setError(null);
      } catch (loadError) {
        if (!isActive) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load organization profile.');
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    void loadSnapshot();

    return () => {
      isActive = false;
    };
  }, []);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        const organization = await updateCurrentOrganization({
          name: form.name.trim(),
          firmType: form.firmType,
          reportTitle: form.reportTitle.trim(),
          reportFooter: form.reportFooter.trim(),
          primaryColor: form.primaryColor.trim(),
          showPreparedBy: form.showPreparedBy,
          defaultChecklistTemplateName: form.defaultChecklistTemplateName.trim(),
        });

        setSnapshot((current) => {
          if (!current) return current;
          return {
            ...current,
            organizations: current.organizations.map((item) => (item.id === organization.id ? organization : item)),
          };
        });
        setSuccess(mode === 'onboarding' ? 'Organization defaults saved.' : 'Firm settings updated.');
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Unable to save organization profile.');
      }
    });
  }

  if (!isClerkClientConfigured) {
    return (
      <div className="rounded-md border border-dashed border-black/20 bg-black/[0.02] p-5 text-sm text-gray-600 dark:border-white/15 dark:bg-white/[0.03] dark:text-gray-300">
        Clerk is not configured in this environment, so organization persistence is unavailable.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[16rem] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/10 border-t-gray-900 dark:border-white/10 dark:border-t-white" />
      </div>
    );
  }

  if (error && !snapshot) {
    return <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }

  const activeOrganization = snapshot ? getActiveOrganization(snapshot) : null;

  if (!activeOrganization) {
    return (
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-md border border-dashed border-black/20 bg-black/[0.02] p-5 text-sm text-gray-600 dark:border-white/15 dark:bg-white/[0.03] dark:text-gray-300">
          Create your first firm workspace in Clerk, then return here to save the organization defaults in Neon.
        </div>
        <div className="rounded-md border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
          <CreateOrganization
            routing="hash"
            afterCreateOrganizationUrl="/app/onboarding"
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

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-medium text-gray-700 dark:text-gray-200">
          Firm name
          <input
            className="w-full rounded-md border border-black/10 bg-white px-3 py-2.5 text-sm text-gray-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
            value={form.name}
            onChange={(event) => updateField('name', event.target.value)}
            placeholder="Northline Architects"
          />
        </label>
        <label className="space-y-2 text-sm font-medium text-gray-700 dark:text-gray-200">
          Firm type
          <select
            className="w-full rounded-md border border-black/10 bg-white px-3 py-2.5 text-sm text-gray-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
            value={form.firmType}
            onChange={(event) => updateField('firmType', event.target.value as FormState['firmType'])}
          >
            <option value="architecture">Architecture firm</option>
            <option value="construction">Construction team</option>
            <option value="owner">Owner representative</option>
            <option value="consultant">Consultant</option>
            <option value="developer">Developer</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium text-gray-700 dark:text-gray-200">
          Default report title
          <input
            className="w-full rounded-md border border-black/10 bg-white px-3 py-2.5 text-sm text-gray-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
            value={form.reportTitle}
            onChange={(event) => updateField('reportTitle', event.target.value)}
            placeholder="Field Inspection Report"
          />
        </label>
        <label className="space-y-2 text-sm font-medium text-gray-700 dark:text-gray-200">
          Default checklist
          <select
            className="w-full rounded-md border border-black/10 bg-white px-3 py-2.5 text-sm text-gray-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
            value={form.defaultChecklistTemplateName}
            onChange={(event) => updateField('defaultChecklistTemplateName', event.target.value)}
          >
            <option>General punchlist</option>
            <option>Architectural closeout</option>
            <option>Facade inspection</option>
            <option>Residential unit turnover</option>
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium text-gray-700 dark:text-gray-200">
          Report footer
          <input
            className="w-full rounded-md border border-black/10 bg-white px-3 py-2.5 text-sm text-gray-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
            value={form.reportFooter}
            onChange={(event) => updateField('reportFooter', event.target.value)}
            placeholder="Prepared for project closeout review"
          />
        </label>
        <label className="space-y-2 text-sm font-medium text-gray-700 dark:text-gray-200">
          Primary brand color
          <div className="flex gap-3">
            <input
              type="color"
              className="h-11 w-14 rounded-md border border-black/10 bg-white p-1 dark:border-white/10 dark:bg-zinc-900"
              value={form.primaryColor}
              onChange={(event) => updateField('primaryColor', event.target.value)}
            />
            <input
              className="flex-1 rounded-md border border-black/10 bg-white px-3 py-2.5 text-sm text-gray-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
              value={form.primaryColor}
              onChange={(event) => updateField('primaryColor', event.target.value)}
              placeholder="#ef4e24"
            />
          </div>
        </label>
      </div>

      <label className="flex items-center gap-3 rounded-md border border-black/10 bg-white px-3 py-3 text-sm text-gray-700 dark:border-white/10 dark:bg-zinc-900 dark:text-gray-200">
        <input
          type="checkbox"
          checked={form.showPreparedBy}
          onChange={(event) => updateField('showPreparedBy', event.target.checked)}
        />
        Include preparer attribution in reports
      </label>

      {mode === 'onboarding' ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-medium text-gray-700 dark:text-gray-200">
            Create first project
            <input
              className="w-full rounded-md border border-black/10 bg-white px-3 py-2.5 text-sm text-gray-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
              value={form.firstProjectName}
              onChange={(event) => updateField('firstProjectName', event.target.value)}
              placeholder="Project name"
            />
          </label>
          <label className="space-y-2 text-sm font-medium text-gray-700 dark:text-gray-200">
            Invite team members
            <input
              className="w-full rounded-md border border-black/10 bg-white px-3 py-2.5 text-sm text-gray-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
              value={form.inviteTeamMembers}
              onChange={(event) => updateField('inviteTeamMembers', event.target.value)}
              placeholder="name@firm.com, name@client.com"
            />
          </label>
          <div className="sm:col-span-2 rounded-md border border-dashed border-black/20 bg-black/[0.02] p-4 text-sm text-gray-600 dark:border-white/15 dark:bg-white/[0.03] dark:text-gray-300">
            First project creation and team invitations remain placeholder fields in this phase. The firm profile itself now saves to Neon.
          </div>
        </div>
      ) : null}

      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div> : null}

      <button
        type="submit"
        disabled={isPending || !form.name.trim()}
        className="rounded-md bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-gray-900"
      >
        {isPending ? 'Saving...' : mode === 'onboarding' ? 'Save organization defaults' : 'Save firm settings'}
      </button>
    </form>
  );
}
