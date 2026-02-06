'use client';

import { useState, useEffect, useRef, type TouchEvent } from 'react';
import { Project, getProjectStats } from '@/types';
import { getAllProjects, saveProject, deleteProject, createProject } from '@/lib/db';
import { syncProjectsWithOneDrive, SyncConflict, markProjectDeleted } from '@/lib/oneDriveSync';
import { generateMultiProjectPDF, downloadPDF } from '@/lib/pdfExport';
import { uploadPdfToOneDrive, getNextOneDriveExportFilename } from '@/lib/oneDrive';
import { useMicrosoftAuth } from '@/contexts/MicrosoftAuthContext';
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
} from 'lucide-react';

type SortOption = 'name' | 'recent' | 'progress';

const SORT_STORAGE_KEY = 'punchlist-projects-sort';

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
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [exportingSelected, setExportingSelected] = useState(false);
  const [exportingSelectedToDrive, setExportingSelectedToDrive] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showProjectMenuId, setShowProjectMenuId] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [pullArmed, setPullArmed] = useState(false);
  const pullStartYRef = useRef<number | null>(null);
  const listRef = useRef<HTMLElement | null>(null);
  const sortButtonRef = useRef<HTMLButtonElement | null>(null);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const { accessToken, signIn, ensureAccessToken } = useMicrosoftAuth();

  useEffect(() => {
    // Load saved sort preference
    const savedSort = localStorage.getItem(SORT_STORAGE_KEY) as SortOption;
    if (savedSort && ['name', 'recent', 'progress'].includes(savedSort)) {
      setSortOption(savedSort);
    }
    loadProjects();
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    void handleSync();
  }, [accessToken]);

  useEffect(() => {
    document.body.classList.toggle('sync-active', syncing);
    return () => {
      document.body.classList.remove('sync-active');
    };
  }, [syncing]);

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
    document.addEventListener('touchstart', onDocInteract, true);
    document.addEventListener('mousedown', onDocInteract, true);
    return () => {
      document.removeEventListener('touchstart', onDocInteract, true);
      document.removeEventListener('mousedown', onDocInteract, true);
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
      setProjects(data);
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
    try {
      const token = accessToken ?? (await ensureAccessToken());
      if (!token) {
        setSyncError('Please sign in to sync.');
        return;
      }
      const result = await syncProjectsWithOneDrive(token);
      setSyncConflicts(result.conflicts);
      await loadProjects();
    } catch (error) {
      console.error('Sync failed:', error);
      setSyncError('Sync failed. Please try again.');
    } finally {
      setSyncing(false);
    }
  }

  const sortedProjects = [...projects].sort((a, b) => {
    if (sortOption === 'name') {
      return a.projectName.localeCompare(b.projectName);
    } else if (sortOption === 'recent') {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    } else {
      const statsA = getProjectStats(a);
      const statsB = getProjectStats(b);
      const progressA = statsA.total > 0 ? statsA.ok / statsA.total : 0;
      const progressB = statsB.total > 0 ? statsB.ok / statsB.total : 0;
      return progressB - progressA;
    }
  });

  async function handleCreateProject() {
    if (!newProjectName.trim()) return;

    const project = createProject(newProjectName.trim(), newProjectAddress.trim(), newProjectInspector.trim());
    project.gcName = newProjectGcName.trim();
    await saveProject(project);
    setNewProjectName('');
    setNewProjectAddress('');
    setNewProjectInspector('');
    setNewProjectGcName('');
    setShowNewProject(false);
    await loadProjects();
  }

  function toggleProjectSelection(id: string) {
    setSelectedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleDeleteSelectedProjects() {
    if (selectedProjectIds.size === 0) {
      setDeleteMode(false);
      return;
    }
    if (!confirm(`Delete ${selectedProjectIds.size} selected project(s)?`)) return;
    for (const id of selectedProjectIds) {
      markProjectDeleted(id);
      await deleteProject(id);
    }
    setSelectedProjectIds(new Set());
    setDeleteMode(false);
    setExportMode(false);
    await loadProjects();
  }

  async function handleExportSelectedLocal() {
    if (exportingSelected || selectedProjectIds.size === 0) return;
    setShowExportMenu(false);
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
    setShowExportMenu(false);
    setExportingSelectedToDrive(true);
    try {
      const token = accessToken ?? (await ensureAccessToken());
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
    setShowExportMenu(false);
    setSelectedProjectIds(new Set());
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
    setPullArmed(delta >= 90);
  }

  function handlePullEnd() {
    pullStartYRef.current = null;
    if (pullArmed && !syncing) {
      void handleSync();
    }
    setPullArmed(false);
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
      <header className="header-stable shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-20">
        <div className="pl-2 pr-3 h-12 flex items-center gap-2">
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
            <button
              onClick={() => {
                if (deleteMode) {
                  void handleDeleteSelectedProjects();
                } else {
                  setDeleteMode(true);
                  setExportMode(false);
                  setShowExportMenu(false);
                  setSelectedProjectIds(new Set());
                }
              }}
              className={`h-9 w-9 flex items-center justify-center rounded-lg ${
                deleteMode
                  ? 'text-red-600 bg-red-50 dark:bg-red-900/20'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              aria-label="Select projects to delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <div className="relative">
              <button
              onClick={() => {
                if (!exportMode) {
                  setExportMode(true);
                  setDeleteMode(false);
                  setShowExportMenu(false);
                  setSelectedProjectIds(new Set());
                  return;
                }
                  if (selectedProjectIds.size === 0) {
                    setExportMode(false);
                    return;
                  }
                  setShowExportMenu(!showExportMenu);
                }}
                disabled={exportingSelected || exportingSelectedToDrive}
                className={`h-9 w-9 flex items-center justify-center rounded-lg disabled:opacity-50 ${
                  exportMode
                    ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                aria-label="Export selected projects"
              >
                {exportingSelected || exportingSelectedToDrive ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4" />
                )}
              </button>
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute right-0 mt-1 w-52 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20">
                    <button
                      onClick={handleExportSelectedLocal}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Export Selected PDF
                    </button>
                    <button
                      onClick={handleExportSelectedToDrive}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Export Selected to Drive
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <div className="w-[4.75rem] flex justify-end">
              {(deleteMode || exportMode) ? (
                <button
                  onClick={cancelSelectionMode}
                  className="h-9 px-3 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  Cancel
                </button>
              ) : null}
            </div>
            <button
              onClick={() => setShowNewProject(true)}
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
        {projects.length === 0 ? (
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
        ) : (
          <div className="space-y-2">
            {sortedProjects.map((project) => {
              const stats = getProjectStats(project);
              const pending = stats.total - stats.ok - stats.issues;
              const progress = stats.total > 0 ? (stats.ok / stats.total) * 100 : 0;
              const photoCount = project.areas.reduce(
                (sum, area) =>
                  sum +
                  area.locations.reduce(
                    (locSum, location) =>
                      locSum +
                      location.items.reduce(
                        (itemSum, item) =>
                          itemSum +
                          item.checkpoints.reduce((cpSum, checkpoint) => cpSum + checkpoint.photos.length, 0),
                        0
                      ),
                    0
                  ),
                0
              );
              const commentCount = project.areas.reduce(
                (sum, area) =>
                  sum +
                  area.locations.reduce(
                    (locSum, location) =>
                      locSum +
                      location.items.reduce(
                        (itemSum, item) =>
                          itemSum +
                          item.checkpoints.reduce(
                            (cpSum, checkpoint) => cpSum + (checkpoint.comments.trim() ? 1 : 0),
                            0
                          ),
                        0
                      ),
                    0
                  ),
                0
              );
              const isSelectionMode = deleteMode || exportMode;
              const isSelected = selectedProjectIds.has(project.id);
              return (
                <div
                  key={project.id}
                  onClick={() => {
                    if (isSelectionMode) {
                      toggleProjectSelection(project.id);
                    }
                  }}
                  className={`rounded-lg border p-4 transition-colors ${
                    isSelected
                      ? 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-700'
                      : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
                  } ${isSelectionMode ? 'cursor-pointer' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <Link
                      href={isSelectionMode ? '#' : `/project/${project.id}`}
                      onClick={(e) => {
                        if (isSelectionMode) e.preventDefault();
                      }}
                      className="flex-1 min-w-0"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="font-medium text-gray-900 dark:text-white truncate">
                          {project.projectName}
                        </h3>
                        <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0">
                          {stats.areas} areas
                        </span>
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
                          <div
                            className="h-full bg-green-500 transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      )}
                    </Link>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <button
                          onClick={() =>
                            setShowProjectMenuId((prev) => (prev === project.id ? null : project.id))
                          }
                          className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
                          aria-label={`Project actions for ${project.projectName}`}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {showProjectMenuId === project.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setShowProjectMenuId(null)}
                            />
                            <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20">
                              <button
                                onClick={() => {
                                  setShowProjectMenuId(null);
                                  setEditingProject(project);
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
                        href={isSelectionMode ? '#' : `/project/${project.id}`}
                        onClick={(e) => {
                          if (isSelectionMode) e.preventDefault();
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
    </div>
  );
}
