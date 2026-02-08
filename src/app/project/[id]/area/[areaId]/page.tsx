'use client';

import { useState, useEffect, useRef, type TouchEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Project, Area, Checkpoint, getAreaStats, getLocationStats, getItemStats } from '@/types';
import { getProject, saveProject, createPhotoAttachment } from '@/lib/db';
import { syncProjectsWithOneDrive } from '@/lib/oneDriveSync';
import { useMicrosoftAuth } from '@/contexts/MicrosoftAuthContext';
import PhotoCapture from '@/components/PhotoCapture';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
  Circle,
  Wrench,
  MessageSquare,
  X,
  Image as ImageIcon,
  Paperclip,
} from 'lucide-react';

export default function AreaDetailPage() {
  const params = useParams<{ id: string; areaId: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const areaId = Array.isArray(params.areaId) ? params.areaId[0] : params.areaId;
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [area, setArea] = useState<Area | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [editingCheckpoint, setEditingCheckpoint] = useState<{
    locationId: string;
    itemId: string;
    checkpointId: string;
  } | null>(null);
  const [commentText, setCommentText] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pullArmed, setPullArmed] = useState(false);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pullStartYRef = useRef<number | null>(null);
  const pullDistanceRef = useRef(0);
  const listRef = useRef<HTMLElement | null>(null);
  const { accessToken, ensureAccessToken } = useMicrosoftAuth();

  useEffect(() => {
    if (!id || !areaId) {
      router.push('/');
      return;
    }
    loadData();
  }, [id, areaId]);

  useEffect(() => {
    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
    };
  }, []);

  async function loadData() {
    if (!id || !areaId) return;
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

  function findCheckpoint(locationId: string, itemId: string, checkpointId: string): Checkpoint | null {
    if (!area) return null;
    const location = area.locations.find((l) => l.id === locationId);
    if (!location) return null;
    const item = location.items.find((i) => i.id === itemId);
    if (!item) return null;
    return item.checkpoints.find((c) => c.id === checkpointId) || null;
  }

  async function updateCheckpointStatus(
    locationId: string,
    itemId: string,
    checkpointId: string,
    newStatus: 'pending' | 'ok' | 'needsReview'
  ) {
    if (!project || !area) return;

    const checkpoint = findCheckpoint(locationId, itemId, checkpointId);
    if (!checkpoint) return;

    checkpoint.status = newStatus;
    checkpoint.updatedAt = new Date();
    await saveProject(project);
    scheduleSync();
    setArea({ ...area });
  }

  async function saveCheckpointChanges() {
    if (!project || !area || !editingCheckpoint) return;

    const checkpoint = findCheckpoint(
      editingCheckpoint.locationId,
      editingCheckpoint.itemId,
      editingCheckpoint.checkpointId
    );
    if (!checkpoint) return;

    checkpoint.comments = commentText;
    checkpoint.updatedAt = new Date();
    await saveProject(project);
    scheduleSync();
    setEditingCheckpoint(null);
    setCommentText('');
    setArea({ ...area });
  }

  async function handleAddPhoto(
    locationId: string,
    itemId: string,
    checkpointId: string,
    imageData: string,
    thumbnail: string
  ) {
    if (!project || !area) return;

    const checkpoint = findCheckpoint(locationId, itemId, checkpointId);
    if (!checkpoint) return;

    const photo = createPhotoAttachment(checkpointId, imageData, thumbnail);
    checkpoint.photos.push(photo);
    checkpoint.updatedAt = new Date();
    await saveProject(project);
    scheduleSync();
    setArea({ ...area });
  }

  async function handleDeletePhoto(
    locationId: string,
    itemId: string,
    checkpointId: string,
    photoId: string
  ) {
    if (!project || !area) return;

    const checkpoint = findCheckpoint(locationId, itemId, checkpointId);
    if (!checkpoint) return;

    checkpoint.photos = checkpoint.photos.filter((p) => p.id !== photoId);
    checkpoint.updatedAt = new Date();
    await saveProject(project);
    scheduleSync();
    setArea({ ...area });
  }

  async function handleDeleteFile(
    locationId: string,
    itemId: string,
    checkpointId: string,
    fileId: string
  ) {
    if (!project || !area) return;

    const checkpoint = findCheckpoint(locationId, itemId, checkpointId);
    if (!checkpoint) return;

    checkpoint.files = (checkpoint.files ?? []).filter((f) => f.id !== fileId);
    checkpoint.updatedAt = new Date();
    await saveProject(project);
    scheduleSync();
    setArea({ ...area });
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
      await loadData();
    } catch (error) {
      console.error('Sync failed:', error);
      setSyncError('Sync failed. Please try again.');
    } finally {
      setSyncing(false);
    }
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
    setPullArmed(delta >= 70);
  }

  function handlePullEnd() {
    pullStartYRef.current = null;
    if (pullDistanceRef.current >= 70 && !syncing) {
      void handleSync();
    }
    pullDistanceRef.current = 0;
    setPullArmed(false);
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

  function toggleLocation(locationId: string) {
    if (expandedLocations.has(locationId)) {
      // Collapse this location
      setExpandedLocations(new Set());
      setExpandedItems(new Set());
    } else {
      // Expand only this location, collapse others
      setExpandedLocations(new Set([locationId]));
      setExpandedItems(new Set());
    }
  }

  function toggleItem(itemId: string) {
    if (expandedItems.has(itemId)) {
      // Collapse this item
      setExpandedItems(new Set());
    } else {
      // Expand only this item, collapse others
      setExpandedItems(new Set([itemId]));
    }
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!project || !area) {
    return null;
  }

  const stats = getAreaStats(area);
  const remainingCount = stats.total - stats.ok - stats.issues;
  const progress = stats.total > 0 ? (stats.ok / stats.total) * 100 : 0;
  const editingCheckpointData = editingCheckpoint
    ? findCheckpoint(editingCheckpoint.locationId, editingCheckpoint.itemId, editingCheckpoint.checkpointId)
    : null;

  return (
    <div className="h-[calc(100dvh-env(safe-area-inset-top)-3.5rem)] bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
      {/* Header controls */}
      <header className="header-stable shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-20">
        <div className="pl-2 pr-3 h-12 flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 min-w-0">
            <Link
              href={`/project/${project.id}`}
              className="p-1 -ml-1 text-gray-600 dark:text-gray-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <span className="font-medium text-gray-700 dark:text-gray-200 truncate">
              {area.name}
            </span>
          </div>
          <div className="ml-auto" />
        </div>
      </header>

      {syncError && (
        <div className="shrink-0 px-4 py-2 text-sm text-red-600 bg-red-50 border-b border-red-100">
          {syncError}
        </div>
      )}

      {/* Stats */}
      <div className="pinned-surface shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="grid grid-cols-3 gap-2 w-full mb-3">
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
        <div className="w-full">
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">
            {Math.round(progress)}%
          </div>
        </div>
      </div>

      {/* Inspection Items */}
      <main
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+4rem)] space-y-2"
        onTouchStartCapture={handlePullStart}
        onTouchMoveCapture={handlePullMove}
        onTouchEndCapture={handlePullEnd}
        onTouchCancelCapture={handlePullEnd}
      >
        {area.locations.map((location) => {
          const locationStats = getLocationStats(location);
          const locationPhotoCount = location.items.reduce(
            (itemSum, item) =>
              itemSum + item.checkpoints.reduce((cpSum, checkpoint) => cpSum + checkpoint.photos.length, 0),
            0
          );
          const locationCommentCount = location.items.reduce(
            (itemSum, item) =>
              itemSum +
              item.checkpoints.reduce(
                (cpSum, checkpoint) => cpSum + (checkpoint.comments.trim() ? 1 : 0),
                0
              ),
            0
          );
          const isExpanded = expandedLocations.has(location.id);

          return (
            <div
              key={location.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              {/* Location Header */}
              <button
                onClick={() => toggleLocation(location.id)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-white">{location.name}</span>
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
                  {(locationStats.total - locationStats.ok - locationStats.issues) > 0 && (
                    <span className="text-gray-400 flex items-center gap-1 text-sm">
                      <Circle className="w-3 h-3" />
                      {locationStats.total - locationStats.ok - locationStats.issues}
                    </span>
                  )}
                  {locationPhotoCount > 0 && (
                    <span className="text-amber-500 flex items-center gap-1 text-sm">
                      <ImageIcon className="w-3 h-3" />
                      {locationPhotoCount}
                    </span>
                  )}
                  {locationCommentCount > 0 && (
                    <span className="text-sky-600 flex items-center gap-1 text-sm">
                      <MessageSquare className="w-3 h-3" />
                      {locationCommentCount}
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
                <div className="border-t border-gray-100 dark:border-gray-700">
                  {location.items.map((item) => {
                    const itemStats = getItemStats(item);
                    const itemPhotoCount = item.checkpoints.reduce(
                      (cpSum, checkpoint) => cpSum + checkpoint.photos.length,
                      0
                    );
                    const itemCommentCount = item.checkpoints.reduce(
                      (cpSum, checkpoint) => cpSum + (checkpoint.comments.trim() ? 1 : 0),
                      0
                    );
                    const isItemExpanded = expandedItems.has(item.id);

                    return (
                      <div key={item.id} className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                        {/* Item Header */}
                        <button
                          onClick={() => toggleItem(item.id)}
                          className="w-full px-4 py-2 pl-8 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <div className="flex items-center gap-2">
                            <Wrench className="w-3 h-3 text-orange-500" />
                            <span className="text-sm text-gray-900 dark:text-white">{item.name}</span>
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
                            {(itemStats.total - itemStats.ok - itemStats.issues) > 0 && (
                              <span className="text-gray-400 flex items-center gap-1 text-xs">
                                <Circle className="w-3 h-3" />
                                {itemStats.total - itemStats.ok - itemStats.issues}
                              </span>
                            )}
                            {itemPhotoCount > 0 && (
                              <span className="text-amber-500 flex items-center gap-1 text-xs">
                                <ImageIcon className="w-3 h-3" />
                                {itemPhotoCount}
                              </span>
                            )}
                            {itemCommentCount > 0 && (
                              <span className="text-sky-600 flex items-center gap-1 text-xs">
                                <MessageSquare className="w-3 h-3" />
                                {itemCommentCount}
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
                          <div className="bg-gray-50 dark:bg-gray-900 px-4 py-2 pl-12 space-y-3">
                            {item.checkpoints.map((checkpoint) => (
                              <div key={checkpoint.id} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <span className="text-sm text-gray-700 dark:text-gray-300">{checkpoint.name}</span>
                                    {checkpoint.comments && (
                                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{checkpoint.comments}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => {
                                        setEditingCheckpoint({
                                          locationId: location.id,
                                          itemId: item.id,
                                          checkpointId: checkpoint.id,
                                        });
                                        setCommentText(checkpoint.comments);
                                      }}
                                      className={`p-1.5 rounded ${
                                        checkpoint.comments || checkpoint.photos.length > 0
                                          ? 'text-blue-500'
                                          : 'text-gray-300 dark:text-gray-600'
                                      }`}
                                    >
                                      {(checkpoint.files?.length ?? 0) > 0 ? (
                                        <Paperclip className="w-4 h-4" />
                                      ) : checkpoint.photos.length > 0 ? (
                                        <ImageIcon className="w-4 h-4" />
                                      ) : (
                                        <MessageSquare className="w-4 h-4" />
                                      )}
                                    </button>
                                    <button
                                      onClick={() =>
                                        updateCheckpointStatus(location.id, item.id, checkpoint.id, 'ok')
                                      }
                                      className={`p-1.5 rounded ${
                                        checkpoint.status === 'ok'
                                          ? 'bg-green-100 dark:bg-green-900/30 text-green-600'
                                          : 'text-gray-300 dark:text-gray-600 hover:text-green-500'
                                      }`}
                                    >
                                      <CheckCircle className="w-5 h-5" />
                                    </button>
                                    <button
                                      onClick={() =>
                                        updateCheckpointStatus(location.id, item.id, checkpoint.id, 'needsReview')
                                      }
                                      className={`p-1.5 rounded ${
                                        checkpoint.status === 'needsReview'
                                          ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600'
                                          : 'text-gray-300 dark:text-gray-600 hover:text-orange-500'
                                      }`}
                                    >
                                      <AlertTriangle className="w-5 h-5" />
                                    </button>
                                    <button
                                      onClick={() =>
                                        updateCheckpointStatus(location.id, item.id, checkpoint.id, 'pending')
                                      }
                                      className={`p-1.5 rounded ${
                                        checkpoint.status === 'pending'
                                          ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                          : 'text-gray-300 dark:text-gray-600 hover:text-gray-500'
                                      }`}
                                    >
                                      <Circle className="w-5 h-5" />
                                    </button>
                                  </div>
                                </div>
                                {/* Inline photo thumbnails */}
                                {checkpoint.photos.length > 0 && (
                                  <div className="flex gap-1 overflow-x-auto">
                                    {checkpoint.photos.map((photo) => (
                                      <img
                                        key={photo.id}
                                        src={photo.thumbnail}
                                        alt=""
                                        className="w-10 h-10 rounded object-cover flex-shrink-0 cursor-pointer"
                                        onClick={() => {
                                          setEditingCheckpoint({
                                            locationId: location.id,
                                            itemId: item.id,
                                            checkpointId: checkpoint.id,
                                          });
                                          setCommentText(checkpoint.comments);
                                        }}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
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

      {/* Edit Checkpoint Modal */}
      {editingCheckpoint && editingCheckpointData && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-t-xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">{editingCheckpointData.name}</h3>
              <button
                onClick={() => {
                  setEditingCheckpoint(null);
                  setCommentText('');
                }}
                className="p-1 text-gray-500 dark:text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Photos */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Photos & Files
                </label>
                <PhotoCapture
                  photos={editingCheckpointData.photos}
                  files={editingCheckpointData.files ?? []}
                  onAddPhoto={(imageData, thumbnail) =>
                    handleAddPhoto(
                      editingCheckpoint.locationId,
                      editingCheckpoint.itemId,
                      editingCheckpoint.checkpointId,
                      imageData,
                      thumbnail
                    )
                  }
                  onDeletePhoto={(photoId) =>
                    handleDeletePhoto(
                      editingCheckpoint.locationId,
                      editingCheckpoint.itemId,
                      editingCheckpoint.checkpointId,
                      photoId
                    )
                  }
                  onDeleteFile={(fileId) =>
                    handleDeleteFile(
                      editingCheckpoint.locationId,
                      editingCheckpoint.itemId,
                      editingCheckpoint.checkpointId,
                      fileId
                    )
                  }
                />
              </div>

              {/* Comment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Comment
                </label>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Enter your comment..."
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
              <button
                onClick={saveCheckpointChanges}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
