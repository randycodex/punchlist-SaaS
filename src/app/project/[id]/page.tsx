'use client';

import { memo, useState, useEffect, useMemo, useRef, useCallback, type TouchEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Project, getProjectStats, getAreaStats, getReviewMetrics } from '@/types';
import { getProject, saveProject, createArea } from '@/lib/db';
import { getMicrosoftErrorMessage } from '@/lib/microsoftErrors';
import AreaEditorModal from '@/components/AreaEditorModal';
import { buildAreaName, getDefaultAreaFormValue, type AreaTypeKey } from '@/lib/areas';
import { applyTemplateToArea } from '@/lib/template';
import { pushProjectsToOneDrive, syncProjectsWithOneDrive } from '@/lib/oneDriveSync';
import { useMicrosoftAuth } from '@/contexts/MicrosoftAuthContext';
import { useSyncStatus } from '@/contexts/SyncStatusContext';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Building2,
  ChevronRight,
  Trash2,
  ChevronDown,
  CheckCircle,
  AlertTriangle,
  Circle,
  MapPin,
  User,
  Image as ImageIcon,
  MessageSquare,
  RotateCcw,
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
  const pending = metric?.pending ?? 0;
  const areaPhotoCount = metric?.photoCount ?? 0;
  const areaCommentCount = metric?.commentCount ?? 0;
  const progress = metric?.progress ?? 0;

  return (
    <div
      onClick={() => {
        if (deleteMode) {
          onToggleSelection(area.id);
        }
      }}
      className={`block rounded-lg border p-4 transition-colors ${
        isSelected
          ? 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-700'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
      } ${deleteMode ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start gap-3">
        <Link
          href={deleteMode ? '#' : `/project/${projectId}/area/${area.id}`}
          onClick={(event) => {
            if (deleteMode) event.preventDefault();
          }}
          className="flex-1"
        >
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900 dark:text-white">{area.name}</h3>
            <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0">{areaStats.total} items</span>
            {area.isComplete && <CheckCircle className="w-4 h-4 text-green-500" />}
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm">
            {pending > 0 && (
              <span className="text-gray-400 flex items-center gap-1">
                <Circle className="w-3 h-3" />
                {pending}
              </span>
            )}
            {areaStats.issues > 0 && (
              <span className="text-orange-500 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {areaStats.issues}
              </span>
            )}
            {areaPhotoCount > 0 && (
              <span className="text-amber-500 flex items-center gap-1">
                <ImageIcon className="w-3 h-3" />
                {areaPhotoCount}
              </span>
            )}
            {areaCommentCount > 0 && (
              <span className="text-sky-600 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {areaCommentCount}
              </span>
            )}
          </div>
          {areaStats.total > 0 && (
            <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
        </Link>
        <Link
          href={deleteMode ? '#' : `/project/${projectId}/area/${area.id}`}
          onClick={(event) => {
            if (deleteMode) event.preventDefault();
          }}
          className="p-1 text-gray-400 hover:text-blue-500"
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
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [actionSheet, setActionSheet] = useState<'delete' | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const sortButtonRef = useRef<HTMLButtonElement | null>(null);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
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

  const sortLabels: Record<SortOption, string> = {
    name: 'Name',
    recent: 'Recent',
    progress: 'Progress',
  };

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
    if (!showSortMenu) return;
    const onDocInteract = (event: Event) => {
      const target = event.target as Node | null;
      if (!target) return;
      const inButton = !!sortButtonRef.current?.contains(target);
      const inMenu = !!sortMenuRef.current?.contains(target);
      if (!inButton && !inMenu) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('pointerdown', onDocInteract, true);
    return () => {
      document.removeEventListener('pointerdown', onDocInteract, true);
    };
  }, [showSortMenu]);

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
    setShowSortMenu(false);
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
      await pushProjectsToOneDrive(token, dirtyProjectIds);
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
      <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  const stats = getProjectStats(project);
  const reviewMetrics = getReviewMetrics(stats.total, stats.ok, stats.issues);

  return (
    <div className="h-[calc(100dvh-env(safe-area-inset-top)-3.5rem)] bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
      {/* Header controls */}
      <header className="header-stable shrink-0 border-b z-20">
        <div className="header-row">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 min-w-0">
            <Link href="/" className="p-1 -ml-1 text-gray-600 dark:text-gray-300">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="relative">
              <button
                ref={sortButtonRef}
                onClick={() => setShowSortMenu(!showSortMenu)}
                className="h-9 flex items-center justify-between gap-1 min-w-[6.5rem] px-3 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                {sortLabels[sortOption]}
                <ChevronDown className="w-4 h-4" />
              </button>
              {showSortMenu && (
                <div
                  ref={sortMenuRef}
                  className="absolute left-0 mt-1 w-36 max-w-[calc(100vw-1rem)] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50"
                >
                  {(['name', 'recent', 'progress'] as SortOption[]).map((option) => (
                    <button
                      key={option}
                      onClick={() => handleSortChange(option)}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        sortOption === option ? 'text-blue-600 font-medium' : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {sortLabels[option]}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {!deleteMode ? (
              <button
                onClick={() => {
                  setDeleteMode(true);
                  setSelectedAreaIds(new Set());
                }}
                className="h-9 px-3 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Select
              </button>
            ) : (
              <>
                <button
                  onClick={cancelSelectionMode}
                  className="h-9 px-3 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (selectedAreaIds.size === 0) return;
                    setActionSheet('delete');
                  }}
                  disabled={selectedAreaIds.size === 0}
                  className="h-9 w-9 flex items-center justify-center rounded-lg text-red-600 bg-red-50 dark:bg-red-900/20 disabled:opacity-40"
                  aria-label="Delete selected areas"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 shrink-0">
            {!deleteMode && (
              <button
                onClick={() => {
                  setShowTrash((current) => !current);
                  setDeleteMode(false);
                  setSelectedAreaIds(new Set());
                  setActionSheet(null);
                }}
                className={`h-9 px-3 text-sm rounded-lg flex items-center gap-1.5 ${
                  showTrash
                    ? 'text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                aria-label="Delete areas"
              >
                <Trash2 className="w-4 h-4" />
                Trash
              </button>
            )}
            <button
              onClick={() => setShowAddArea(true)}
              disabled={showTrash}
              className="h-9 w-9 flex items-center justify-center text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
              aria-label="Add area"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {syncError && (
        <div className="shrink-0 px-4 py-2 text-sm text-red-600 bg-red-50 border-b border-red-100">
          {syncError}
        </div>
      )}
      {/* Areas List */}
      <main
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-scroll overscroll-y-contain touch-pan-y px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+6rem)]"
        onTouchStartCapture={handlePullStart}
        onTouchMoveCapture={handlePullMove}
        onTouchEndCapture={handlePullEnd}
        onTouchCancelCapture={handlePullEnd}
      >
        {!showTrash && activeAreas.length === 0 ? (
          <div className="flex justify-center py-12">
            <button
              onClick={() => setShowAddArea(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600"
            >
              Add Area
            </button>
          </div>
        ) : showTrash ? (
          trashedAreas.length === 0 ? (
            <div className="text-center py-12">
              <Trash2 className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Trash Is Empty</h2>
              <p className="text-gray-500 dark:text-gray-400">Deleted areas will show up here.</p>
            </div>
          ) : (
            <div className="list-stack">
              {trashedAreas.map((area) => {
                const deletedAt = area.deletedAt ?? new Date();
                return (
                  <div
                    key={area.id}
                    className="rounded-lg border p-4 border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800"
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
                        className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 flex items-center gap-1 shrink-0"
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
          <div className="min-h-[calc(100%+1px)] list-stack">
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
            <div className="pt-2">
              {stats.total > 0 && (
                <div className="mb-3">
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 transition-all" style={{ width: `${reviewMetrics.reviewedPercent}%` }} />
                  </div>
                </div>
              )}
              {project.address && (
                <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1 mb-2">
                  <MapPin className="w-4 h-4" />
                  {project.address}
                </p>
              )}
              {project.inspector && (
                <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                  <User className="w-4 h-4" />
                  {project.inspector}
                </p>
              )}
            </div>
          </div>
        )}
      </main>

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

      {actionSheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-md">
            <div className="rounded-2xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => void handleDeleteSelectedAreas()}
                className="w-full py-3 text-center text-[17px] text-red-600 border-b border-gray-200 dark:border-gray-700"
              >
                Delete
              </button>
              <button
                onClick={() => setActionSheet(null)}
                className="w-full py-3 text-center text-[17px] text-blue-600"
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
