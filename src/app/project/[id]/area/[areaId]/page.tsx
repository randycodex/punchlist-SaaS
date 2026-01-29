'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Project, Area, Location, Item, Checkpoint, getAreaStats, getLocationStats, getItemStats } from '@/types';
import { getProject, saveProject } from '@/lib/db';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
  Circle,
  MapPin,
  Wrench,
  MessageSquare,
  Camera,
  X,
} from 'lucide-react';

export default function AreaDetailPage({
  params,
}: {
  params: Promise<{ id: string; areaId: string }>;
}) {
  const { id, areaId } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [area, setArea] = useState<Area | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

  useEffect(() => {
    loadData();
  }, [id, areaId]);

  async function loadData() {
    try {
      const projectData = await getProject(id);
      if (projectData) {
        setProject(projectData);
        const areaData = projectData.areas.find((a) => a.id === areaId);
        if (areaData) {
          setArea(areaData);
        } else {
          router.push(`/project/${id}`);
        }
      } else {
        router.push('/');
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      router.push('/');
    } finally {
      setLoading(false);
    }
  }

  async function updateCheckpointStatus(
    locationId: string,
    itemId: string,
    checkpointId: string,
    newStatus: 'pending' | 'ok' | 'needsReview'
  ) {
    if (!project || !area) return;

    const location = area.locations.find((l) => l.id === locationId);
    if (!location) return;

    const item = location.items.find((i) => i.id === itemId);
    if (!item) return;

    const checkpoint = item.checkpoints.find((c) => c.id === checkpointId);
    if (!checkpoint) return;

    checkpoint.status = newStatus;
    checkpoint.updatedAt = new Date();
    await saveProject(project);
    setArea({ ...area });
  }

  async function saveComment(checkpointId: string) {
    if (!project || !area) return;

    for (const location of area.locations) {
      for (const item of location.items) {
        const checkpoint = item.checkpoints.find((c) => c.id === checkpointId);
        if (checkpoint) {
          checkpoint.comments = commentText;
          checkpoint.updatedAt = new Date();
          break;
        }
      }
    }

    await saveProject(project);
    setEditingComment(null);
    setCommentText('');
    setArea({ ...area });
  }

  function toggleLocation(locationId: string) {
    const newExpanded = new Set(expandedLocations);
    if (newExpanded.has(locationId)) {
      newExpanded.delete(locationId);
    } else {
      newExpanded.add(locationId);
    }
    setExpandedLocations(newExpanded);
  }

  function toggleItem(itemId: string) {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!project || !area) {
    return null;
  }

  const stats = getAreaStats(area);
  const progress = stats.total > 0 ? (stats.ok / stats.total) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/project/${project.id}`}
              className="p-1 -ml-1 text-gray-600"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-lg font-semibold text-gray-900 truncate">
              {area.name}
            </h1>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-xl font-semibold text-blue-600">{stats.total}</div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-semibold text-green-600">{stats.ok}</div>
            <div className="text-xs text-gray-500">OK</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-semibold text-orange-500">{stats.issues}</div>
            <div className="text-xs text-gray-500">Issues</div>
          </div>
          <div className="flex-1">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 text-right mt-1">
              {Math.round(progress)}%
            </div>
          </div>
        </div>
      </div>

      {/* Inspection Items */}
      <main className="p-4 space-y-2">
        {area.locations.map((location) => {
          const locationStats = getLocationStats(location);
          const isExpanded = expandedLocations.has(location.id);

          return (
            <div
              key={location.id}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden"
            >
              {/* Location Header */}
              <button
                onClick={() => toggleLocation(location.id)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-500" />
                  <span className="font-medium">{location.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  {locationStats.ok > 0 && (
                    <span className="text-green-600 flex items-center gap-1 text-sm">
                      <CheckCircle className="w-3 h-3" />
                      {locationStats.ok}
                    </span>
                  )}
                  {locationStats.issues > 0 && (
                    <span className="text-orange-500 flex items-center gap-1 text-sm">
                      <AlertTriangle className="w-3 h-3" />
                      {locationStats.issues}
                    </span>
                  )}
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Location Items */}
              {isExpanded && (
                <div className="border-t border-gray-100">
                  {location.items.map((item) => {
                    const itemStats = getItemStats(item);
                    const isItemExpanded = expandedItems.has(item.id);

                    return (
                      <div key={item.id} className="border-b border-gray-100 last:border-b-0">
                        {/* Item Header */}
                        <button
                          onClick={() => toggleItem(item.id)}
                          className="w-full px-4 py-2 pl-8 flex items-center justify-between hover:bg-gray-50"
                        >
                          <div className="flex items-center gap-2">
                            <Wrench className="w-3 h-3 text-orange-500" />
                            <span className="text-sm">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            {itemStats.ok > 0 && (
                              <span className="text-green-600 flex items-center gap-1 text-xs">
                                <CheckCircle className="w-3 h-3" />
                                {itemStats.ok}
                              </span>
                            )}
                            {itemStats.issues > 0 && (
                              <span className="text-orange-500 flex items-center gap-1 text-xs">
                                <AlertTriangle className="w-3 h-3" />
                                {itemStats.issues}
                              </span>
                            )}
                            {isItemExpanded ? (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                        </button>

                        {/* Checkpoints */}
                        {isItemExpanded && (
                          <div className="bg-gray-50 px-4 py-2 pl-12 space-y-2">
                            {item.checkpoints.map((checkpoint) => (
                              <CheckpointRow
                                key={checkpoint.id}
                                checkpoint={checkpoint}
                                onStatusChange={(status) =>
                                  updateCheckpointStatus(
                                    location.id,
                                    item.id,
                                    checkpoint.id,
                                    status
                                  )
                                }
                                onEditComment={() => {
                                  setEditingComment(checkpoint.id);
                                  setCommentText(checkpoint.comments);
                                }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </main>

      {/* Comment Modal */}
      {editingComment && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
          <div className="bg-white rounded-t-xl w-full max-w-lg p-4 pb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Add Comment</h3>
              <button
                onClick={() => {
                  setEditingComment(null);
                  setCommentText('');
                }}
                className="p-1 text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
              placeholder="Enter your comment..."
              autoFocus
            />
            <button
              onClick={() => saveComment(editingComment)}
              className="w-full mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600"
            >
              Save Comment
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckpointRow({
  checkpoint,
  onStatusChange,
  onEditComment,
}: {
  checkpoint: Checkpoint;
  onStatusChange: (status: 'pending' | 'ok' | 'needsReview') => void;
  onEditComment: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex-1">
        <span className="text-sm text-gray-700">{checkpoint.name}</span>
        {checkpoint.comments && (
          <p className="text-xs text-gray-500 mt-0.5">{checkpoint.comments}</p>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onEditComment}
          className={`p-1.5 rounded ${
            checkpoint.comments ? 'text-blue-500' : 'text-gray-300'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
        </button>
        <button
          onClick={() => onStatusChange('ok')}
          className={`p-1.5 rounded ${
            checkpoint.status === 'ok'
              ? 'bg-green-100 text-green-600'
              : 'text-gray-300 hover:text-green-500'
          }`}
        >
          <CheckCircle className="w-5 h-5" />
        </button>
        <button
          onClick={() => onStatusChange('needsReview')}
          className={`p-1.5 rounded ${
            checkpoint.status === 'needsReview'
              ? 'bg-orange-100 text-orange-600'
              : 'text-gray-300 hover:text-orange-500'
          }`}
        >
          <AlertTriangle className="w-5 h-5" />
        </button>
        <button
          onClick={() => onStatusChange('pending')}
          className={`p-1.5 rounded ${
            checkpoint.status === 'pending'
              ? 'bg-gray-200 text-gray-600'
              : 'text-gray-300 hover:text-gray-500'
          }`}
        >
          <Circle className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
