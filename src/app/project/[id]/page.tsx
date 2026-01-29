'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Project, Area, getProjectStats, getAreaStats } from '@/types';
import { getProject, saveProject, createArea } from '@/lib/db';
import { applyTemplateToArea } from '@/lib/template';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Building2,
  ChevronRight,
  Trash2,
  ArrowUpDown,
  CheckCircle,
  AlertTriangle,
  FileDown,
  MoreVertical,
  MapPin,
  User,
} from 'lucide-react';

type SortOption = 'name' | 'progress';

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddArea, setShowAddArea] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('name');
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    loadProject();
  }, [id]);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  const stats = getProjectStats(project);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-1 -ml-1 text-gray-600">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-lg font-semibold text-gray-900 truncate">
              {project.projectName}
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSortOption(sortOption === 'name' ? 'progress' : 'name')}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <ArrowUpDown className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowAddArea(true)}
              className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"
            >
              <Plus className="w-5 h-5" />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        // TODO: Export PDF
                        alert('PDF export coming soon!');
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <FileDown className="w-4 h-4" />
                      Export PDF
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Project Info */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        {project.address && (
          <p className="text-sm text-gray-600 flex items-center gap-1 mb-2">
            <MapPin className="w-4 h-4" />
            {project.address}
          </p>
        )}
        {project.inspector && (
          <p className="text-sm text-gray-600 flex items-center gap-1 mb-2">
            <User className="w-4 h-4" />
            {project.inspector}
          </p>
        )}
        <div className="flex items-center gap-6 mt-3">
          <div className="text-center">
            <div className="text-2xl font-semibold text-purple-600">{stats.areas}</div>
            <div className="text-xs text-gray-500">Areas</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-blue-600">{stats.total}</div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-green-600">{stats.ok}</div>
            <div className="text-xs text-gray-500">OK</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-orange-500">{stats.issues}</div>
            <div className="text-xs text-gray-500">Issues</div>
          </div>
        </div>
      </div>

      {/* Areas List */}
      <main className="p-4">
        {project.areas.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h2 className="text-lg font-medium text-gray-900 mb-2">No Areas</h2>
            <p className="text-gray-500 mb-4">Add an area to start inspecting</p>
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
              const progress =
                areaStats.total > 0 ? (areaStats.ok / areaStats.total) * 100 : 0;
              return (
                <Link
                  key={area.id}
                  href={`/project/${project.id}/area/${area.id}`}
                  className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{area.name}</h3>
                        {area.isComplete && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="text-gray-500">{areaStats.total} items</span>
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
                      </div>
                      {areaStats.total > 0 && (
                        <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
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
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
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
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Add Area</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Area Name *
              </label>
              <input
                type="text"
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
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
    </div>
  );
}
