'use client';

import { memo, useState, useEffect, useMemo, useRef, useCallback, type TouchEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Project, getAreaStats, getReviewMetrics } from '@/types';
import { getProject, saveProject, createArea } from '@/lib/db';
import { getMicrosoftErrorMessage } from '@/lib/microsoftErrors';
import AreaEditorModal from '@/components/AreaEditorModal';
import ProjectEditModal from '@/components/ProjectEditModal';
import { buildAreaName, getDefaultAreaFormValue, type AreaTypeKey } from '@/lib/areas';
import { applyTemplateToArea } from '@/lib/template';
import { pushProjectsToOneDrive, syncProjectsWithOneDrive } from '@/lib/oneDriveSync';
import { useMicrosoftAuth } from '@/contexts/MicrosoftAuthContext';
import { useSyncStatus } from '@/contexts/SyncStatusContext';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  Trash2,
  RotateCcw,
  Plus,
} from 'lucide-react';

type SortOption = 'name' | 'recent' | 'progress';

const SORT_STORAGE_KEY = 'punchlist-areas-sort';
const RECENT_AREA_TYPES_STORAGE_KEY = 'punchlist-recent-area-types';

type AreaMetrics = {
  stats: ReturnType<typeof getAreaStats>;
  pending: number;
  progress: number;
  okPercent: number;
  issuePercent: number;
  photoCount: number;
  commentCount: number;
};

type AreaCardProps = {
  projectId: string;
  area: Project['areas'][number];
  metric?: AreaMetrics;
  deleteMode: boolean;
  isSelected: boolean;
  onToggleSelection: (areaId: string) => void;
};

