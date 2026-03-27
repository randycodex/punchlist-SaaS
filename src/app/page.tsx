'use client';

import { memo, useState, useEffect, useMemo, useRef, useCallback, type TouchEvent } from 'react';
import { Project, getProjectStats, getAreaStats, getReviewMetrics } from '@/types';
import { getAllProjects, saveProject, deleteProject, createProject, createArea } from '@/lib/db';
import { syncProjectsWithOneDrive, pushProjectsToOneDrive, SyncConflict, markProjectDeleted } from '@/lib/oneDriveSync';
import { generateMultiProjectPDF, downloadPDF } from '@/lib/pdfExport';
import { uploadPdfToOneDrive, getNextOneDriveExportFilename } from '@/lib/oneDrive';
import { getMicrosoftErrorMessage } from '@/lib/microsoftErrors';
import { useMicrosoftAuth } from '@/contexts/MicrosoftAuthContext';
import { useSyncStatus } from '@/contexts/SyncStatusContext';
import ProjectEditModal from '@/components/ProjectEditModal';
import AreaEditorModal from '@/components/AreaEditorModal';
import { applyTemplateToArea } from '@/lib/template';
import { buildAreaName, getDefaultAreaFormValue, type AreaTypeKey } from '@/lib/areas';
import Link from 'next/link';
import {
  ChevronRight,
  Trash2,
  CheckCircle,
  FileDown,
  Loader2,
  MoreVertical,
  Pencil,
  RotateCcw,
  Plus,
} from 'lucide-react';

type SortOption = 'name' | 'recent' | 'progress';

const SORT_STORAGE_KEY = 'punchlist-projects-sort';
const RECENT_AREA_TYPES_STORAGE_KEY = 'punchlist-recent-area-types';
const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const LONG_PRESS_MS = 500;

type ProjectMetrics = {
  stats: ReturnType<typeof getProjectStats>;
  pending: number;
  progress: number;
  okPercent: number;
  issuePercent: number;
  photoCount: number;
  commentCount: number;
};

type AreaMetrics = {
  stats: { total: number; ok: number; issues: number; areas?: number };
  pending: number;
  progress: number;
  photoCount: number;
  commentCount: number;
};

type ProjectCardProps = {
  project: Project;
  metric?: ProjectMetrics;
  selectionMode: boolean;
  isSelected: boolean;
  menuOpen: boolean;
  onToggleSelection: (id: string) => void;
  onToggleMenu: (id: string) => void;
  onCloseMenu: () => void;
  onEditProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
  onLongPressSelect: (projectId: string) => void;
};

