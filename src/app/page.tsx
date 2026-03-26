'use client';

import { memo, useState, useEffect, useMemo, useRef, useCallback, type TouchEvent } from 'react';
import { Project, getProjectStats, getReviewMetrics } from '@/types';
import { getAllProjects, saveProject, deleteProject, createProject } from '@/lib/db';
import { syncProjectsWithOneDrive, pushProjectsToOneDrive, SyncConflict, markProjectDeleted } from '@/lib/oneDriveSync';
import { generateMultiProjectPDF, downloadPDF } from '@/lib/pdfExport';
import { uploadPdfToOneDrive, getNextOneDriveExportFilename } from '@/lib/oneDrive';
import { getMicrosoftErrorMessage } from '@/lib/microsoftErrors';
import { useMicrosoftAuth } from '@/contexts/MicrosoftAuthContext';
import { useSyncStatus } from '@/contexts/SyncStatusContext';
import ProjectEditModal from '@/components/ProjectEditModal';
import Link from 'next/link';
import {
  Plus,
  Building2,
  MapPin,
  ChevronRight,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Circle,
  ChevronDown,
  FileDown,
  Loader2,
  MoreVertical,
  Pencil,
  Image as ImageIcon,
  MessageSquare,
  RotateCcw,
} from 'lucide-react';

type SortOption = 'name' | 'recent' | 'progress';

const SORT_STORAGE_KEY = 'punchlist-projects-sort';
const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

