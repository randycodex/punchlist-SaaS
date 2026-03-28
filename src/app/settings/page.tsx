'use client';

import Link from 'next/link';
import { ChevronRight, ChevronLeft, RefreshCw } from 'lucide-react';
import { useAppSettings, type CameraFacing, type CameraQuality, type DefaultItemState, type DensityMode, type QuickSortOption } from '@/contexts/AppSettingsContext';
import { useMicrosoftAuth } from '@/contexts/MicrosoftAuthContext';
import { useSyncStatus } from '@/contexts/SyncStatusContext';
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
    cameraQuality,
    autoSaveAfterCapture,
    defaultCamera,
    quickSort,
    defaultItemState,
    autoExpandNextItem,
    density,
    confirmBeforeDelete,
    lastSyncAt,
    setProfileName,
    setProfileInitials,
    setCameraQuality,
    setAutoSaveAfterCapture,
    setDefaultCamera,
    setQuickSort,
    setDefaultItemState,
    setAutoExpandNextItem,
    setDensity,
    setConfirmBeforeDelete,
  } = useAppSettings();
  const { isSignedIn, signIn, signOut } = useMicrosoftAuth();
  const { status } = useSyncStatus();
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
            <SettingRow label="Connected account" value={isSignedIn ? 'OneDrive connected' : 'Not connected'} />
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
            <SettingRow
              label="Image quality"
              action={<Segmented<CameraQuality> value={cameraQuality} onChange={setCameraQuality} options={[{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }]} />}
            />
            <SettingRow label="Auto-save after capture" action={<Toggle checked={autoSaveAfterCapture} onChange={setAutoSaveAfterCapture} />} />
            <SettingRow
              label="Default camera"
              action={<Segmented<CameraFacing> value={defaultCamera} onChange={setDefaultCamera} options={[{ value: 'rear', label: 'Rear' }, { value: 'front', label: 'Front' }]} />}
            />
          </Section>

          <Section title="Inspection">
            <SettingRow
              label="Default sort"
              action={<Segmented<QuickSortOption> value={quickSort} onChange={setQuickSort} options={[{ value: 'default', label: 'Default' }, { value: 'issues', label: 'Issues first' }, { value: 'alphabetical', label: 'Alphabetical' }]} />}
            />
            <SettingRow
              label="Default item state"
              action={<Segmented<DefaultItemState> value={defaultItemState} onChange={setDefaultItemState} options={[{ value: 'pending', label: 'Pending' }, { value: 'ok', label: 'OK' }]} />}
            />
            <SettingRow label="Auto-expand next item" action={<Toggle checked={autoExpandNextItem} onChange={setAutoExpandNextItem} />} />
          </Section>

          <Section title="Display">
            <SettingRow
              label="Theme"
              action={<Segmented<typeof themeMode> value={themeMode} onChange={setThemeMode} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'system', label: 'System' }]} />}
            />
            <SettingRow
              label="Density"
              action={<Segmented<DensityMode> value={density} onChange={setDensity} options={[{ value: 'compact', label: 'Compact' }, { value: 'comfortable', label: 'Comfortable' }]} />}
            />
          </Section>

          <Section title="Sync & Backup">
            <SettingRow label="Sync status" value={status} />
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
            <SettingRow
              label="Backup now"
              action={<button className="rounded-full bg-black/[0.05] px-3 py-1.5 text-sm font-medium text-gray-700 dark:bg-white/[0.06] dark:text-gray-200">Backup</button>}
            />
          </Section>

          <Section title="Trash">
            <SettingRow label="Confirm before delete" action={<Toggle checked={confirmBeforeDelete} onChange={setConfirmBeforeDelete} />} />
            <div className="px-1 text-sm text-gray-500 dark:text-gray-400">Deleted projects remain in Trash for 30 days before permanent removal.</div>
          </Section>

          <Section title="About">
            <SettingRow label="App version" value="2.0" />
          </Section>
        </div>
      </div>
    </main>
  );
}
