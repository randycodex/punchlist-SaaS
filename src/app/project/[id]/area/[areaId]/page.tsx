'use client';

import { useState, useEffect, useMemo, useRef, type TouchEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Project, Area, Checkpoint, getReviewMetrics } from '@/types';
import { getProject, saveProject, createPhotoAttachment, createLocation, createItem, createCheckpoint } from '@/lib/db';
import { getMicrosoftErrorMessage } from '@/lib/microsoftErrors';
import AreaEditorModal from '@/components/AreaEditorModal';
import {
  areaHasRecordedActivity,
  buildAreaName,
  getAreaFormValue,
  isApartmentArea,
  type AreaTypeKey,
} from '@/lib/areas';
import { applyTemplateToArea } from '@/lib/template';
import { pushProjectsToOneDrive, syncProjectsWithOneDrive } from '@/lib/oneDriveSync';
import { useMicrosoftAuth } from '@/contexts/MicrosoftAuthContext';
import { useSyncStatus } from '@/contexts/SyncStatusContext';
import PhotoCapture from '@/components/PhotoCapture';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Circle,
  Wrench,
  MessageSquare,
  Pencil,
  X,
  Image as ImageIcon,
  Paperclip,
} from 'lucide-react';

const RECENT_COMMENTS_STORAGE_KEY = 'punchlist-recent-comments';
const RECENT_AREA_TYPES_STORAGE_KEY = 'punchlist-recent-area-types';
const CUSTOM_ITEMS_LOCATION_NAME = 'Custom Items';
const OTHER_LOCATION_NAME = 'Other';

type StatusMetrics = {
  total: number;
  ok: number;
  issues: number;
};

type ItemMetrics = {
  stats: StatusMetrics;
  pending: number;
  photoCount: number;
  commentCount: number;
};