const AreaCard = memo(function AreaCard({
  projectId,
  area,
  metric,
  deleteMode,
  isSelected,
  onToggleSelection,
}: AreaCardProps) {
  const areaStats = metric?.stats ?? { total: 0, ok: 0, issues: 0 };
  const progress = metric?.progress ?? 0;
  const metricsLabel =
    areaStats.total > 0
      ? `${areaStats.total} items${areaStats.issues > 0 ? ` · ${areaStats.issues} issues` : ''}`
      : 'No items yet';
  return (
    <div
      onClick={() => {
        if (deleteMode) {
          onToggleSelection(area.id);
        }
      }}
      className={`block rounded-2xl border p-4 transition-colors ${
        isSelected
          ? 'bg-gray-200 border-gray-400 dark:bg-gray-700 dark:border-gray-500'
          : 'bg-white/90 dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-500'
      } ${deleteMode ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start gap-3">
        <Link
          href={deleteMode ? '#' : `/project/${projectId}/area/${area.id}`}
          onClick={(event) => {
            if (deleteMode) event.preventDefault();
          }}
          className="flex-1 min-w-0"
        >
          <div className="min-w-0">
            <div className="min-w-0 flex items-center gap-2">
              <h3 className="truncate text-[1.02rem] font-semibold tracking-[-0.01em] text-gray-900 dark:text-white">{area.name}</h3>
            </div>
            <div className={`mt-2 text-sm ${areaStats.issues > 0 ? 'text-red-600 dark:text-red-300' : 'text-gray-500 dark:text-gray-400'}`}>
              {metricsLabel}
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-zinc-700">
              <div
                className={`${areaStats.issues > 0 ? 'bg-red-500/80 dark:bg-red-400/80' : 'bg-gray-900 dark:bg-white'} h-full rounded-full transition-all`}
                style={{ width: `${Math.max(progress, 4)}%` }}
              />
            </div>
          </div>
        </Link>
        <Link
          href={deleteMode ? '#' : `/project/${projectId}/area/${area.id}`}
          onClick={(event) => {
            if (deleteMode) event.preventDefault();
          }}
          className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:text-gray-700 dark:bg-zinc-900 dark:text-gray-400 dark:hover:text-gray-200"
          aria-label={`Open ${area.name}`}
        >
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </Link>
      </div>
    </div>
  );
});

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddArea, setShowAddArea] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedAreaIds, setSelectedAreaIds] = useState<Set<string>>(new Set());
  const [newAreaForm, setNewAreaForm] = useState(getDefaultAreaFormValue());
  const [recentAreaTypeKeys, setRecentAreaTypeKeys] = useState<AreaTypeKey[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>('name');
  const [showTrash, setShowTrash] = useState(false);
  const [actionSheet, setActionSheet] = useState<'delete' | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backgroundSyncInFlightRef = useRef(false);
  const backgroundSyncQueuedRef = useRef(false);
  const dirtyProjectIdsRef = useRef<Set<string>>(new Set());
  const pullStartYRef = useRef<number | null>(null);
  const pullDistanceRef = useRef(0);
  const pullArmedRef = useRef(false);
  const listRef = useRef<HTMLElement | null>(null);
  const { ensureAccessToken } = useMicrosoftAuth();
  const { setStatus: setSyncStatus } = useSyncStatus();

  useEffect(() => {
    if (!id) {
      router.push('/');
      return;
    }
    // Load saved sort preference
    const savedSort = localStorage.getItem(SORT_STORAGE_KEY) as SortOption;
    if (savedSort && ['name', 'recent', 'progress'].includes(savedSort)) {
      setSortOption(savedSort);
    }
    const savedRecentAreaTypes = localStorage.getItem(RECENT_AREA_TYPES_STORAGE_KEY);
    if (savedRecentAreaTypes) {
      try {
        setRecentAreaTypeKeys(JSON.parse(savedRecentAreaTypes) as AreaTypeKey[]);
      } catch (error) {
        console.error('Failed to parse recent area types:', error);
      }
    }
    loadProject();
  }, [id]);

  useEffect(() => {
    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
      backgroundSyncInFlightRef.current = false;
      backgroundSyncQueuedRef.current = false;
    };
  }, []);

  function handleSortChange(option: SortOption) {
    setSortOption(option);
    localStorage.setItem(SORT_STORAGE_KEY, option);
  }

  async function handleEditProject(updates: Partial<Project>) {
    if (!editingProject) return;
    Object.assign(editingProject, updates);
    await saveProject(editingProject);
    scheduleSync(editingProject.id);
    setEditingProject(null);
    await loadProject();
  }

  async function loadProject() {
    if (!id) return;
    try {
      const data = await getProject(id);
      if (data) {
        if (data.deletedAt) {
          router.push('/');
          return;
        }
        setProject(data);
      } else {
        router.push('/');
      }
    } catch (error) {
      console.error('Failed to load project:', error);
      router.push('/');
    } finally {
      setLoading(false);
    }
  }

  const activeAreas = useMemo(
    () => (project ? project.areas.filter((area) => !area.deletedAt) : []),
    [project]
  );

  const trashedAreas = useMemo(
    () =>
      project
        ? [...project.areas.filter((area) => area.deletedAt)].sort(
            (a, b) => (b.deletedAt?.getTime() ?? 0) - (a.deletedAt?.getTime() ?? 0)
          )
        : [],
    [project]
  );

  const areaMetrics = useMemo(() => {
    const metrics = new Map<string, AreaMetrics>();
    if (!project) return metrics;

    for (const area of activeAreas) {
      let photoCount = 0;
      let commentCount = 0;
      for (const location of area.locations) {
        for (const item of location.items) {
          for (const checkpoint of item.checkpoints) {
            photoCount += checkpoint.photos.length;
            if (checkpoint.comments.trim()) commentCount += 1;
          }
        }
      }
      const stats = getAreaStats(area);
      const reviewMetrics = getReviewMetrics(stats.total, stats.ok, stats.issues);
      metrics.set(area.id, {
        stats,
        pending: reviewMetrics.pending,
        progress: reviewMetrics.reviewedPercent,
        okPercent: reviewMetrics.okPercent,
        issuePercent: reviewMetrics.issuePercent,
        photoCount,
        commentCount,
      });
    }

    return metrics;
  }, [project, activeAreas]);

  const sortedAreas = useMemo(() => {
    return [...activeAreas].sort((a, b) => {
      if (sortOption === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortOption === 'recent') {
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      }
      const progressA = areaMetrics.get(a.id)?.progress ?? 0;
      const progressB = areaMetrics.get(b.id)?.progress ?? 0;
      return progressB - progressA;
    });
  }, [activeAreas, sortOption, areaMetrics]);

  async function handleAddArea() {
    if (!project) return;

    const areaName = buildAreaName(newAreaForm);
    if (!areaName) return;

    const area = createArea(project.id, areaName, project.areas.length, {
      areaTypeKey: newAreaForm.areaTypeKey,
      unitType: newAreaForm.unitType,
      customAreaName: newAreaForm.customAreaName,
      areaNumber: newAreaForm.areaNumber,
    });
    area.areaTypeKey = newAreaForm.areaTypeKey;
    area.unitType = newAreaForm.unitType || undefined;
    area.customAreaName = newAreaForm.customAreaName.trim() || undefined;
    area.areaNumber = newAreaForm.areaNumber.trim() || undefined;
    applyTemplateToArea(area);
    project.areas.push(area);
    await saveProject(project);
    scheduleSync(project.id);
    const nextRecentAreaTypeKeys = [
      newAreaForm.areaTypeKey,
      ...recentAreaTypeKeys.filter((key) => key !== newAreaForm.areaTypeKey),
    ].slice(0, 8);
    setRecentAreaTypeKeys(nextRecentAreaTypeKeys);
    localStorage.setItem(RECENT_AREA_TYPES_STORAGE_KEY, JSON.stringify(nextRecentAreaTypeKeys));
    setNewAreaForm(getDefaultAreaFormValue());
    setShowAddArea(false);
    loadProject();
  }

  const toggleAreaSelection = useCallback((areaId: string) => {
    setSelectedAreaIds((prev) => {
      const next = new Set(prev);
      if (next.has(areaId)) next.delete(areaId);
      else next.add(areaId);
      return next;
    });
  }, []);

  async function handleDeleteSelectedAreas() {
    if (!project) return;
    if (selectedAreaIds.size === 0) {
      setDeleteMode(false);
      return;
    }
    const now = new Date();
    project.areas.forEach((area) => {
      if (selectedAreaIds.has(area.id)) {
        area.deletedAt = now;
      }
    });
    await saveProject(project);
    scheduleSync(project.id);
    setSelectedAreaIds(new Set());
    setDeleteMode(false);
    setActionSheet(null);
    await loadProject();
  }

  async function handleRestoreArea(areaId: string) {
    if (!project) return;
    const area = project.areas.find((entry) => entry.id === areaId);
    if (!area) return;
    delete area.deletedAt;
    await saveProject(project);
    scheduleSync(project.id);
    await loadProject();
  }

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    setSyncError(null);
    setSyncStatus('syncing');
    try {
      const token = await ensureAccessToken();
      if (!token) {
        setSyncError('Please sign in to sync.');
        setSyncStatus('needs-auth');
        return;
      }
      await syncProjectsWithOneDrive(token);
      setSyncStatus('idle');
      await loadProject();
    } catch (error) {
      console.error('Sync failed:', error);
      setSyncError(getMicrosoftErrorMessage(error, 'Sync failed.'));
      setSyncStatus('error');
    } finally {
      setSyncing(false);
    }
  }

  async function runBackgroundSync() {
    if (backgroundSyncInFlightRef.current) {
      backgroundSyncQueuedRef.current = true;
      return;
    }
    if (dirtyProjectIdsRef.current.size === 0) return;

    backgroundSyncInFlightRef.current = true;
    setSyncStatus('syncing');
    const dirtyProjectIds = [...dirtyProjectIdsRef.current];
    dirtyProjectIdsRef.current.clear();
    try {
      const token = await ensureAccessToken();
      if (!token) {
        dirtyProjectIds.forEach((projectId) => dirtyProjectIdsRef.current.add(projectId));
        setSyncStatus('needs-auth');
        return;
      }
      const pushResult = await pushProjectsToOneDrive(token, dirtyProjectIds);
      if (pushResult.conflicts.length > 0) {
        await syncProjectsWithOneDrive(token);
        await loadProject();
      }
      setSyncStatus('idle');
    } catch (error) {
      dirtyProjectIds.forEach((projectId) => dirtyProjectIdsRef.current.add(projectId));
      setSyncStatus('error');
      console.error('Background sync failed:', error);
    } finally {
      backgroundSyncInFlightRef.current = false;
      if (backgroundSyncQueuedRef.current) {
        backgroundSyncQueuedRef.current = false;
        scheduleSync();
      }
    }
  }

  function scheduleSync(projectId?: string) {
    if (projectId) {
      dirtyProjectIdsRef.current.add(projectId);
    }
    setSyncStatus('pending');
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
    }
    syncTimerRef.current = setTimeout(() => {
      void runBackgroundSync();
    }, 800);
  }

  function cancelSelectionMode() {
    setDeleteMode(false);
    setActionSheet(null);
    setSelectedAreaIds(new Set());
  }

  useEffect(() => {
    function handleTopMenuAction(event: Event) {
      const customEvent = event as CustomEvent<{ action: string; sort?: SortOption }>;
      const detail = customEvent.detail;
      if (!detail || !project) return;

      if (detail.action === 'sort' && detail.sort) {
        handleSortChange(detail.sort);
        return;
      }

      if (detail.action === 'new-area') {
        setShowAddArea(true);
        return;
      }

      if (detail.action === 'edit-project') {
        setEditingProject(project);
        return;
      }

      if (detail.action === 'toggle-selection') {
        if (deleteMode) {
          cancelSelectionMode();
        } else {
          setDeleteMode(true);
          setSelectedAreaIds(new Set());
        }
        return;
      }

      if (detail.action === 'toggle-trash') {
        setShowTrash((current) => !current);
        setDeleteMode(false);
        setSelectedAreaIds(new Set());
        setActionSheet(null);
        return;
      }

      if (detail.action === 'clear-trash') {
        setShowTrash(false);
        setDeleteMode(false);
        setSelectedAreaIds(new Set());
        setActionSheet(null);
      }
    }

    window.addEventListener('punchlist-home-menu-action', handleTopMenuAction as EventListener);
    return () => {
      window.removeEventListener('punchlist-home-menu-action', handleTopMenuAction as EventListener);
    };
  }, [project, deleteMode]);

  useEffect(() => {
    if (!project) return;
    window.dispatchEvent(
      new CustomEvent('punchlist-home-menu-state', {
        detail: {
          context: 'project',
          sortOption,
          showTrash,
          canAddArea: true,
          isSingleProject: true,
          singleProjectName: project.projectName,
          selectionMode: deleteMode,
        },
      })
    );
  }, [project, sortOption, showTrash, deleteMode]);

  function isListAtTop() {
    return (listRef.current?.scrollTop ?? 0) <= 8;
  }

  function handlePullStart(e: TouchEvent<HTMLElement>) {
    const atTop = isListAtTop();
    if (!atTop || syncing) {
      pullStartYRef.current = null;
      pullDistanceRef.current = 0;
      return;
    }
    pullStartYRef.current = e.touches[0]?.clientY ?? null;
    pullDistanceRef.current = 0;
  }

  function handlePullMove(e: TouchEvent<HTMLElement>) {
    const atTop = isListAtTop();
    if (pullStartYRef.current === null || !atTop || syncing) return;
    const currentY = e.touches[0]?.clientY ?? pullStartYRef.current;
    const delta = currentY - pullStartYRef.current;
    pullDistanceRef.current = delta;
    const armed = delta >= 45;
    if (armed !== pullArmedRef.current) {
      pullArmedRef.current = armed;
    }
  }

  function handlePullEnd() {
    pullStartYRef.current = null;
    if (pullDistanceRef.current >= 45 && !syncing) {
      void handleSync();
    }
    pullDistanceRef.current = 0;
    pullArmedRef.current = false;
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50 dark:bg-zinc-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500 dark:border-gray-300"></div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div className="app-page h-[calc(100dvh-env(safe-area-inset-top)-3.5rem)] flex flex-col overflow-hidden">
      <header className="header-stable shrink-0 border-b z-20">
        <div className="mx-auto flex h-[4.75rem] w-full max-w-6xl items-center px-4 py-3 sm:px-5">
          <div className="flex w-full items-center gap-3">
            <Link href="/" className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-semibold tracking-[-0.01em] text-gray-900 dark:text-white">
                {project.projectName}
              </h1>
              <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">
                {project.address || 'Project dashboard'}
              </p>
            </div>
            {project.inspector && (
              <span className="ml-4 shrink-0 text-sm text-gray-500 dark:text-gray-400">
                {project.inspector}
              </span>
            )}
          </div>
        </div>
        {deleteMode && (
          <div className="header-row mx-auto w-full max-w-6xl sm:px-5">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 min-w-0">
              <button
                onClick={cancelSelectionMode}
                className="flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium text-gray-600 transition hover:bg-black/[0.04] dark:text-gray-300 dark:hover:bg-white/[0.06]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (selectedAreaIds.size === 0) return;
                  setActionSheet('delete');
                }}
                disabled={selectedAreaIds.size === 0}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600 transition hover:bg-red-100 dark:bg-red-900/20 disabled:opacity-40"
                aria-label="Delete selected areas"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </header>

      {syncError && (
        <div className="shrink-0 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700">
          {syncError}
        </div>
      )}
      {/* Areas List */}
      <main
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-scroll overscroll-y-contain touch-pan-y px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] sm:px-5"
        onTouchStartCapture={handlePullStart}
        onTouchMoveCapture={handlePullMove}
        onTouchEndCapture={handlePullEnd}
        onTouchCancelCapture={handlePullEnd}
      >
        {!showTrash && activeAreas.length === 0 ? (
          <div className="mx-auto flex min-h-[calc(100%+1px)] w-full max-w-6xl flex-col">
            <div className="flex flex-1 items-center justify-center py-12">
              <div className="w-full max-w-sm rounded-[1.75rem] border border-dashed border-gray-300 bg-white/70 p-8 text-center dark:border-zinc-700 dark:bg-zinc-800/70">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-500 dark:bg-zinc-900 dark:text-gray-300">
                  <Building2 className="h-7 w-7" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">No areas yet</h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Add the first area to start walking the punch list.
                </p>
              </div>
            </div>
            <div className="mt-auto pt-2" />
          </div>
        ) : showTrash ? (
          trashedAreas.length === 0 ? (
            <div className="text-center py-12">
              <Trash2 className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Trash Is Empty</h2>
              <p className="text-gray-500 dark:text-gray-400">Deleted areas will show up here.</p>
            </div>
          ) : (
            <div className="list-stack mx-auto w-full max-w-6xl">
              {trashedAreas.map((area) => {
                const deletedAt = area.deletedAt ?? new Date();
                return (
                  <div
                    key={area.id}
                    className="rounded-lg border p-4 border-gray-300 bg-gray-50 dark:bg-zinc-800 dark:border-zinc-700"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-gray-900 dark:text-white truncate">{area.name}</div>
                        <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                          Deleted {deletedAt.toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        onClick={() => void handleRestoreArea(area.id)}
                        className="rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 flex items-center gap-1 shrink-0"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Restore
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="list-stack mx-auto min-h-[calc(100%+1px)] w-full max-w-6xl">
            {sortedAreas.map((area) => {
              const metric = areaMetrics.get(area.id);
              const isSelected = selectedAreaIds.has(area.id);
              return (
                <AreaCard
                  key={area.id}
                  projectId={project.id}
                  area={area}
                  metric={metric}
                  deleteMode={deleteMode}
                  isSelected={isSelected}
                  onToggleSelection={toggleAreaSelection}
                />
              );
            })}
            <div className="mt-auto pt-2" />
          </div>
        )}
      </main>

      {!showTrash && !deleteMode && (
        <div className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] left-1/2 z-20 -translate-x-1/2">
          <button
            onClick={() => setShowAddArea(true)}
            className="pointer-events-auto inline-flex h-14 w-[10.5rem] items-center justify-center gap-2 rounded-full bg-gray-900 px-5 text-sm font-semibold text-white shadow-xl shadow-black/20 transition hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            <Plus className="h-4 w-4" />
            Add Area
          </button>
        </div>
      )}

      <AreaEditorModal
        open={showAddArea}
        title="Add Area"
        value={newAreaForm}
        recentAreaTypeKeys={recentAreaTypeKeys}
        onChange={setNewAreaForm}
        onClose={() => {
          setShowAddArea(false);
          setNewAreaForm(getDefaultAreaFormValue());
        }}
        onSubmit={() => void handleAddArea()}
        submitLabel="Add"
      />

      {editingProject && (
        <ProjectEditModal
          project={editingProject}
          onSave={(updates) => void handleEditProject(updates)}
          onClose={() => setEditingProject(null)}
        />
      )}

      {actionSheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-md">
            <div className="menu-surface overflow-hidden rounded-[1.75rem]">
              <button
                onClick={() => void handleDeleteSelectedAreas()}
                className="w-full py-3 text-center text-[17px] text-red-600 border-b border-gray-200 dark:border-gray-700"
              >
                Delete
              </button>
              <button
                onClick={() => setActionSheet(null)}
                className="w-full py-3 text-center text-[17px] text-gray-900 dark:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
