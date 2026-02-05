'use client';

import { useState, useEffect } from 'react';
import { Project, getProjectStats } from '@/types';
import { getAllProjects, saveProject, deleteProject, createProject } from '@/lib/db';
import { syncProjectsWithDrive, SyncConflict } from '@/lib/googleSync';
import { useGoogleAuth } from '@/contexts/GoogleAuthContext';
import Link from 'next/link';
import Image from 'next/image';
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
  const [sortOption, setSortOption] = useState<SortOption>('name');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncConflicts, setSyncConflicts] = useState<SyncConflict[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const { accessToken, isSignedIn, isReady, signIn, signOut } = useGoogleAuth();

  useEffect(() => {
    // Load saved sort preference
    const savedSort = localStorage.getItem(SORT_STORAGE_KEY) as SortOption;
    if (savedSort && ['name', 'recent', 'progress'].includes(savedSort)) {
      setSortOption(savedSort);
    }
    const lastSync = localStorage.getItem('punchlist-drive-last-sync');
    if (lastSync) {
      setLastSyncAt(lastSync);
    }
    loadProjects();
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    handleSync();
  }, [accessToken]);

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
    if (!accessToken || syncing) return;
    setSyncing(true);
    setSyncError(null);
    try {
      const result = await syncProjectsWithDrive(accessToken);
      setSyncConflicts(result.conflicts);
      setLastSyncAt(result.syncedAt);
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
    await saveProject(project);
    setNewProjectName('');
    setNewProjectAddress('');
    setNewProjectInspector('');
    setShowNewProject(false);
    loadProjects();
  }

  async function handleDeleteProject(id: string) {
    if (confirm('Are you sure you want to delete this project?')) {
      await deleteProject(id);
      loadProjects();
    }
  }

  const sortLabels: Record<SortOption, string> = {
    name: 'Name',
    recent: 'Recent',
    progress: 'Progress',
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-gray-900 pb-[env(safe-area-inset-bottom)]">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10 pt-[env(safe-area-inset-top)]">
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/uai-logo.png"
              alt="UAI Logo"
              width={40}
              height={40}
              className="object-contain"
            />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">PunchList</h1>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700" />
        <div className="px-4 py-3 flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            {isReady && (
              <>
                {!isSignedIn ? (
                  <button
                    onClick={signIn}
                    className="px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    Sign in
                  </button>
                ) : (
                  <button
                    onClick={signOut}
                    className="px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    Sign out
                  </button>
                )}
                <span className="text-gray-300 dark:text-gray-600">|</span>
              </>
            )}
            <button
              onClick={handleSync}
              disabled={!isSignedIn || syncing}
              className="px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50"
            >
              {syncing ? 'Syncing...' : 'Sync'}
            </button>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center justify-between gap-1 min-w-[6.5rem] px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              {sortLabels[sortOption]}
              <ChevronDown className="w-4 h-4" />
            </button>
            {showSortMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowSortMenu(false)}
                />
                <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20">
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
              </>
            )}
          </div>
          <button
            onClick={() => setShowNewProject(true)}
            className="ml-auto p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
            aria-label="Add project"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </header>
      {syncError && (
        <div className="px-4 py-2 text-sm text-red-600 bg-red-50 border-b border-red-100">
          {syncError}
        </div>
      )}
      {syncConflicts.length > 0 && (
        <div className="px-4 py-2 text-sm border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="text-orange-600">Conflicts detected:</div>
          <div className="flex flex-wrap gap-2 mt-1">
            {syncConflicts.map((conflict) => (
              <span
                key={conflict.id}
                className="px-2 py-0.5 rounded-full bg-orange-50 border border-orange-200"
              >
                {conflict.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <main className="p-4">
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
              return (
                <Link
                  key={project.id}
                  href={`/project/${project.id}`}
                  className="block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 dark:text-white">{project.projectName}</h3>
                      {project.address && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3" />
                          {project.address}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="text-gray-500 dark:text-gray-400">{stats.areas} areas</span>
                        {stats.ok > 0 && (
                          <span className="text-green-600 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            {stats.ok}
                          </span>
                        )}
                        {stats.issues > 0 && (
                          <span className="text-orange-500 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {stats.issues}
                          </span>
                        )}
                        {pending > 0 && (
                          <span className="text-gray-400 flex items-center gap-1">
                            <Circle className="w-3 h-3" />
                            {pending}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleDeleteProject(project.id);
                        }}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                </Link>
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
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowNewProject(false);
                  setNewProjectName('');
                  setNewProjectAddress('');
                  setNewProjectInspector('');
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
    </div>
  );
}
