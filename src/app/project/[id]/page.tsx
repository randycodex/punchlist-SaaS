'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Project, Area, getProjectStats, getAreaStats } from '@/types';
import { getProject, saveProject, createArea } from '@/lib/db';
import { applyTemplateToArea } from '@/lib/template';
import { generateProjectPDF, downloadPDF } from '@/lib/pdfExport';
import ProjectEditModal from '@/components/ProjectEditModal';
import Link from 'next/link';
import Image from 'next/image';
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
  FileDown,
  MoreVertical,
  MapPin,
  User,
  Pencil,
  Loader2,
} from 'lucide-react';

type SortOption = 'name' | 'recent' | 'progress';

const SORT_STORAGE_KEY = 'punchlist-areas-sort';

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddArea, setShowAddArea] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('name');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [exporting, setExporting] = useState(false);

  const sortLabels: Record<SortOption, string> = {
    name: 'Name',
    recent: 'Recent',
    progress: 'Progress',
  };

  useEffect(() => {
    // Load saved sort preference
    const savedSort = localStorage.getItem(SORT_STORAGE_KEY) as SortOption;
    if (savedSort && ['name', 'recent', 'progress'].includes(savedSort)) {
      setSortOption(savedSort);
    }
    loadProject();
  }, [id]);

  function handleSortChange(option: SortOption) {
    setSortOption(option);
    localStorage.setItem(SORT_STORAGE_KEY, option);
    setShowSortMenu(false);
  }

  async function loadProject() {
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

  const sortedAreas = project?.areas
    ? [...project.areas].sort((a, b) => {
        if (sortOption === 'name') {
          return a.name.localeCompare(b.name);
        } else if (sortOption === 'recent') {
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        } else {
          const statsA = getAreaStats(a);
          const statsB = getAreaStats(b);
          const progressA = statsA.total > 0 ? statsA.ok / statsA.total : 0;
          const progressB = statsB.total > 0 ? statsB.ok / statsB.total : 0;
          return progressB - progressA;
        }
      })
    : [];

  async function handleAddArea() {
    if (!project || !newAreaName.trim()) return;

    const area = createArea(project.id, newAreaName.trim(), project.areas.length);
    applyTemplateToArea(area);
    project.areas.push(area);
    await saveProject(project);
    setNewAreaName('');
    setShowAddArea(false);
    loadProject();
  }

  async function handleDeleteArea(areaId: string) {
    if (!project) return;
    if (confirm('Are you sure you want to delete this area?')) {
      project.areas = project.areas.filter((a) => a.id !== areaId);
      await saveProject(project);
      loadProject();
    }
  }

  async function handleEditProject(updates: Partial<Project>) {
    if (!project) return;
    Object.assign(project, updates);
    await saveProject(project);
    setShowEditProject(false);
    loadProject();
  }

  async function handleExportPDF() {
    if (!project) return;
    setShowMenu(false);
    setExporting(true);
    try {
      const blob = await generateProjectPDF(project);
      const filename = `${project.projectName.replace(/[^a-z0-9]/gi, '_')}_Report.pdf`;
      downloadPDF(blob, filename);
    } catch (error) {
      console.error('Failed to export PDF:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  const stats = getProjectStats(project);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-1 -ml-1 text-gray-600 dark:text-gray-300">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Image
              src="/uai-logo.png"
              alt="UAI Logo"
              width={32}
              height={32}
              className="object-contain"
            />
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
              {project.projectName}
            </h1>
          </div>
          <div className="flex items-center gap-1">
            {/* Sort dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSortMenu(!showSortMenu)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
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
              onClick={() => setShowAddArea(true)}
              className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
            >
              <Plus className="w-5 h-5" />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20">
                    <button
                      onClick={handleExportPDF}
                      disabled={exporting}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 disabled:opacity-50"
                    >
                      {exporting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FileDown className="w-4 h-4" />
                      )}
                      Export PDF
                    </button>
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        setShowEditProject(true);
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
          </div>
        </div>
      </header>

      {/* Project Info */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
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
        <div className="flex items-center gap-6 mt-3">
          <div className="text-center">
            <div className="text-2xl font-semibold text-purple-600">{stats.areas}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Areas</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-blue-600">{stats.total}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-green-600">{stats.ok}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">OK</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-orange-500">{stats.issues}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Issues</div>
          </div>
        </div>
      </div>

      {/* Areas List */}
      <main className="p-4">
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
          <div className="space-y-2">
            {sortedAreas.map((area) => {
              const areaStats = getAreaStats(area);
              const pending = areaStats.total - areaStats.ok - areaStats.issues;
              const progress =
                areaStats.total > 0 ? (areaStats.ok / areaStats.total) * 100 : 0;
              return (
                <Link
                  key={area.id}
                  href={`/project/${project.id}/area/${area.id}`}
                  className="block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 dark:text-white">{area.name}</h3>
                        {area.isComplete && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="text-gray-500 dark:text-gray-400">{areaStats.total} items</span>
                        {areaStats.ok > 0 && (
                          <span className="text-green-600 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            {areaStats.ok}
                          </span>
                        )}
                        {areaStats.issues > 0 && (
                          <span className="text-orange-500 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {areaStats.issues}
                          </span>
                        )}
                        {pending > 0 && (
                          <span className="text-gray-400 flex items-center gap-1">
                            <Circle className="w-3 h-3" />
                            {pending}
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
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleDeleteArea(area.id);
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

      {/* Edit Project Modal */}
      {showEditProject && (
        <ProjectEditModal
          project={project}
          onSave={handleEditProject}
          onClose={() => setShowEditProject(false)}
        />
      )}

      {/* Export loading overlay */}
      {exporting && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 flex items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span className="text-gray-900 dark:text-white">Generating PDF...</span>
          </div>
        </div>
      )}
    </div>
  );
}