type ProjectMetrics = {
  stats: ReturnType<typeof getProjectStats>;
  pending: number;
  progress: number;
  okPercent: number;
  issuePercent: number;
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
}: ProjectCardProps) {
  const stats = metric?.stats ?? { total: 0, ok: 0, issues: 0, areas: project.areas.length };
  const pending = metric?.pending ?? 0;
  const progress = metric?.progress ?? 0;
  const photoCount = metric?.photoCount ?? 0;
  const commentCount = metric?.commentCount ?? 0;

  return (
    <div
      onClick={() => {
        if (selectionMode) {
          onToggleSelection(project.id);
        }
      }}
      className={`rounded-lg border p-4 transition-colors ${
        isSelected
          ? 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-700'
          : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
      } ${selectionMode ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start gap-3">
        <Link
          href={selectionMode ? '#' : `/project/${project.id}`}
          onClick={(event) => {
            if (selectionMode) event.preventDefault();
          }}
          className="flex-1 min-w-0"
        >
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-medium text-gray-900 dark:text-white truncate">{project.projectName}</h3>
            <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0">{stats.areas} areas</span>
          </div>
          {project.address && (
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3" />
              {project.address}
            </p>
          )}
          <div className="flex items-center gap-4 mt-2 text-sm">
            {pending > 0 && (
              <span className="text-gray-400 flex items-center gap-1">
                <Circle className="w-3 h-3" />
                {pending}
              </span>
            )}
            {stats.issues > 0 && (
              <span className="text-orange-500 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {stats.issues}
              </span>
            )}
            {stats.ok > 0 && (
              <span className="text-green-600 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                {stats.ok}
              </span>
            )}
            {photoCount > 0 && (
              <span className="text-amber-500 flex items-center gap-1">
                <ImageIcon className="w-3 h-3" />
                {photoCount}
              </span>
            )}
            {commentCount > 0 && (
              <span className="text-sky-600 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {commentCount}
              </span>
            )}
          </div>
          {stats.total > 0 && (
            <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
        </Link>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => onToggleMenu(project.id)}
              className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
              aria-label={`Project actions for ${project.projectName}`}
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={onCloseMenu} />
                <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20">
                  <button
                    onClick={() => {
                      onCloseMenu();
                      onEditProject(project);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit Project
                  </button>
                </div>
              </>
            )}
          </div>
          <Link
            href={selectionMode ? '#' : `/project/${project.id}`}
            onClick={(event) => {
              if (selectionMode) event.preventDefault();
            }}
            className="p-1 text-gray-400 hover:text-blue-500"
            aria-label={`Open ${project.projectName}`}
          >
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
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
  const [showSortMenu, setShowSortMenu] = useState(false);
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
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backgroundSyncInFlightRef = useRef(false);
  const backgroundSyncQueuedRef = useRef(false);
  const dirtyProjectIdsRef = useRef<Set<string>>(new Set());
  const fullSyncNeededRef = useRef(false);
  const pullStartYRef = useRef<number | null>(null);
  const pullArmedRef = useRef(false);
  const listRef = useRef<HTMLElement | null>(null);
  const sortButtonRef = useRef<HTMLButtonElement | null>(null);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const { accessToken, signIn, ensureAccessToken } = useMicrosoftAuth();
  const { setStatus: setSyncStatus } = useSyncStatus();
  const selectionMode = deleteMode || exportMode;

  useEffect(() => {
    // Load saved sort preference
    const savedSort = localStorage.getItem(SORT_STORAGE_KEY) as SortOption;
    if (savedSort && ['name', 'recent', 'progress'].includes(savedSort)) {
      setSortOption(savedSort);
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

  function handleSortChange(option: SortOption) {
    setSortOption(option);
    localStorage.setItem(SORT_STORAGE_KEY, option);
    setShowSortMenu(false);
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
          markProjectDeleted(project.id, project.deletedAt);
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

      await pushProjectsToOneDrive(token, dirtyProjectIds);
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

  async function handleDeleteSelectedProjects() {
    if (selectedProjectIds.size === 0) return;
    const projectsToTrash = activeProjects.filter((project) => selectedProjectIds.has(project.id));
    if (projectsToTrash.length === 0) return;

    for (const project of projectsToTrash) {
      project.deletedAt = new Date();
      await saveProject(project);
      dirtyProjectIdsRef.current.add(project.id);
    }
    scheduleSync();

    setSelectedProjectIds(new Set());
    setDeleteMode(false);
    setExportMode(false);
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

  async function handlePermanentDelete(project: Project) {
    if (!window.confirm(`Permanently delete "${project.projectName}"? This cannot be undone.`)) {
      return;
    }
    markProjectDeleted(project.id, project.deletedAt ?? new Date());
    await deleteProject(project.id);
    scheduleSync(undefined, { fullSync: true });
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

  const sortLabels: Record<SortOption, string> = {
    name: 'Name',
    recent: 'Recent',
    progress: 'Progress',
  };

  function cancelSelectionMode() {
    setDeleteMode(false);
    setExportMode(false);
    setActionSheet(null);
    setSelectedProjectIds(new Set());
  }

  function toggleTrashView() {
    setShowTrash((current) => {
      const next = !current;
      if (next) {
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
      <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100dvh-env(safe-area-inset-top)-3.5rem)] bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
      {/* Header controls */}
      <header className="header-stable shrink-0 border-b z-20">
        <div className="header-row">
          <div className="flex items-center gap-2 min-w-0">
            <div className="relative">
              <button
                ref={sortButtonRef}
                onClick={() => setShowSortMenu(!showSortMenu)}
                className="h-9 flex items-center justify-between gap-1 min-w-[6.5rem] px-3 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg shrink-0"
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
            {!selectionMode && !showTrash ? (
              <button
                onClick={() => {
                  setDeleteMode(true);
                  setExportMode(false);
                  setSelectedProjectIds(new Set());
                }}
                className="h-9 px-3 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Select
              </button>
            ) : !showTrash ? (
              <>
                <button
                  onClick={cancelSelectionMode}
                  className="h-9 px-3 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleExportSelectedConfirm()}
                  disabled={exportingSelected || exportingSelectedToDrive || selectedProjectIds.size === 0}
                  className="h-9 w-9 flex items-center justify-center rounded-lg text-blue-600 bg-blue-50 dark:bg-blue-900/20 disabled:opacity-40"
                  aria-label="Export selected projects"
                >
                  {exportingSelected || exportingSelectedToDrive ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileDown className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => {
                    if (selectedProjectIds.size === 0) return;
                    setActionSheet('delete');
                  }}
                  className="h-9 w-9 flex items-center justify-center rounded-lg text-red-600 bg-red-50 dark:bg-red-900/20 disabled:opacity-40"
                  aria-label="Delete selected projects"
                  disabled={selectedProjectIds.size === 0}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                onClick={toggleTrashView}
                className="h-9 px-3 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Projects
              </button>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <button
              onClick={toggleTrashView}
              className={`h-9 px-3 text-sm rounded-lg flex items-center gap-1 ${
                showTrash
                  ? 'text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              {trashedProjects.length > 0 ? `Trash (${trashedProjects.length})` : 'Trash'}
            </button>
            <button
              onClick={() => setShowNewProject(true)}
              disabled={showTrash}
              className="h-9 w-9 flex items-center justify-center text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
              aria-label="Add project"
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
      {syncConflicts.length > 0 && (
        <div className="shrink-0 px-4 py-2 text-sm border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="text-orange-600">Conflicts detected:</div>
          <div className="flex flex-wrap gap-2 mt-1">
            {syncConflicts.map((conflict) => (
              <span
                key={conflict.id}
                className="px-2 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-700 dark:bg-orange-900/20 dark:border-orange-700 dark:text-orange-300"
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
        className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+6rem)]"
        onTouchStart={handlePullStart}
        onTouchMove={handlePullMove}
        onTouchEnd={handlePullEnd}
        onTouchCancel={handlePullEnd}
      >
        {!showTrash && activeProjects.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Projects</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4">Create a new project to get started</p>
            <button
              onClick={() => setShowNewProject(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600"
            >
              New Project
            </button>
          </div>
        ) : showTrash ? (
          trashedProjects.length === 0 ? (
            <div className="text-center py-12">
              <Trash2 className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Trash Is Empty</h2>
              <p className="text-gray-500 dark:text-gray-400">Deleted projects stay here for 30 days before permanent removal.</p>
            </div>
          ) : (
            <div className="list-stack">
              {trashedProjects.map((project) => {
                const deletedAt = project.deletedAt ?? new Date();
                const expiresAt = new Date(deletedAt.getTime() + TRASH_RETENTION_MS);
                return (
                  <div
                    key={project.id}
                    className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white truncate">{project.projectName}</div>
                        <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                          Deleted {deletedAt.toLocaleDateString()}
                        </div>
                        <div className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                          Permanently removed after {expiresAt.toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => void handleRestoreProject(project.id)}
                          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 flex items-center gap-1"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Restore
                        </button>
                        <button
                          onClick={() => void handlePermanentDelete(project)}
                          className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 text-sm text-red-700 dark:text-red-300"
                        >
                          Delete Now
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="list-stack">
            {sortedProjects.map((project) => {
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
                />
              );
            })}
          </div>
        )}
      </main>

      {/* New Project Modal */}
      {showNewProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6">
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
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
            <div className="rounded-2xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              {actionSheet === 'export' ? (
                <>
                  <button
                    onClick={() => void handleExportSelectedToDrive()}
                    className="w-full py-3 text-center text-[17px] text-blue-600 border-b border-gray-200 dark:border-gray-700"
                  >
                    OneDrive
                  </button>
                  <button
                    onClick={() => void handleExportSelectedLocal()}
                    className="w-full py-3 text-center text-[17px] text-blue-600 border-b border-gray-200 dark:border-gray-700"
                  >
                    Local
                  </button>
                  <button
                    onClick={() => setActionSheet(null)}
                    className="w-full py-3 text-center text-[17px] text-blue-600"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => void handleDeleteSelectedProjects()}
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
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