type LocationMetrics = {
  stats: StatusMetrics;
  pending: number;
  photoCount: number;
  commentCount: number;
};

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
  const [recentComments, setRecentComments] = useState<string[]>([]);
  const [showEditArea, setShowEditArea] = useState(false);
  const [areaForm, setAreaForm] = useState(getAreaFormValue());
  const [recentAreaTypeKeys, setRecentAreaTypeKeys] = useState<AreaTypeKey[]>([]);
  const [customItemName, setCustomItemName] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [generalNotes, setGeneralNotes] = useState('');
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backgroundSyncInFlightRef = useRef(false);
  const backgroundSyncQueuedRef = useRef(false);
  const dirtyProjectIdsRef = useRef<Set<string>>(new Set());
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notesDraftRef = useRef('');
  const pullStartYRef = useRef<number | null>(null);
  const pullDistanceRef = useRef(0);
  const pullArmedRef = useRef(false);
  const listRef = useRef<HTMLElement | null>(null);
  const itemRefs = useRef(new Map<string, HTMLDivElement | null>());
  const { ensureAccessToken } = useMicrosoftAuth();
  const { setStatus: setSyncStatus } = useSyncStatus();

  useEffect(() => {
    if (!id || !areaId) {
      router.push('/');
      return;
    }
    const savedRecentComments = localStorage.getItem(RECENT_COMMENTS_STORAGE_KEY);
    if (savedRecentComments) {
      try {
        setRecentComments(JSON.parse(savedRecentComments) as string[]);
      } catch (error) {
        console.error('Failed to parse recent comments:', error);
      }
    }
    const savedRecentAreaTypes = localStorage.getItem(RECENT_AREA_TYPES_STORAGE_KEY);
    if (savedRecentAreaTypes) {
      try {
        setRecentAreaTypeKeys(JSON.parse(savedRecentAreaTypes) as AreaTypeKey[]);
      } catch (error) {
        console.error('Failed to parse recent area types:', error);
      }
    }
    loadData();
  }, [id, areaId]);

  useEffect(() => {
    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
      backgroundSyncInFlightRef.current = false;
      backgroundSyncQueuedRef.current = false;
      if (notesTimerRef.current) {
        clearTimeout(notesTimerRef.current);
        void persistGeneralNotes(notesDraftRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const value = area?.notes ?? '';
    setGeneralNotes(value);
    notesDraftRef.current = value;
  }, [area?.id, area?.notes]);

  useEffect(() => {
    setAreaForm(getAreaFormValue(area));
  }, [area]);

  async function loadData() {
    if (!id || !areaId) return;
    try {
      const projectData = await getProject(id);
      if (projectData) {
        if (projectData.deletedAt) {
          router.push('/');
          return;
        }
        setProject(projectData);
        const areaData = projectData.areas.find((a) => a.id === areaId);
        if (areaData && !areaData.deletedAt) {
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

  const areaDerived = useMemo(() => {
    if (!area) return null;

    const locationMetrics = new Map<string, LocationMetrics>();
    const itemMetrics = new Map<string, ItemMetrics>();

    let total = 0;
    let ok = 0;
    let issues = 0;

    for (const location of area.locations) {
      let locationTotal = 0;
      let locationOk = 0;
      let locationIssues = 0;
      let locationPhotoCount = 0;
      let locationCommentCount = 0;

      for (const item of location.items) {
        let itemTotal = 0;
        let itemOk = 0;
        let itemIssues = 0;
        let itemPhotoCount = 0;
        let itemCommentCount = 0;

        for (const checkpoint of item.checkpoints) {
          itemTotal += 1;
          if (checkpoint.status === 'ok') itemOk += 1;
          else if (checkpoint.status === 'needsReview') itemIssues += 1;
          itemPhotoCount += checkpoint.photos.length;
          if (checkpoint.comments.trim()) itemCommentCount += 1;
        }

        const itemPending = itemTotal - itemOk - itemIssues;
        itemMetrics.set(item.id, {
          stats: { total: itemTotal, ok: itemOk, issues: itemIssues },
          pending: itemPending,
          photoCount: itemPhotoCount,
          commentCount: itemCommentCount,
        });

        locationTotal += itemTotal;
        locationOk += itemOk;
        locationIssues += itemIssues;
        locationPhotoCount += itemPhotoCount;
        locationCommentCount += itemCommentCount;
      }

      const locationPending = locationTotal - locationOk - locationIssues;
      locationMetrics.set(location.id, {
        stats: { total: locationTotal, ok: locationOk, issues: locationIssues },
        pending: locationPending,
        photoCount: locationPhotoCount,
        commentCount: locationCommentCount,
      });

      total += locationTotal;
      ok += locationOk;
      issues += locationIssues;
    }

    const reviewMetrics = getReviewMetrics(total, ok, issues);
    return {
      stats: { total, ok, issues },
      pending: reviewMetrics.pending,
      reviewedPercent: reviewMetrics.reviewedPercent,
      okPercent: reviewMetrics.okPercent,
      issuePercent: reviewMetrics.issuePercent,
      locationMetrics,
      itemMetrics,
    };
  }, [area]);

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
    scheduleSync(project.id);
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
    scheduleSync(project.id);
    const trimmedComment = commentText.trim();
    if (trimmedComment) {
      const nextRecentComments = [
        trimmedComment,
        ...recentComments.filter((comment) => comment !== trimmedComment),
      ].slice(0, 12);
      setRecentComments(nextRecentComments);
      localStorage.setItem(RECENT_COMMENTS_STORAGE_KEY, JSON.stringify(nextRecentComments));
    }
    setEditingCheckpoint(null);
    setCommentText('');
    setArea({ ...area });
  }

  async function saveAreaChanges() {
    if (!project || !area) return;

    const targetArea = project.areas.find((entry) => entry.id === area.id);
    if (!targetArea) return;

    const originalTypeKey = targetArea.areaTypeKey;
    const originalUnitType = targetArea.unitType;
    const nextName = buildAreaName(areaForm);
    targetArea.name = nextName;
    targetArea.areaTypeKey = areaForm.areaTypeKey;
    targetArea.unitType = areaForm.unitType || undefined;
    targetArea.customAreaName = areaForm.customAreaName.trim() || undefined;
    targetArea.areaNumber = areaForm.areaNumber.trim() || undefined;

    const templateChanged =
      originalTypeKey !== areaForm.areaTypeKey ||
      originalUnitType !== (areaForm.unitType || undefined);
    if (templateChanged) {
      if (
        areaHasRecordedActivity(targetArea) &&
        !window.confirm(
          'Changing this area will reset checklist issues, comments, and images for this unit. Continue?'
        )
      ) {
        targetArea.name = area.name;
        targetArea.areaTypeKey = originalTypeKey;
        targetArea.unitType = originalUnitType;
        targetArea.customAreaName = area.customAreaName;
        targetArea.areaNumber = area.areaNumber;
        return;
      }
      applyTemplateToArea(targetArea);
    }

    targetArea.updatedAt = new Date();
    await saveProject(project);
    scheduleSync(project.id);

    const nextRecentAreaTypeKeys = [
      areaForm.areaTypeKey,
      ...recentAreaTypeKeys.filter((key) => key !== areaForm.areaTypeKey),
    ].slice(0, 8);
    setRecentAreaTypeKeys(nextRecentAreaTypeKeys);
    localStorage.setItem(RECENT_AREA_TYPES_STORAGE_KEY, JSON.stringify(nextRecentAreaTypeKeys));

    setProject({ ...project, areas: [...project.areas] });
    setArea({ ...targetArea });
    setShowEditArea(false);
  }

  async function handleAddCustomItem() {
    if (!project || !area || !customItemName.trim() || isApartmentArea(area)) return;

    const targetArea = project.areas.find((entry) => entry.id === area.id);
    if (!targetArea) return;

    const trimmedName = customItemName.trim();
    let customItemsLocation = targetArea.locations.find((location) => location.name === CUSTOM_ITEMS_LOCATION_NAME);

    if (!customItemsLocation) {
      customItemsLocation = createLocation(targetArea.id, CUSTOM_ITEMS_LOCATION_NAME, targetArea.locations.length);
      const otherIndex = targetArea.locations.findIndex((location) => location.name === OTHER_LOCATION_NAME);
      if (otherIndex >= 0) {
        targetArea.locations.splice(otherIndex, 0, customItemsLocation);
      } else {
        targetArea.locations.push(customItemsLocation);
      }
      targetArea.locations.forEach((location, index) => {
        location.sortOrder = index;
      });
    }

    const item = createItem(customItemsLocation.id, trimmedName, customItemsLocation.items.length);
    const checkpoint = createCheckpoint(item.id, 'Notes', 0);
    item.checkpoints.push(checkpoint);
    customItemsLocation.items.push(item);
    targetArea.updatedAt = new Date();

    await saveProject(project);
    scheduleSync(project.id);

    setCustomItemName('');
    setExpandedLocations(new Set([customItemsLocation.id]));
    setExpandedItems(new Set([item.id]));
    setProject({ ...project, areas: [...project.areas] });
    setArea({ ...targetArea });
  }

  async function handleAddPhoto(
    locationId: string,
    itemId: string,
    checkpointId: string,
    imageData: string,
    thumbnail?: string
  ) {
    if (!project || !area) return;

    const checkpoint = findCheckpoint(locationId, itemId, checkpointId);
    if (!checkpoint) return;

    const photo = createPhotoAttachment(checkpointId, imageData, thumbnail);
    checkpoint.photos.push(photo);
    checkpoint.updatedAt = new Date();
    await saveProject(project);
    scheduleSync(project.id);
    setArea({ ...area });
  }

  async function handleAddPhotos(
    locationId: string,
    itemId: string,
    checkpointId: string,
    photos: Array<{ imageData: string; thumbnail?: string }>
  ) {
    if (!project || !area || photos.length === 0) return;

    const checkpoint = findCheckpoint(locationId, itemId, checkpointId);
    if (!checkpoint) return;

    for (const photoInput of photos) {
      checkpoint.photos.push(
        createPhotoAttachment(checkpointId, photoInput.imageData, photoInput.thumbnail)
      );
    }
    checkpoint.updatedAt = new Date();
    await saveProject(project);
    scheduleSync(project.id);
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
    scheduleSync(project.id);
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
    scheduleSync(project.id);
    setArea({ ...area });
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
      await loadData();
    } catch (error) {
      console.error('Sync failed:', error);
      setSyncError(getMicrosoftErrorMessage(error, 'Sync failed.'));
      setSyncStatus('error');
    } finally {
      setSyncing(false);
    }
  }

  async function persistGeneralNotes(value: string) {
    if (!project || !area) return;
    const targetArea = project.areas.find((entry) => entry.id === area.id);
    if (!targetArea) return;
    if ((targetArea.notes ?? '') === value) return;
    targetArea.notes = value;
    targetArea.updatedAt = new Date();
    await saveProject(project);
    scheduleSync(project.id);
    setProject({ ...project, areas: [...project.areas] });
    setArea({ ...targetArea });
  }

  function handleGeneralNotesChange(value: string) {
    setGeneralNotes(value);
    notesDraftRef.current = value;
    if (notesTimerRef.current) {
      clearTimeout(notesTimerRef.current);
    }
    notesTimerRef.current = setTimeout(() => {
      void persistGeneralNotes(value);
    }, 400);
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
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          itemRefs.current.get(itemId)?.scrollIntoView({
            block: 'start',
            behavior: 'smooth',
          });
        });
      });
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

  const stats = areaDerived?.stats ?? { total: 0, ok: 0, issues: 0 };
  const pendingCount = areaDerived?.pending ?? 0;
  const reviewedPercent = areaDerived?.reviewedPercent ?? 0;
  const issuePercent = areaDerived?.issuePercent ?? 0;
  const editingCheckpointData = editingCheckpoint
    ? findCheckpoint(editingCheckpoint.locationId, editingCheckpoint.itemId, editingCheckpoint.checkpointId)
    : null;
  const supportsCustomItems = !isApartmentArea(area);

  function closeCheckpointEditor() {
    if (
      editingCheckpointData &&
      commentText !== editingCheckpointData.comments &&
      !window.confirm('Discard unsaved comment changes?')
    ) {
      return;
    }
    setEditingCheckpoint(null);
    setCommentText('');
  }

  return (
    <div className="h-[calc(100dvh-env(safe-area-inset-top)-3.5rem)] bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
      {/* Header controls */}
      <header className="header-stable shrink-0 border-b z-20">
        <div className="header-row">
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
          <button
            onClick={() => setShowEditArea(true)}
            className="ml-auto p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
            aria-label="Edit area"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>
      </header>

      {syncError && (
        <div className="shrink-0 px-4 py-2 text-sm text-red-600 bg-red-50 border-b border-red-100">
          {syncError}
        </div>
      )}
      {/* Inspection Items */}
      <main
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-scroll overscroll-y-contain touch-pan-y px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+4rem)]"
        onTouchStartCapture={handlePullStart}
        onTouchMoveCapture={handlePullMove}
        onTouchEndCapture={handlePullEnd}
        onTouchCancelCapture={handlePullEnd}
      >
        <div className="min-h-[calc(100%+1px)] list-stack">
        {supportsCustomItems && (
          <div className="list-card bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="text-sm font-medium text-gray-900 dark:text-white mb-3">Custom Items</div>
            <div className="flex gap-3">
              <input
                type="text"
                value={customItemName}
                onChange={(e) => setCustomItemName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleAddCustomItem();
                  }
                }}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Add custom item"
              />
              <button
                onClick={() => void handleAddCustomItem()}
                disabled={!customItemName.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          </div>
        )}
        {area.locations.map((location) => {
          if (location.name.trim().toLowerCase() === OTHER_LOCATION_NAME.toLowerCase()) {
            return (
              <div
                key={location.id}
                className="list-card bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
              >
                <textarea
                  value={generalNotes}
                  onChange={(e) => handleGeneralNotesChange(e.target.value)}
                  onBlur={(e) => {
                    if (notesTimerRef.current) {
                      clearTimeout(notesTimerRef.current);
                    }
                    notesDraftRef.current = e.target.value;
                    void persistGeneralNotes(e.target.value);
                  }}
                  placeholder="General Notes"
                  rows={4}
                  className="w-full resize-none bg-transparent text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none"
                />
              </div>
            );
          }

          const locationMetrics = areaDerived?.locationMetrics.get(location.id);
          const locationStats = locationMetrics?.stats ?? { total: 0, ok: 0, issues: 0 };
          const locationPending = locationMetrics?.pending ?? 0;
          const locationPhotoCount = locationMetrics?.photoCount ?? 0;
          const locationCommentCount = locationMetrics?.commentCount ?? 0;
          const isExpanded = expandedLocations.has(location.id);

          return (
            <div
              key={location.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              {/* Location Header */}
              <button
                onClick={() => toggleLocation(location.id)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-white">{location.name}</span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  {locationStats.issues > 0 && (
                    <span className="stat-chip text-orange-500 text-sm">
                      <AlertTriangle className="w-3 h-3" />
                      {locationStats.issues}
                    </span>
                  )}
                  {locationPending > 0 && (
                    <span className="stat-chip text-gray-400 text-sm">
                      <Circle className="w-3 h-3" />
                      {locationPending}
                    </span>
                  )}
                  {locationPhotoCount > 0 && (
                    <span className="stat-chip text-amber-500 text-sm">
                      <ImageIcon className="w-3 h-3" />
                      {locationPhotoCount}
                    </span>
                  )}
                  {locationCommentCount > 0 && (
                    <span className="stat-chip text-sky-600 text-sm">
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
                    const itemMetrics = areaDerived?.itemMetrics.get(item.id);
                    const itemStats = itemMetrics?.stats ?? { total: 0, ok: 0, issues: 0 };
                    const itemPending = itemMetrics?.pending ?? 0;
                    const itemPhotoCount = itemMetrics?.photoCount ?? 0;
                    const itemCommentCount = itemMetrics?.commentCount ?? 0;
                    const isItemExpanded = expandedItems.has(item.id);

                    return (
                      <div
                        key={item.id}
                        ref={(node) => {
                          itemRefs.current.set(item.id, node);
                        }}
                        className="border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                      >
                        {/* Item Header */}
                        <button
                          onClick={() => toggleItem(item.id)}
                          className="w-full px-4 py-2 pl-8 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <div className="flex items-center gap-2">
                            <Wrench className="w-3 h-3 text-orange-500" />
                            <span className="text-sm text-gray-900 dark:text-white">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2 sm:gap-3">
                            {itemStats.issues > 0 && (
                              <span className="stat-chip text-orange-500 text-xs">
                                <AlertTriangle className="w-3 h-3" />
                                {itemStats.issues}
                              </span>
                            )}
                            {itemPending > 0 && (
                              <span className="stat-chip text-gray-400 text-xs">
                                <Circle className="w-3 h-3" />
                                {itemPending}
                              </span>
                            )}
                            {itemPhotoCount > 0 && (
                              <span className="stat-chip text-amber-500 text-xs">
                                <ImageIcon className="w-3 h-3" />
                                {itemPhotoCount}
                              </span>
                            )}
                            {itemCommentCount > 0 && (
                              <span className="stat-chip text-sky-600 text-xs">
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
                                        updateCheckpointStatus(
                                          location.id,
                                          item.id,
                                          checkpoint.id,
                                          checkpoint.status === 'needsReview' ? 'pending' : 'needsReview'
                                        )
                                      }
                                      className={`p-1.5 rounded ${
                                        checkpoint.status === 'needsReview'
                                          ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600'
                                          : 'text-gray-300 dark:text-gray-600 hover:text-orange-500'
                                      }`}
                                    >
                                      <AlertTriangle className="w-5 h-5" />
                                    </button>
                                  </div>
                                </div>
                                {/* Inline photo thumbnails */}
                                {checkpoint.photos.length > 0 && (
                                  <div className="flex gap-1 overflow-x-auto">
                                    {checkpoint.photos.map((photo) => (
                                      <img
                                        key={photo.id}
                                        src={photo.thumbnail || photo.imageData}
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
          <div className="pt-2">
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${reviewedPercent}%` }}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Edit Checkpoint Modal */}
      {editingCheckpoint && editingCheckpointData && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-t-xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="sticky sticky-surface top-0 border-b px-4 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">{editingCheckpointData.name}</h3>
              <button
                onClick={closeCheckpointEditor}
                className="p-1 text-gray-500 dark:text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Photos */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Attachments
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
                  onAddPhotos={(photos) =>
                    handleAddPhotos(
                      editingCheckpoint.locationId,
                      editingCheckpoint.itemId,
                      editingCheckpoint.checkpointId,
                      photos
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
                {recentComments.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                      Recent comments
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {recentComments.map((comment) => (
                        <button
                          key={comment}
                          onClick={() => setCommentText(comment)}
                          className="px-2.5 py-1.5 text-left text-xs rounded-full border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-300 hover:text-blue-600"
                        >
                          {comment}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="sticky sticky-surface bottom-0 border-t p-4">
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

      <AreaEditorModal
        open={showEditArea}
        title="Edit Area"
        value={areaForm}
        recentAreaTypeKeys={recentAreaTypeKeys}
        onChange={setAreaForm}
        onClose={() => {
          setAreaForm(getAreaFormValue(area));
          setShowEditArea(false);
        }}
        onSubmit={() => void saveAreaChanges()}
        submitLabel="Save"
      />
    </div>
  );
}
