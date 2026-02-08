'use client';

import { useState, useEffect, useMemo, useRef, type TouchEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Project, getProjectStats, getAreaStats } from '@/types';
import { getProject, saveProject, createArea } from '@/lib/db';
import { applyTemplateToArea } from '@/lib/template';
import { syncProjectsWithOneDrive } from '@/lib/oneDriveSync';
import { useMicrosoftAuth } from '@/contexts/MicrosoftAuthContext';
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
} from 'lucide-react';

type SortOption = 'name' | 'recent' | 'progress';

const SORT_STORAGE_KEY = 'punchlist-areas-sort';

type AreaMetrics = {
  stats: ReturnType<typeof getAreaStats>;
  pending: number;
  progress: number;
  photoCount: number;
  commentCount: number;
};

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddArea, setShowAddArea] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedAreaIds, setSelectedAreaIds] = useState<Set<string>>(new Set());
  const [newAreaName, setNewAreaName] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('name');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [actionSheet, setActionSheet] = useState<'delete' | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pullArmed, setPullArmed] = useState(false);
  const sortButtonRef = useRef<HTMLButtonElement | null>(null);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pullStartYRef = useRef<number | null>(null);
  const pullDistanceRef = useRef(0);
  const listRef = useRef<HTMLElement | null>(null);
  const { accessToken, ensureAccessToken } = useMicrosoftAuth();

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
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle('sync-active', syncing);
    return () => {
      document.body.classList.remove('sync-active');
    };
  }, [syncing]);

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

  const areaMetrics = useMemo(() => {
    const metrics = new Map<string, AreaMetrics>();
    if (!project) return metrics;

    for (const area of project.areas) {
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
      const pending = stats.total - stats.ok - stats.issues;
      const progress = stats.total > 0 ? (stats.ok / stats.total) * 100 : 0;
      metrics.set(area.id, { stats, pending, progress, photoCount, commentCount });
    }

    return metrics;
  }, [project]);

  const sortedAreas = useMemo(() => {
    if (!project) return [];
    return [...project.areas].sort((a, b) => {
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
  }, [project, sortOption, areaMetrics]);

  async function handleAddArea() {
    if (!project || !newAreaName.trim()) return;

    const area = createArea(project.id, newAreaName.trim(), project.areas.length);
    applyTemplateToArea(area);
    project.areas.push(area);
    await saveProject(project);
    scheduleSync();
    setNewAreaName('');
    setShowAddArea(false);
    loadProject();
  }

  function toggleAreaSelection(areaId: string) {
    setSelectedAreaIds((prev) => {
      const next = new Set(prev);
      if (next.has(areaId)) next.delete(areaId);
      else next.add(areaId);
      return next;
    });
  }

  async function handleDeleteSelectedAreas() {
    if (!project) return;
    if (selectedAreaIds.size === 0) {
      setDeleteMode(false);
      return;
    }
    project.areas = project.areas.filter((area) => !selectedAreaIds.has(area.id));
    await saveProject(project);
    scheduleSync();
    setSelectedAreaIds(new Set());
    setDeleteMode(false);
    setActionSheet(null);
    await loadProject();
  }

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    setSyncError(null);
    try {
      const token = accessToken ?? (await ensureAccessToken());
      if (!token) {
        setSyncError('Please sign in to sync.');
        return;
      }
      await syncProjectsWithOneDrive(token);
      await loadProject();
    } catch (error) {
      console.error('Sync failed:', error);
      setSyncError('Sync failed. Please try again.');
    } finally {
      setSyncing(false);
    }
  }

  function scheduleSync() {
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
    }
    syncTimerRef.current = setTimeout(async () => {
      const token = accessToken ?? (await ensureAccessToken());
      if (!token) return;
      try {
        await syncProjectsWithOneDrive(token);
      } catch (error) {
        console.error('Background sync failed:', error);
      }
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
    setPullArmed(delta >= 45);
  }

  function handlePullEnd() {
    pullStartYRef.current = null;
    if (pullDistanceRef.current >= 45 && !syncing) {
      void handleSync();
    }
    pullDistanceRef.current = 0;
    setPullArmed(false);
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
  const remainingCount = stats.total - stats.ok - stats.issues;

  return (
    <div className="h-[calc(100dvh-env(safe-area-inset-top)-3.5rem)] bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
      {/* Header controls */}
      <header className="header-stable shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-20">
        <div className="pl-2 pr-3 h-12 flex items-center gap-2">
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
            <button
              onClick={() => setShowAddArea(true)}
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

      {/* Project Info */}
      <div className="pinned-surface shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        {project.address && (
          <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1 mb-2">
            <MapPin className="w-4 h-4" />
            {project.address}
          </p>
        )}
        {project.inspector && (
          <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1 mb-2">
            <User className="w-4 h-4" />
            {project.inspector}
          </p>
        )}
        <div className="grid grid-cols-4 gap-2 w-full">
          <div className="text-center">
            <div className="text-xl leading-6 font-semibold text-purple-600">{stats.areas}</div>
            <div className="text-xs leading-4 text-gray-500 dark:text-gray-400">Areas</div>
          </div>
          <div className="text-center">
            <div className="text-xl leading-6 font-semibold text-blue-600">{remainingCount}</div>
            <div className="text-xs leading-4 text-gray-500 dark:text-gray-400">Total</div>
          </div>
          <div className="text-center">
            <div className="text-xl leading-6 font-semibold text-orange-500">{stats.issues}</div>
            <div className="text-xs leading-4 text-gray-500 dark:text-gray-400">Issues</div>
          </div>
          <div className="text-center">
            <div className="text-xl leading-6 font-semibold text-green-600">{stats.ok}</div>
            <div className="text-xs leading-4 text-gray-500 dark:text-gray-400">OK</div>
          </div>
        </div>
      </div>

      {/* Areas List */}
      <main
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-scroll overscroll-y-contain touch-pan-y px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+6rem)]"
        onTouchStartCapture={handlePullStart}
        onTouchMoveCapture={handlePullMove}
        onTouchEndCapture={handlePullEnd}
        onTouchCancelCapture={handlePullEnd}
      >
        {project.areas.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Areas</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4">Add an area to start inspecting</p>
            <button
              onClick={() => setShowAddArea(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600"
            >
              Add Area
            </button>
          </div>
        ) : (
          <div className="min-h-[calc(100%+1px)] space-y-2">
            {sortedAreas.map((area) => {
              const metric = areaMetrics.get(area.id);
              const areaStats = metric?.stats ?? { total: 0, ok: 0, issues: 0 };
              const pending = metric?.pending ?? 0;
              const areaPhotoCount = metric?.photoCount ?? 0;
              const areaCommentCount = metric?.commentCount ?? 0;
              const progress = metric?.progress ?? 0;
              const isSelected = selectedAreaIds.has(area.id);
              return (
                <div
                  key={area.id}
                  onClick={() => {
                    if (deleteMode) {
                      toggleAreaSelection(area.id);
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
                      href={deleteMode ? '#' : `/project/${project.id}/area/${area.id}`}
                      onClick={(e) => {
                        if (deleteMode) e.preventDefault();
                      }}
                      className="flex-1"
                    >
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 dark:text-white">{area.name}</h3>
                        <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0">
                          {areaStats.total} items
                        </span>
                        {area.isComplete && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
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
                        {areaStats.ok > 0 && (
                          <span className="text-green-600 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            {areaStats.ok}
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
                          <div
                            className="h-full bg-green-500 transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      )}
                    </Link>
                    <Link
                      href={deleteMode ? '#' : `/project/${project.id}/area/${area.id}`}
                      onClick={(e) => {
                        if (deleteMode) e.preventDefault();
                      }}
                      className="p-1 text-gray-400 hover:text-blue-500"
                      aria-label={`Open ${area.name}`}
                    >
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add Area Modal */}
      {showAddArea && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add Area</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Area Name *
              </label>
              <input
                type="text"
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="e.g., Apt 101, Unit A"
                autoFocus
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddArea(false);
                  setNewAreaName('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleAddArea}
                disabled={!newAreaName.trim()}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

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
