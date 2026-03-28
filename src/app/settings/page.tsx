'use client';

import Link from 'next/link';
import { ChevronRight, ChevronLeft, RefreshCw } from 'lucide-react';
import { useAppSettings, type DefaultItemState, type QuickSortOption } from '@/contexts/AppSettingsContext';
import { useMicrosoftAuth } from '@/contexts/MicrosoftAuthContext';
import { useTheme } from '@/contexts/ThemeContext';

function SettingRow({
  label,
  value,
  action,
}: {
  label: string;
  value?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 rounded-2xl bg-black/[0.02] px-4 py-3 dark:bg-white/[0.03]">
      <div className="text-sm font-medium text-gray-900 dark:text-white">{label}</div>
      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
        {value}
        {action}
      </div>
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            value === option.value
              ? 'bg-[var(--accent)] text-white'
              : 'bg-black/[0.04] text-gray-600 hover:bg-black/[0.07] dark:bg-white/[0.05] dark:text-gray-300 dark:hover:bg-white/[0.08]'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
        checked ? 'bg-[var(--accent)]' : 'bg-gray-300 dark:bg-zinc-700'
      }`}
      aria-pressed={checked}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white transition ${checked ? 'translate-x-6' : 'translate-x-1'}`}
      />
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.28em] text-gray-500 dark:text-gray-400">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const {
    profileName,
    profileInitials,
    saveCopyToPhotos,
    quickSort,
    defaultItemState,
    lastSyncAt,
    setProfileName,
    setProfileInitials,
    setSaveCopyToPhotos,
    setQuickSort,
    setDefaultItemState,
  } = useAppSettings();
  const { isSignedIn, signIn, signOut } = useMicrosoftAuth();
  const { themeMode, setThemeMode } = useTheme();

  return (
    <main className="app-page h-full overflow-y-auto overscroll-y-contain">
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 pb-10 sm:px-5">
        <header className="header-stable -mx-4 mb-4 shrink-0 border-b z-20 sm:-mx-5">
          <div className="mx-auto flex h-[4.75rem] w-full max-w-3xl items-center px-4 py-3 sm:px-5">
            <div className="flex w-full items-center gap-3">
            <Link
              href="/"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/[0.04] text-gray-600 transition hover:bg-black/[0.06] dark:bg-white/[0.05] dark:text-gray-300 dark:hover:bg-white/[0.08]"
              aria-label="Back"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold tracking-[-0.01em] text-gray-900 dark:text-white">Settings</h1>
            </div>
          </div>
          </div>
        </header>

        <div className="space-y-6">
          <Section title="Profile / Account">
            <SettingRow
              label="Name"
              action={
                <input
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                  className="w-36 rounded-xl bg-transparent px-2 py-1 text-right text-sm text-gray-700 outline-none dark:text-gray-200"
                />
              }
            />
            <SettingRow
              label="Initials"
              action={
                <input
                  value={profileInitials}
                  onChange={(event) => setProfileInitials(event.target.value.slice(0, 3).toUpperCase())}
                  className="w-14 rounded-xl bg-transparent px-2 py-1 text-right text-sm text-gray-700 outline-none dark:text-gray-200"
                />
              }
            />
            <SettingRow
              label={isSignedIn ? 'Sign out' : 'Sign in'}
              action={
                <button
                  onClick={() => void (isSignedIn ? signOut() : signIn())}
                  className="rounded-full bg-black/[0.05] px-3 py-1.5 text-sm font-medium text-gray-700 dark:bg-white/[0.06] dark:text-gray-200"
                >
                  {isSignedIn ? 'Disconnect' : 'Connect'}
                </button>
              }
            />
          </Section>

          <Section title="Camera & Photos">
            <SettingRow label="Save copy to Photos" action={<Toggle checked={saveCopyToPhotos} onChange={setSaveCopyToPhotos} />} />
          </Section>

          <Section title="Inspection">
            <SettingRow
              label="Default sort"
              action={<Segmented<QuickSortOption> value={quickSort} onChange={setQuickSort} options={[{ value: 'issues', label: 'Issues first' }, { value: 'alphabetical', label: 'Alphabetical' }, { value: 'progress', label: 'Progress' }]} />}
            />
            <SettingRow
              label="Default item state"
              action={<Segmented<DefaultItemState> value={defaultItemState} onChange={setDefaultItemState} options={[{ value: 'pending', label: 'Pending' }, { value: 'ok', label: 'OK' }]} />}
            />
            <div className="px-1 text-sm text-gray-500 dark:text-gray-400">
              Pending means an item still needs review. OK means reviewed items default to accepted unless you flag an issue.
            </div>
          </Section>

          <Section title="Display">
            <SettingRow
              label="Theme"
              action={<Segmented<typeof themeMode> value={themeMode} onChange={setThemeMode} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'system', label: 'System' }]} />}
            />
          </Section>

          <Section title="Sync">
            <SettingRow label="Last sync" value={lastSyncAt ? new Date(lastSyncAt).toLocaleString() : 'No sync yet'} />
            <SettingRow
              label="Manual sync"
              action={
                <button className="inline-flex items-center gap-2 rounded-full bg-black/[0.05] px-3 py-1.5 text-sm font-medium text-gray-700 dark:bg-white/[0.06] dark:text-gray-200">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Sync now
                </button>
              }
            />
          </Section>
        </div>
      </div>
    </main>
  );
}
