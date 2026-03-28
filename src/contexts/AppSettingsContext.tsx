'use client';

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

export type QuickSortOption = 'default' | 'issues' | 'alphabetical';
export type CameraQuality = 'high' | 'medium' | 'low';
export type CameraFacing = 'rear' | 'front';
export type DensityMode = 'compact' | 'comfortable';
export type ExportLocation = 'local' | 'onedrive';
export type FilenameFormat = 'project-date' | 'project-only' | 'date-project';
export type DateFormat = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
export type DefaultItemState = 'pending' | 'ok';

type AppSettings = {
  showOnlyIssues: boolean;
  quickSort: QuickSortOption;
  profileName: string;
  profileInitials: string;
  cameraQuality: CameraQuality;
  autoSaveAfterCapture: boolean;
  defaultCamera: CameraFacing;
  defaultItemState: DefaultItemState;
  autoExpandNextItem: boolean;
  density: DensityMode;
  defaultExportLocation: ExportLocation;
  filenameFormat: FilenameFormat;
  dateFormat: DateFormat;
  confirmBeforeDelete: boolean;
  lastSyncAt: string | null;
};

type AppSettingsContextValue = AppSettings & {
  setShowOnlyIssues: (value: boolean) => void;
  setQuickSort: (value: QuickSortOption) => void;
  setProfileName: (value: string) => void;
  setProfileInitials: (value: string) => void;
  setCameraQuality: (value: CameraQuality) => void;
  setAutoSaveAfterCapture: (value: boolean) => void;
  setDefaultCamera: (value: CameraFacing) => void;
  setDefaultItemState: (value: DefaultItemState) => void;
  setAutoExpandNextItem: (value: boolean) => void;
  setDensity: (value: DensityMode) => void;
  setDefaultExportLocation: (value: ExportLocation) => void;
  setFilenameFormat: (value: FilenameFormat) => void;
  setDateFormat: (value: DateFormat) => void;
  setConfirmBeforeDelete: (value: boolean) => void;
  markSyncedNow: () => void;
};

const STORAGE_KEY = 'punchlist:app-settings';

const defaultSettings: AppSettings = {
  showOnlyIssues: false,
  quickSort: 'default',
  profileName: 'Inspector',
  profileInitials: 'IN',
  cameraQuality: 'high',
  autoSaveAfterCapture: true,
  defaultCamera: 'rear',
  defaultItemState: 'pending',
  autoExpandNextItem: false,
  density: 'comfortable',
  defaultExportLocation: 'local',
  filenameFormat: 'project-date',
  dateFormat: 'MM/DD/YYYY',
  confirmBeforeDelete: true,
  lastSyncAt: null,
};

const AppSettingsContext = createContext<AppSettingsContextValue | undefined>(undefined);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    if (typeof window === 'undefined') return defaultSettings;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultSettings;
      return { ...defaultSettings, ...JSON.parse(raw) } as AppSettings;
    } catch {
      return defaultSettings;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  useEffect(() => {
    document.documentElement.dataset.density = settings.density;
  }, [settings.density]);

  const value = useMemo<AppSettingsContextValue>(
    () => ({
      ...settings,
      setShowOnlyIssues: (showOnlyIssues) => setSettings((prev) => ({ ...prev, showOnlyIssues })),
      setQuickSort: (quickSort) => setSettings((prev) => ({ ...prev, quickSort })),
      setProfileName: (profileName) => setSettings((prev) => ({ ...prev, profileName })),
      setProfileInitials: (profileInitials) => setSettings((prev) => ({ ...prev, profileInitials })),
      setCameraQuality: (cameraQuality) => setSettings((prev) => ({ ...prev, cameraQuality })),
      setAutoSaveAfterCapture: (autoSaveAfterCapture) => setSettings((prev) => ({ ...prev, autoSaveAfterCapture })),
      setDefaultCamera: (defaultCamera) => setSettings((prev) => ({ ...prev, defaultCamera })),
      setDefaultItemState: (defaultItemState) => setSettings((prev) => ({ ...prev, defaultItemState })),
      setAutoExpandNextItem: (autoExpandNextItem) => setSettings((prev) => ({ ...prev, autoExpandNextItem })),
      setDensity: (density) => setSettings((prev) => ({ ...prev, density })),
      setDefaultExportLocation: (defaultExportLocation) => setSettings((prev) => ({ ...prev, defaultExportLocation })),
      setFilenameFormat: (filenameFormat) => setSettings((prev) => ({ ...prev, filenameFormat })),
      setDateFormat: (dateFormat) => setSettings((prev) => ({ ...prev, dateFormat })),
      setConfirmBeforeDelete: (confirmBeforeDelete) => setSettings((prev) => ({ ...prev, confirmBeforeDelete })),
      markSyncedNow: () =>
        setSettings((prev) => ({
          ...prev,
          lastSyncAt: new Date().toISOString(),
        })),
    }),
    [settings]
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);
  if (!context) {
    throw new Error('useAppSettings must be used within an AppSettingsProvider');
  }
  return context;
}