const ProjectCard = memo(function ProjectCard({
  project,
  metric,
  selectionMode,
  isSelected,
  menuOpen,
  onToggleSelection,
  onToggleMenu,
  onCloseMenu,
  onEditProject,
  onDeleteProject,
  onLongPressSelect,
}: ProjectCardProps) {
  const stats = metric?.stats ?? { total: 0, ok: 0, issues: 0, areas: project.areas.length };
  const progress = metric?.progress ?? 0;
  const hasContent = stats.total > 0 || stats.areas > 0;
  const metricsLabel =
    stats.total > 0
      ? `${stats.total} items${stats.issues > 0 ? ` · ${stats.issues} issues` : ''}`
      : 'No areas yet';

  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearLongPress() {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }

  return (
    <div
      onContextMenu={(event) => {
        if (!selectionMode) {
          event.preventDefault();
        }
      }}
      onClick={() => {
        if (selectionMode) {
          onToggleSelection(project.id);
        }
      }}
      onPointerDown={() => {
        if (!selectionMode) {
          longPressRef.current = setTimeout(() => {
            onLongPressSelect(project.id);
            longPressRef.current = null;
          }, LONG_PRESS_MS);
        }
      }}
      onPointerUp={clearLongPress}
      onPointerCancel={clearLongPress}
      onPointerLeave={clearLongPress}
      className={`select-none rounded-[1.5rem] border p-4 transition-colors [-webkit-touch-callout:none] ${
        isSelected
          ? '!border-gray-400 !bg-gray-200 dark:!border-gray-500 dark:!bg-gray-700'
          : 'border-gray-300 bg-white/90 hover:border-gray-400 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-500'
      } ${selectionMode ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start gap-3">
        <Link
          href={selectionMode ? '#' : `/project/${project.id}`}
          onClick={(event) => {
            if (selectionMode) event.preventDefault();
          }}
          onContextMenu={(event) => {
            if (!selectionMode) {
              event.preventDefault();
            }
          }}
          className="flex-1 min-w-0 [-webkit-touch-callout:none]"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="truncate text-[1.02rem] font-semibold tracking-[-0.01em] text-gray-900 dark:text-white">{project.projectName}</h3>
            </div>
            <p className={`mt-1 truncate text-sm ${project.address ? 'text-gray-500 dark:text-gray-400' : 'text-gray-400 dark:text-gray-500'}`}>
              {project.address || 'No address added'}
            </p>
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className={stats.issues > 0 ? 'text-red-600 dark:text-red-300' : 'text-gray-500 dark:text-gray-400'}>
                {metricsLabel}
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-zinc-700">
              <div
                className={`h-full rounded-full transition-all ${
                  stats.issues > 0 ? 'bg-red-500/80 dark:bg-red-400/80' : 'bg-gray-900 dark:bg-white'
                } ${!hasContent ? 'opacity-40' : ''}`}
                style={{ width: `${hasContent ? Math.max(progress, 4) : 4}%` }}
              />
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={(event) => {
                event.stopPropagation();
                onToggleMenu(project.id);
              }}
              onPointerDown={(event) => event.stopPropagation()}
              className="rounded-full p-2 text-gray-400 transition hover:bg-black/[0.04] hover:text-gray-700 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
              aria-label={`Project actions for ${project.projectName}`}
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={onCloseMenu} />
                <div className="menu-surface absolute right-0 z-20 mt-2 w-44 rounded-2xl">
                  <button
                    onClick={() => {
                      onCloseMenu();
                      onEditProject(project);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit Project
                  </button>
                  <button
                    onClick={() => {
                      onCloseMenu();
                      onDeleteProject(project);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-red-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
          <Link
            href={selectionMode ? '#' : `/project/${project.id}`}
            onClick={(event) => {
              event.stopPropagation();
              if (selectionMode) event.preventDefault();
            }}
            onContextMenu={(event) => {
              if (!selectionMode) {
                event.preventDefault();
              }
            }}
            onPointerDown={(event) => event.stopPropagation()}
            className="mt-0.5 rounded-full p-1 text-gray-400 transition hover:bg-black/[0.04] hover:text-gray-700 dark:hover:bg-white/[0.06] dark:hover:text-gray-200 [-webkit-touch-callout:none]"
            aria-label={`Open ${project.projectName}`}
          >
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </div>
  );
});

type HomeAreaCardProps = {
  projectId: string;
  area: Project['areas'][number];
  metric?: AreaMetrics;
  deleteMode: boolean;
  isSelected: boolean;
  onToggleSelection: (areaId: string) => void;
};

const HomeAreaCard = memo(function HomeAreaCard({
  projectId,
  area,
  metric,
  deleteMode,
  isSelected,
  onToggleSelection,
}: HomeAreaCardProps) {
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
      className={`card-surface-subtle rounded-[1.5rem] p-4 transition-colors ${
        isSelected
          ? '!border-gray-400 !bg-gray-200 dark:!border-gray-500 dark:!bg-gray-700'
          : 'hover:border-gray-400 dark:hover:border-zinc-500'
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
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="truncate text-[1.02rem] font-semibold tracking-[-0.01em] text-gray-900 dark:text-white">{area.name}</h3>
              <span className="shrink-0 text-sm text-gray-500 dark:text-gray-400">{areaStats.total} items</span>
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
          className="mt-0.5 rounded-full p-1 text-gray-400 transition hover:bg-black/[0.04] hover:text-gray-700 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
          aria-label={`Open ${area.name}`}
        >
          <ChevronRight className="w-5 h-5" />
        </Link>
      </div>
    </div>
  );
});

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectAddress, setNewProjectAddress] = useState('');
  const [newProjectInspector, setNewProjectInspector] = useState('');
  const [newProjectGcName, setNewProjectGcName] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('name');
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncConflicts, setSyncConflicts] = useState<SyncConflict[]>([]);
  const [deleteMode, setDeleteMode] = useState(false);
  const [exportMode, setExportMode] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [exportingSelected, setExportingSelected] = useState(false);
  const [exportingSelectedToDrive, setExportingSelectedToDrive] = useState(false);
  const [actionSheet, setActionSheet] = useState<'delete' | 'export' | null>(null);
  const [showProjectMenuId, setShowProjectMenuId] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [showAddArea, setShowAddArea] = useState(false);
  const [showAreaProjectPicker, setShowAreaProjectPicker] = useState(false);
  const [areaTargetProjectId, setAreaTargetProjectId] = useState<string | null>(null);
  const [selectedAreaIds, setSelectedAreaIds] = useState<Set<string>>(new Set());
  const [newAreaForm, setNewAreaForm] = useState(getDefaultAreaFormValue());
  const [recentAreaTypeKeys, setRecentAreaTypeKeys] = useState<AreaTypeKey[]>([]);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backgroundSyncInFlightRef = useRef(false);
  const backgroundSyncQueuedRef = useRef(false);
  const dirtyProjectIdsRef = useRef<Set<string>>(new Set());
  const fullSyncNeededRef = useRef(false);
  const pullStartYRef = useRef<number | null>(null);
  const pullArmedRef = useRef(false);
  const listRef = useRef<HTMLElement | null>(null);
  const { accessToken, signIn, signOut, isSignedIn, ensureAccessToken } = useMicrosoftAuth();
  const { setStatus: setSyncStatus } = useSyncStatus();
  const selectionMode = deleteMode || exportMode;

  useEffect(() => {
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
    loadProjects();
  }, []);

  useEffect(() => {
    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    void handleSync();
  }, [accessToken]);

  function handleSortChange(option: SortOption) {
    setSortOption(option);
    localStorage.setItem(SORT_STORAGE_KEY, option);
  }

  async function loadProjects() {
    try {
      const data = await getAllProjects();
      const now = Date.now();
      const expiredProjects = data.filter(
        (project) =>
          project.deletedAt &&
          now - project.deletedAt.getTime() >= TRASH_RETENTION_MS
      );

      if (expiredProjects.length > 0) {
        for (const project of expiredProjects) {
          markProjectDeleted(project.id);
          await deleteProject(project.id);
        }
        scheduleSync(undefined, { fullSync: true });
      }

      const expiredIds = new Set(expiredProjects.map((project) => project.id));
      setProjects(data.filter((project) => !expiredIds.has(project.id)));
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
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
      const result = await syncProjectsWithOneDrive(token);
      setSyncConflicts(result.conflicts);
      setSyncStatus('idle');
      await loadProjects();
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
    if (dirtyProjectIdsRef.current.size === 0 && !fullSyncNeededRef.current) return;

    backgroundSyncInFlightRef.current = true;
    setSyncStatus('syncing');
    const dirtyProjectIds = [...dirtyProjectIdsRef.current];
    const shouldRunFullSync = fullSyncNeededRef.current;
    dirtyProjectIdsRef.current.clear();
    fullSyncNeededRef.current = false;

    try {
      const token = await ensureAccessToken();
      if (!token) {
        dirtyProjectIds.forEach((projectId) => dirtyProjectIdsRef.current.add(projectId));
        if (shouldRunFullSync) {
          fullSyncNeededRef.current = true;
        }
        setSyncStatus('needs-auth');
        return;
      }

      if (shouldRunFullSync) {
        const result = await syncProjectsWithOneDrive(token);
        setSyncConflicts(result.conflicts);
        setSyncStatus('idle');
        await loadProjects();
        return;
      }

      const pushResult = await pushProjectsToOneDrive(token, dirtyProjectIds);
      if (pushResult.conflicts.length > 0) {
        const result = await syncProjectsWithOneDrive(token);
        setSyncConflicts(result.conflicts);
        await loadProjects();
      }
      setSyncStatus('idle');
    } catch (error) {
      dirtyProjectIds.forEach((projectId) => dirtyProjectIdsRef.current.add(projectId));
      if (shouldRunFullSync) {
        fullSyncNeededRef.current = true;
      }
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

  function scheduleSync(projectId?: string, options?: { fullSync?: boolean }) {
    if (projectId) {
      dirtyProjectIdsRef.current.add(projectId);
    }
    if (options?.fullSync) {
      fullSyncNeededRef.current = true;
    }
    setSyncStatus('pending');
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
    }
    syncTimerRef.current = setTimeout(() => {
      void runBackgroundSync();
    }, 800);
  }

  const projectMetrics = useMemo(() => {
    const metrics = new Map<string, ProjectMetrics>();
    for (const project of projects) {
      let photoCount = 0;
      let commentCount = 0;
      for (const area of project.areas) {
        for (const location of area.locations) {
          for (const item of location.items) {
            for (const checkpoint of item.checkpoints) {
              photoCount += checkpoint.photos.length;
              if (checkpoint.comments.trim()) commentCount += 1;
            }
          }
        }
      }

      const stats = getProjectStats(project);
      const reviewMetrics = getReviewMetrics(stats.total, stats.ok, stats.issues);
      metrics.set(project.id, {
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
  }, [projects]);

  const activeProjects = useMemo(
    () => projects.filter((project) => !project.deletedAt),
    [projects]
  );

  const trashedProjects = useMemo(
    () =>
      projects
        .filter((project) => project.deletedAt)
        .sort(
          (a, b) =>
            (b.deletedAt?.getTime() ?? 0) - (a.deletedAt?.getTime() ?? 0)
        ),
    [projects]
  );

  const sortedProjects = useMemo(() => {
    return [...activeProjects].sort((a, b) => {
      if (sortOption === 'name') {
        return a.projectName.localeCompare(b.projectName);
      }
      if (sortOption === 'recent') {
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      }
      const progressA = projectMetrics.get(a.id)?.progress ?? 0;
      const progressB = projectMetrics.get(b.id)?.progress ?? 0;
      return progressB - progressA;
    });
  }, [activeProjects, sortOption, projectMetrics]);

  const singleProject = useMemo(
    () => (activeProjects.length === 1 ? activeProjects[0] : null),
    [activeProjects]
  );
  const singleProjectMainView = !!singleProject && !showTrash;
  const activeAreas = useMemo(
    () => (singleProject ? singleProject.areas.filter((area) => !area.deletedAt) : []),
    [singleProject]
  );

  const areaMetrics = useMemo(() => {
    const metrics = new Map<string, AreaMetrics>();
    if (!singleProject) return metrics;

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
        photoCount,
        commentCount,
      });
    }

    return metrics;
  }, [singleProject, activeAreas]);

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

  async function handleCreateProject() {
    if (!newProjectName.trim()) return;

    const project = createProject(newProjectName.trim(), newProjectAddress.trim(), newProjectInspector.trim());
    project.gcName = newProjectGcName.trim();
    await saveProject(project);
    scheduleSync(project.id);
    setNewProjectName('');
    setNewProjectAddress('');
    setNewProjectInspector('');
    setNewProjectGcName('');
    setShowNewProject(false);
    await loadProjects();
  }

  async function handleAddArea() {
    const targetProject =
      projects.find((project) => project.id === areaTargetProjectId && !project.deletedAt) ??
      singleProject;
    if (!targetProject) return;

    const areaName = buildAreaName(newAreaForm);
    if (!areaName) return;

    const area = createArea(targetProject.id, areaName, targetProject.areas.length, {
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
    targetProject.areas.push(area);
    await saveProject(targetProject);
    scheduleSync(targetProject.id);
    const nextRecentAreaTypeKeys = [
      newAreaForm.areaTypeKey,
      ...recentAreaTypeKeys.filter((key) => key !== newAreaForm.areaTypeKey),
    ].slice(0, 8);
    setRecentAreaTypeKeys(nextRecentAreaTypeKeys);
    localStorage.setItem(RECENT_AREA_TYPES_STORAGE_KEY, JSON.stringify(nextRecentAreaTypeKeys));
    setNewAreaForm(getDefaultAreaFormValue());
    setAreaTargetProjectId(null);
    setShowAddArea(false);
    await loadProjects();
  }

  const toggleProjectSelection = useCallback((id: string) => {
    setSelectedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleToggleProjectMenu = useCallback((id: string) => {
    setShowProjectMenuId((prev) => (prev === id ? null : id));
  }, []);

  const handleCloseProjectMenu = useCallback(() => {
    setShowProjectMenuId(null);
  }, []);

  const handleOpenProjectEditor = useCallback((project: Project) => {
    setEditingProject(project);
  }, []);

  const handleProjectCardLongPress = useCallback((projectId: string) => {
    setShowTrash(false);
    setDeleteMode(false);
    setExportMode(true);
    setSelectedAreaIds(new Set());
    setSelectedProjectIds(new Set([projectId]));
  }, []);

  const handleTrashedProjectLongPress = useCallback((projectId: string) => {
    setShowTrash(true);
    setDeleteMode(true);
    setExportMode(false);
    setSelectedAreaIds(new Set());
    setSelectedProjectIds(new Set([projectId]));
  }, []);

  const toggleAreaSelection = useCallback((id: string) => {
    setSelectedAreaIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  async function handleDeleteSelectedProjects() {
    if (selectedProjectIds.size === 0) return;
    if (showTrash) {
      const projectsToDelete = trashedProjects.filter((project) => selectedProjectIds.has(project.id));
      if (projectsToDelete.length === 0) return;

      for (const project of projectsToDelete) {
        markProjectDeleted(project.id);
        await deleteProject(project.id);
      }
      scheduleSync(undefined, { fullSync: true });
    } else {
      const projectsToTrash = activeProjects.filter((project) => selectedProjectIds.has(project.id));
      if (projectsToTrash.length === 0) return;

      for (const project of projectsToTrash) {
        project.deletedAt = new Date();
        await saveProject(project);
        dirtyProjectIdsRef.current.add(project.id);
      }
      scheduleSync();
    }

    setSelectedProjectIds(new Set());
    setDeleteMode(false);
    setExportMode(false);
    setActionSheet(null);
    await loadProjects();
  }

  async function handleTrashProject(project: Project) {
    project.deletedAt = new Date();
    await saveProject(project);
    scheduleSync(project.id);
    setShowProjectMenuId(null);
    await loadProjects();
  }

  async function handleDeleteSelectedAreas() {
    if (!singleProject) return;
    if (selectedAreaIds.size === 0) {
      setDeleteMode(false);
      return;
    }
    const now = new Date();
    singleProject.areas.forEach((area) => {
      if (selectedAreaIds.has(area.id)) {
        area.deletedAt = now;
      }
    });
    await saveProject(singleProject);
    scheduleSync(singleProject.id);
    setSelectedAreaIds(new Set());
    setDeleteMode(false);
    setActionSheet(null);
    await loadProjects();
  }

  async function handleRestoreProject(projectId: string) {
    const project = projects.find((entry) => entry.id === projectId);
    if (!project) return;
    delete project.deletedAt;
    await saveProject(project);
    scheduleSync(project.id);
    await loadProjects();
  }

  function handleExportSelectedConfirm() {
    if (exportingSelected || exportingSelectedToDrive || selectedProjectIds.size === 0) return;
    setActionSheet('export');
  }

  async function handleExportSelectedLocal() {
    if (exportingSelected || selectedProjectIds.size === 0) return;
    setActionSheet(null);
    setExportingSelected(true);
    try {
      const projectsToExport = [...sortedProjects]
        .filter((project) => selectedProjectIds.has(project.id))
        .sort((a, b) => a.projectName.localeCompare(b.projectName));
      const projectsForExport = projectsToExport.map((project) => ({
        ...project,
        areas: [...project.areas].sort((a, b) => a.name.localeCompare(b.name)),
      }));
      const blob = await generateMultiProjectPDF(projectsForExport);
      const filename = 'PunchList_Projects_Report.pdf';
      downloadPDF(blob, filename);
    } catch (error) {
      console.error('Failed to export selected projects:', error);
      alert('Failed to export selected projects. Please try again.');
    } finally {
      setExportingSelected(false);
      setExportMode(false);
      setSelectedProjectIds(new Set());
    }
  }

  async function handleExportSelectedToDrive() {
    if (exportingSelectedToDrive || selectedProjectIds.size === 0) return;
    setActionSheet(null);
    setExportingSelectedToDrive(true);
    try {
      const token = await ensureAccessToken();
      if (!token) {
        signIn();
        return;
      }
      const projectsToExport = [...sortedProjects]
        .filter((project) => selectedProjectIds.has(project.id))
        .sort((a, b) => a.projectName.localeCompare(b.projectName));
      const projectsForExport = projectsToExport.map((project) => ({
        ...project,
        areas: [...project.areas].sort((a, b) => a.name.localeCompare(b.name)),
      }));
      const blob = await generateMultiProjectPDF(projectsForExport);
      const filename = await getNextOneDriveExportFilename(
        token,
        projectsToExport.map((project) => project.projectName)
      );
      await uploadPdfToOneDrive(token, filename, blob);
    } catch (error) {
      console.error('Failed to export selected projects to OneDrive:', error);
      alert('Failed to export selected projects to OneDrive. Please try again.');
    } finally {
      setExportingSelectedToDrive(false);
      setExportMode(false);
      setSelectedProjectIds(new Set());
    }
  }

  async function handleEditProject(updates: Partial<Project>) {
    if (!editingProject) return;
    Object.assign(editingProject, updates);
    await saveProject(editingProject);
    scheduleSync(editingProject.id);
    setEditingProject(null);
    await loadProjects();
  }

  function cancelSelectionMode() {
    setDeleteMode(false);
    setExportMode(false);
    setActionSheet(null);
    setSelectedProjectIds(new Set());
    setSelectedAreaIds(new Set());
  }

  useEffect(() => {
    function handleHomeMenuAction(event: Event) {
      const customEvent = event as CustomEvent<{ action: string; sort?: SortOption }>;
      const detail = customEvent.detail;
      if (!detail) return;

      if (detail.action === 'sort' && detail.sort) {
        handleSortChange(detail.sort);
        return;
      }

      if (detail.action === 'new-project') {
        setShowNewProject(true);
        return;
      }

      if (detail.action === 'new-area') {
        if (singleProject) {
          setAreaTargetProjectId(singleProject.id);
          setShowAddArea(true);
        }
        return;
      }

      if (detail.action === 'toggle-trash') {
        toggleTrashView();
        return;
      }

      if (detail.action === 'clear-trash') {
        setShowTrash(false);
        setDeleteMode(false);
        setExportMode(false);
        setSelectedProjectIds(new Set());
        setSelectedAreaIds(new Set());
        return;
      }

      if (detail.action === 'edit-project' && singleProject) {
        handleOpenProjectEditor(singleProject);
        return;
      }

      if (detail.action === 'auth') {
        if (isSignedIn) signOut();
        else signIn();
      }
    }

    window.addEventListener('punchlist-home-menu-action', handleHomeMenuAction as EventListener);
    return () => {
      window.removeEventListener('punchlist-home-menu-action', handleHomeMenuAction as EventListener);
    };
  }, [isSignedIn, signIn, signOut, singleProject, sortOption, showTrash]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('punchlist-home-menu-state', {
        detail: {
          context: 'home',
          sortOption,
          showTrash,
          canAddArea: !!singleProject,
          isSingleProject: !!singleProject,
          singleProjectName: singleProject?.projectName ?? '',
        },
      })
    );
  }, [sortOption, showTrash, singleProject]);

  function toggleTrashView() {
    setShowTrash((current) => {
      const next = !current;
      if (next || current) {
        cancelSelectionMode();
      }
      return next;
    });
  }

  function handlePullStart(e: TouchEvent<HTMLElement>) {
    const atTop = (listRef.current?.scrollTop ?? 0) <= 0;
    if (!atTop || syncing) {
      pullStartYRef.current = null;
      return;
    }
    pullStartYRef.current = e.touches[0]?.clientY ?? null;
  }

  function handlePullMove(e: TouchEvent<HTMLElement>) {
    const atTop = (listRef.current?.scrollTop ?? 0) <= 0;
    if (pullStartYRef.current === null || !atTop || syncing) return;
    const currentY = e.touches[0]?.clientY ?? pullStartYRef.current;
    const delta = currentY - pullStartYRef.current;
    const armed = delta >= 90;
    if (armed !== pullArmedRef.current) {
      pullArmedRef.current = armed;
    }
  }

  function handlePullEnd() {
    pullStartYRef.current = null;
    if (pullArmedRef.current && !syncing) {
      void handleSync();
    }
    pullArmedRef.current = false;
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50 dark:bg-zinc-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500 dark:border-gray-300"></div>
      </div>
    );
  }

  return (
    <div className="app-page h-[calc(100dvh-env(safe-area-inset-top)-3.5rem)] flex flex-col overflow-hidden">
      {(singleProjectMainView || showTrash || selectionMode) && (
        <header className="header-stable shrink-0 border-b z-20">
          {(singleProjectMainView || showTrash) && (
            <div className="mx-auto flex h-[4.75rem] w-full max-w-6xl items-center px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1">
                {singleProjectMainView ? (
                  <>
                    <h1 className="truncate text-lg font-semibold tracking-[-0.01em] text-gray-900 dark:text-white">
                      {singleProject.projectName}
                    </h1>
                    <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">
                      {singleProject.address || 'Project dashboard'}
                    </p>
                  </>
                ) : (
                  <>
                    <h1 className="text-lg font-semibold tracking-[-0.01em] text-gray-900 dark:text-white">
                      Trash
                    </h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Recently removed projects stay here for 30 days.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
          {selectionMode && (
          <div className="mx-auto flex w-full max-w-6xl items-center gap-3 border-t border-gray-200 px-4 py-3 dark:border-gray-800 sm:px-5">
            <button
              onClick={cancelSelectionMode}
              className="text-sm font-medium text-gray-600 transition hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
            >
              Cancel
            </button>
            {!singleProjectMainView && !showTrash && (
              <button
                onClick={() => void handleExportSelectedConfirm()}
                disabled={exportingSelected || exportingSelectedToDrive || selectedProjectIds.size === 0}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700 transition hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-200 dark:hover:bg-zinc-700 disabled:opacity-40"
                aria-label="Export selected projects"
              >
                {exportingSelected || exportingSelectedToDrive ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4" />
                )}
              </button>
            )}
            <button
              onClick={() => {
                if (singleProjectMainView) {
                  if (selectedAreaIds.size === 0) return;
                } else if (selectedProjectIds.size === 0) {
                  return;
                }
                setActionSheet('delete');
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600 transition hover:bg-red-100 dark:bg-red-900/20 disabled:opacity-40"
              aria-label={singleProjectMainView ? 'Delete selected areas' : 'Delete selected projects'}
              disabled={singleProjectMainView ? selectedAreaIds.size === 0 : selectedProjectIds.size === 0}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          )}
        </header>
      )}
      {syncError && (
        <div className="shrink-0 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700">
          {syncError}
        </div>
      )}
      {syncConflicts.length > 0 && (
        <div className="shrink-0 px-4 py-2 text-sm border-b border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
          <div className="text-gray-700 dark:text-gray-200">Conflicts detected:</div>
          <div className="flex flex-wrap gap-2 mt-1">
            {syncConflicts.map((conflict) => (
              <span
                key={conflict.id}
                className="px-2 py-0.5 rounded-full bg-gray-100 border border-gray-300 text-gray-700 dark:bg-zinc-700 dark:border-zinc-600 dark:text-gray-200"
              >
                {conflict.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <main
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] sm:px-5"
        onTouchStart={handlePullStart}
        onTouchMove={handlePullMove}
        onTouchEnd={handlePullEnd}
        onTouchCancel={handlePullEnd}
      >
        {showTrash ? (
          trashedProjects.length === 0 ? (
          <div className="text-center py-12">
            <Trash2 className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Trash Is Empty</h2>
            <p className="text-gray-500 dark:text-gray-400">Deleted projects stay here for 30 days before permanent removal.</p>
          </div>
          ) : (
            <div className="list-stack mx-auto w-full max-w-6xl">
              {trashedProjects.map((project) => {
                const deletedAt = project.deletedAt ?? new Date();
                const expiresAt = new Date(deletedAt.getTime() + TRASH_RETENTION_MS);
                const isSelected = selectedProjectIds.has(project.id);
                const longPressRef = { current: null as ReturnType<typeof setTimeout> | null };
                return (
                  <div
                    key={project.id}
                    onContextMenu={(event) => {
                      if (!deleteMode) {
                        event.preventDefault();
                      }
                    }}
                    onClick={() => {
                      if (deleteMode) {
                        toggleProjectSelection(project.id);
                      }
                    }}
                    onPointerDown={() => {
                      if (!deleteMode) {
                        longPressRef.current = setTimeout(() => {
                          handleTrashedProjectLongPress(project.id);
                          longPressRef.current = null;
                        }, LONG_PRESS_MS);
                      }
                    }}
                    onPointerUp={() => {
                      if (longPressRef.current) {
                        clearTimeout(longPressRef.current);
                        longPressRef.current = null;
                      }
                    }}
                    onPointerCancel={() => {
                      if (longPressRef.current) {
                        clearTimeout(longPressRef.current);
                        longPressRef.current = null;
                      }
                    }}
                    onPointerLeave={() => {
                      if (longPressRef.current) {
                        clearTimeout(longPressRef.current);
                        longPressRef.current = null;
                      }
                    }}
                    className={`rounded-lg border p-4 transition-colors ${
                      isSelected
                        ? 'border-gray-500 bg-gray-200 dark:bg-zinc-700 dark:border-zinc-500'
                        : 'border-gray-300 bg-gray-50 dark:bg-zinc-800 dark:border-zinc-700'
                    } ${deleteMode ? 'cursor-pointer' : ''} select-none [-webkit-touch-callout:none]`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {deleteMode && (
                            <span
                              className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                                isSelected
                                  ? 'border-gray-600 bg-gray-600 text-white dark:border-gray-300 dark:bg-gray-300 dark:text-gray-900'
                                  : 'border-gray-400 text-transparent'
                              }`}
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </span>
                          )}
                          <div className="font-medium text-gray-900 dark:text-white truncate">{project.projectName}</div>
                        </div>
                        <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                          Deleted {deletedAt.toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          Permanently removed after {expiresAt.toLocaleDateString()}
                        </div>
                      </div>
                      {!deleteMode && (
                        <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => void handleRestoreProject(project.id)}
                          className="rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 flex items-center gap-1"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Restore
                        </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : singleProjectMainView ? (
          <div className="list-stack mx-auto min-h-[calc(100%+1px)] w-full max-w-6xl">
            {sortedAreas.length === 0 ? (
              <div className="flex min-h-[50vh] items-center justify-center py-12">
                <div className="w-full max-w-sm rounded-[1.75rem] border border-dashed border-gray-300 bg-white/70 p-8 text-center dark:border-zinc-700 dark:bg-zinc-800/70">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">No areas yet</h2>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Add the first area to turn this project into an active inspection dashboard.
                  </p>
                </div>
              </div>
            ) : (
              sortedAreas.map((area) => {
                const metric = areaMetrics.get(area.id);
                const isSelected = selectedAreaIds.has(area.id);
                return (
                  <HomeAreaCard
                    key={area.id}
                    projectId={singleProject.id}
                    area={area}
                    metric={metric}
                    deleteMode={deleteMode}
                    isSelected={isSelected}
                    onToggleSelection={toggleAreaSelection}
                  />
                );
              })
            )}
          </div>
        ) : (
          <div className="list-stack mx-auto min-h-[calc(100%+1px)] w-full max-w-6xl">
            {sortedProjects.length === 0 ? (
              <div className="flex min-h-[50vh] items-center justify-center py-12">
                <div className="w-full max-w-sm rounded-[1.75rem] border border-dashed border-gray-300 bg-white/70 p-8 text-center dark:border-zinc-700 dark:bg-zinc-800/70">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">No projects yet</h2>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Create a project to start tracking units, issues, and inspection progress.
                  </p>
                </div>
              </div>
            ) : (
              sortedProjects.map((project) => {
                const metric = projectMetrics.get(project.id);
                const isSelected = selectedProjectIds.has(project.id);
                return (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    metric={metric}
                    selectionMode={selectionMode}
                    isSelected={isSelected}
                    menuOpen={showProjectMenuId === project.id}
                    onToggleSelection={toggleProjectSelection}
                    onToggleMenu={handleToggleProjectMenu}
                    onCloseMenu={handleCloseProjectMenu}
                    onEditProject={handleOpenProjectEditor}
                    onDeleteProject={(project) => void handleTrashProject(project)}
                    onLongPressSelect={handleProjectCardLongPress}
                  />
                );
              })
            )}
          </div>
        )}
      </main>

      {!showTrash && !selectionMode && (
        <div className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] left-1/2 z-20 -translate-x-1/2">
          {singleProjectMainView ? (
            <div className="pointer-events-auto flex items-center gap-3">
              <button
                onClick={() => setShowNewProject(true)}
                className="inline-flex h-14 w-[10.5rem] items-center justify-center gap-2 rounded-full bg-zinc-700 px-5 text-sm font-semibold text-white shadow-xl shadow-black/20 transition hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
              >
                <Plus className="h-4 w-4" />
                Add Project
              </button>
              <button
                onClick={() => {
                  setAreaTargetProjectId(singleProject.id);
                  setShowAddArea(true);
                }}
                className="inline-flex h-14 w-[10.5rem] items-center justify-center gap-2 rounded-full bg-zinc-700 px-5 text-sm font-semibold text-white shadow-xl shadow-black/20 transition hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
              >
                <Plus className="h-4 w-4" />
                Add Area
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewProject(true)}
              className="pointer-events-auto inline-flex h-14 w-[10.5rem] items-center justify-center gap-2 rounded-full bg-zinc-700 px-5 text-sm font-semibold text-white shadow-xl shadow-black/20 transition hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
            >
              <Plus className="h-4 w-4" />
              Add Project
            </button>
          )}
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
          setAreaTargetProjectId(null);
          setNewAreaForm(getDefaultAreaFormValue());
        }}
        onSubmit={() => void handleAddArea()}
        submitLabel="Add"
      />

      {showAreaProjectPicker && !singleProjectMainView && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4 pointer-events-none">
          <div className="w-full max-w-md pointer-events-auto">
            <div className="rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 p-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Choose Project</h2>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Project
              </label>
              <select
                value={areaTargetProjectId ?? ''}
                onChange={(e) => setAreaTargetProjectId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
              >
                <option value="">Select project</option>
                {sortedProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.projectName}
                  </option>
                ))}
              </select>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowAreaProjectPicker(false);
                    setAreaTargetProjectId(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!areaTargetProjectId) return;
                    setShowAreaProjectPicker(false);
                    setShowAddArea(true);
                  }}
                  disabled={!areaTargetProjectId}
                  className="flex-1 px-4 py-2 bg-gray-900 text-white dark:bg-white dark:text-gray-900 rounded-lg font-medium hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Project Modal */}
      {showNewProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">New Project</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
                  placeholder="Enter project name"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={newProjectAddress}
                  onChange={(e) => setNewProjectAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
                  placeholder="Enter address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Inspected By
                </label>
                <input
                  type="text"
                  value={newProjectInspector}
                  onChange={(e) => setNewProjectInspector(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
                  placeholder="Enter inspector name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  GC Name
                </label>
                <input
                  type="text"
                  value={newProjectGcName}
                  onChange={(e) => setNewProjectGcName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white dark:bg-zinc-700 text-gray-900 dark:text-white"
                  placeholder="Enter GC name"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowNewProject(false);
                  setNewProjectName('');
                  setNewProjectAddress('');
                  setNewProjectInspector('');
                  setNewProjectGcName('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                disabled={!newProjectName.trim()}
                className="flex-1 px-4 py-2 bg-gray-900 text-white dark:bg-white dark:text-gray-900 rounded-lg font-medium hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {editingProject && (
        <ProjectEditModal
          project={editingProject}
          onSave={handleEditProject}
          onClose={() => setEditingProject(null)}
        />
      )}

      {actionSheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-md">
            <div className="rounded-2xl overflow-hidden bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700">
              {actionSheet === 'export' ? (
                <>
                  <button
                    onClick={() => void handleExportSelectedToDrive()}
                    className="w-full py-3 text-center text-[17px] text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700"
                  >
                    OneDrive
                  </button>
                  <button
                    onClick={() => void handleExportSelectedLocal()}
                    className="w-full py-3 text-center text-[17px] text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700"
                  >
                    Local
                  </button>
                  <button
                    onClick={() => setActionSheet(null)}
                    className="w-full py-3 text-center text-[17px] text-gray-900 dark:text-white"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      if (singleProjectMainView) {
                        void handleDeleteSelectedAreas();
                        return;
                      }
                      void handleDeleteSelectedProjects();
                    }}
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
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
