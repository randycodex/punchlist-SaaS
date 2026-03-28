'use client';

import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  MessageSquare,
} from 'lucide-react';
import type { Area, Checkpoint, IssueState } from '@/types';
import { getCheckpointIssueState } from '@/types';
import PhotoCapture from '@/components/PhotoCapture';
import MetadataLine from '@/components/MetadataLine';

type CheckpointReviewState = 'pending' | 'ok' | Exclude<IssueState, 'none'>;

type Metrics = {
  stats: { total: number; ok: number; issues: number };
  pending: number;
  photoCount: number;
  commentCount: number;
};

type InspectionLocationCardProps = {
  location: Area['locations'][number];
  locationMetric?: Metrics;
  itemMetrics: Map<string, Metrics>;
  showOnlyIssues?: boolean;
  expandedItems: Set<string>;
  isExpanded: boolean;
  alwaysExpanded?: boolean;
  hideHeader?: boolean;
  onToggleLocation: (locationId: string) => void | Promise<void>;
  onToggleItem: (itemId: string) => void | Promise<void>;
  onToggleCheckpoint: (payload: {
    locationId: string;
    itemId: string;
    checkpointId: string;
    comments: string;
  }) => void | Promise<void>;
  onCommentChange: (value: string) => void;
  onCommentBlur: (locationId: string, itemId: string, checkpointId: string, value: string) => void | Promise<void>;
  onUpdateCheckpointStatus: (locationId: string, itemId: string, checkpointId: string, nextState: CheckpointReviewState) => void | Promise<void>;
  expandedCheckpointId: string | null;
  commentText: string;
  recentComments: string[];
  onAddPhoto: (imageData: string, thumbnail?: string) => void | Promise<void>;
  onAddPhotos: (photos: Array<{ imageData: string; thumbnail?: string }>) => void | Promise<void>;
  onAddFiles: (files: Array<{ data: string; name: string; mimeType: string; size: number }>) => void | Promise<void>;
  onDeletePhoto: (photoId: string) => void | Promise<void>;
  onDeleteFile: (fileId: string) => void | Promise<void>;
  registerItemRef: (itemId: string, node: HTMLDivElement | null) => void;
};

export default function InspectionLocationCard({
  location,
  locationMetric,
  itemMetrics,
  showOnlyIssues = false,
  expandedItems,
  isExpanded,
  alwaysExpanded = false,
  hideHeader = false,
  onToggleLocation,
  onToggleItem,
  onToggleCheckpoint,
  onCommentChange,
  onCommentBlur,
  onUpdateCheckpointStatus,
  expandedCheckpointId,
  commentText,
  recentComments,
  onAddPhoto,
  onAddPhotos,
  onAddFiles,
  onDeletePhoto,
  onDeleteFile,
  registerItemRef,
}: InspectionLocationCardProps) {
  const locationStats = locationMetric?.stats ?? { total: 0, ok: 0, issues: 0 };
  const isCustomItemsList =
    hideHeader && alwaysExpanded && location.name.trim().toLowerCase() === 'custom items';
  const visibleItems = showOnlyIssues
    ? location.items.filter((item) => (itemMetrics.get(item.id)?.stats.issues ?? 0) > 0)
    : location.items;

  return (
    <div className={hideHeader ? '' : 'card-surface-subtle overflow-hidden rounded-[1.6rem]'}>
      {!hideHeader && (
        <button
          onClick={() => {
            if (!alwaysExpanded) {
              void onToggleLocation(location.id);
            }
          }}
          className="w-full px-4 py-4 text-left transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-[1.02rem] font-semibold tracking-[-0.01em] text-gray-900 dark:text-white">
                {location.name}
              </div>
              <MetadataLine className="mt-1" issues={locationStats.issues} issuesOnly />
            </div>
            {!alwaysExpanded && (
              isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </button>
      )}

      {(alwaysExpanded || isExpanded) && (
        <div className={hideHeader ? 'space-y-2.5' : 'space-y-2.5 px-2.5 pb-2.5 pt-2'}>
          <div
            className={
              isCustomItemsList
                ? 'space-y-2.5'
                : 'relative space-y-2.5 pl-4 before:absolute before:bottom-3 before:left-0 before:top-3 before:w-px before:bg-[rgba(0,0,0,0.08)] dark:before:bg-[rgba(255,255,255,0.06)]'
            }
          >
          {visibleItems.map((item) => {
            const itemMetric = itemMetrics.get(item.id);
            const itemStats = itemMetric?.stats ?? { total: 0, ok: 0, issues: 0 };
            const customCheckpoint = isCustomItemsList ? item.checkpoints[0] ?? null : null;
            const isExpandedCustomCheckpoint = customCheckpoint ? expandedCheckpointId === customCheckpoint.id : false;

            if (isCustomItemsList && customCheckpoint) {
              const customIssueState = getCheckpointIssueState(customCheckpoint);
              return (
                <div key={item.id} ref={(node) => registerItemRef(item.id, node)} className="space-y-2">
                  <CheckpointRow
                    checkpoint={customCheckpoint}
                    label={item.name}
                    issueState={customIssueState}
                    expanded={isExpandedCustomCheckpoint}
                    onToggleExpand={() =>
                      void onToggleCheckpoint({
                        locationId: location.id,
                        itemId: item.id,
                        checkpointId: customCheckpoint.id,
                        comments: customCheckpoint.comments,
                      })
                    }
                    onToggleIssue={() =>
                      void onUpdateCheckpointStatus(
                        location.id,
                        item.id,
                        customCheckpoint.id,
                        customIssueState === 'open' ? 'pending' : 'open'
                      )
                    }
                  />
                  {isExpandedCustomCheckpoint && (
                    <InlineCheckpointEditor
                      checkpoint={customCheckpoint}
                      locationId={location.id}
                      itemId={item.id}
                      commentText={commentText}
                      recentComments={recentComments}
                      onCommentChange={onCommentChange}
                      onCommentBlur={onCommentBlur}
                      onAddPhoto={onAddPhoto}
                      onAddPhotos={onAddPhotos}
                      onAddFiles={onAddFiles}
                      onDeletePhoto={onDeletePhoto}
                      onDeleteFile={onDeleteFile}
                    />
                  )}
                </div>
              );
            }

            const isItemExpanded = expandedItems.has(item.id);
            return (
              <div key={item.id} ref={(node) => registerItemRef(item.id, node)} className="pl-4">
                <button
                  onClick={() => void onToggleItem(item.id)}
                  className={`w-full rounded-[1.3rem] px-4 py-3 text-left transition ${
                    isItemExpanded
                      ? 'bg-white/90 dark:bg-zinc-900/80'
                      : 'bg-gray-50/85 hover:bg-white dark:bg-zinc-900/65 dark:hover:bg-zinc-900/85'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[1.02rem] tracking-[-0.01em] text-gray-900 dark:text-white">
                        {item.name}
                      </div>
                      <MetadataLine
                        className="mt-1"
                        issues={itemStats.issues}
                        notes={itemMetric?.commentCount ?? 0}
                        photos={itemMetric?.photoCount ?? 0}
                      />
                    </div>
                    {isItemExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>

                {isItemExpanded && (
                  <div className="relative space-y-2.5 pl-10 pr-1 pt-2 before:absolute before:bottom-2 before:left-0 before:top-1 before:w-px before:bg-[rgba(0,0,0,0.08)] dark:before:bg-[rgba(255,255,255,0.06)]">
                    {item.checkpoints
                      .filter((checkpoint) => !showOnlyIssues || getCheckpointIssueState(checkpoint) !== 'none')
                      .map((checkpoint) => {
                        const issueState = getCheckpointIssueState(checkpoint);
                        const isExpandedCheckpoint = expandedCheckpointId === checkpoint.id;

                        return (
                          <div key={checkpoint.id} className="space-y-2">
                          <CheckpointRow
                            checkpoint={checkpoint}
                            issueState={issueState}
                            expanded={isExpandedCheckpoint}
                            onToggleExpand={() =>
                              void onToggleCheckpoint({
                                locationId: location.id,
                                itemId: item.id,
                                checkpointId: checkpoint.id,
                                comments: checkpoint.comments,
                              })
                            }
                            onToggleIssue={() =>
                              void onUpdateCheckpointStatus(
                                location.id,
                                item.id,
                                checkpoint.id,
                                issueState === 'open' ? 'pending' : 'open'
                              )
                            }
                          />
                          {isExpandedCheckpoint && (
                            <InlineCheckpointEditor
                              checkpoint={checkpoint}
                              locationId={location.id}
                              itemId={item.id}
                              commentText={commentText}
                              recentComments={recentComments}
                              onCommentChange={onCommentChange}
                              onCommentBlur={onCommentBlur}
                              onAddPhoto={onAddPhoto}
                              onAddPhotos={onAddPhotos}
                              onAddFiles={onAddFiles}
                              onDeletePhoto={onDeletePhoto}
                              onDeleteFile={onDeleteFile}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </div>
      )}
    </div>
  );
}

function CheckpointRow({
  checkpoint,
  label,
  issueState,
  expanded,
  onToggleExpand,
  onToggleIssue,
}: {
  checkpoint: Checkpoint;
  label?: string;
  issueState: IssueState;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleIssue: () => void;
}) {
  const noteCount = checkpoint.comments.trim() ? 1 : 0;
  const photoCount = checkpoint.photos.length;
  const hasRecordedContext = noteCount > 0 || photoCount > 0;

  return (
    <div
      className={`rounded-[1.35rem] border px-3 py-3 transition ${
        issueState === 'open'
          ? 'border-transparent accent-tint'
          : 'border-transparent bg-gray-50/85 dark:bg-zinc-900/60'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <button onClick={onToggleExpand} className="min-w-0 flex-1 text-left">
          <div className="text-[0.98rem] font-normal text-gray-900 dark:text-white">{label ?? checkpoint.name}</div>
          <MetadataLine className="mt-1" notes={noteCount} photos={photoCount} />
          {checkpoint.comments && <p className="mt-2 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{checkpoint.comments}</p>}
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onToggleExpand();
            }}
            className={`flex h-10 w-10 items-center justify-center rounded-[1rem] transition ${
              expanded || hasRecordedContext
                ? 'bg-white text-gray-700 shadow-sm dark:bg-zinc-800 dark:text-white'
                : 'text-gray-400 hover:bg-white/70 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-zinc-800 dark:hover:text-gray-200'
            }`}
            aria-label={`Open note editor for ${checkpoint.name}`}
          >
            <MessageSquare className="h-4 w-4" />
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onToggleIssue();
            }}
            className={`flex h-10 w-10 items-center justify-center rounded-[1rem] transition ${
              issueState === 'open'
                ? 'accent-bg text-white shadow-sm'
                : 'text-gray-400 hover:bg-white/70 hover:text-[var(--accent)] dark:text-gray-500 dark:hover:bg-zinc-800'
            }`}
            aria-label={`Flag issue for ${checkpoint.name}`}
          >
            <AlertTriangle className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function InlineCheckpointEditor({
  checkpoint,
  locationId,
  itemId,
  commentText,
  recentComments,
  onCommentChange,
  onCommentBlur,
  onAddPhoto,
  onAddPhotos,
  onAddFiles,
  onDeletePhoto,
  onDeleteFile,
  issueState,
  onToggleIssue,
  expanded,
  onToggleExpand,
}: {
  checkpoint: Checkpoint;
  locationId: string;
  itemId: string;
  commentText: string;
  recentComments: string[];
  onCommentChange: (value: string) => void;
  onCommentBlur: (locationId: string, itemId: string, checkpointId: string, value: string) => void | Promise<void>;
  onAddPhoto: (imageData: string, thumbnail?: string) => void | Promise<void>;
  onAddPhotos: (photos: Array<{ imageData: string; thumbnail?: string }>) => void | Promise<void>;
  onAddFiles: (files: Array<{ data: string; name: string; mimeType: string; size: number }>) => void | Promise<void>;
  onDeletePhoto: (photoId: string) => void | Promise<void>;
  onDeleteFile: (fileId: string) => void | Promise<void>;
  issueState?: IssueState;
  onToggleIssue?: () => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
}) {
  return (
    <div className="space-y-2.5 px-1 pb-1 pt-1">
      {(onToggleIssue || onToggleExpand) && (
        <div className="flex items-center justify-end gap-2">
          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className={`flex h-9 w-9 items-center justify-center rounded-[0.95rem] transition ${
                expanded
                  ? 'bg-white text-gray-700 shadow-sm dark:bg-zinc-800 dark:text-white'
                  : 'text-gray-400 hover:bg-white/70 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-zinc-800 dark:hover:text-gray-200'
              }`}
              aria-label={`Toggle note editor for ${checkpoint.name}`}
            >
              <MessageSquare className="h-4 w-4" />
            </button>
          )}
          {onToggleIssue && (
            <button
              onClick={onToggleIssue}
              className={`flex h-9 w-9 items-center justify-center rounded-[0.95rem] transition ${
                issueState === 'open'
                  ? 'accent-bg text-white shadow-sm'
                  : 'text-gray-400 hover:bg-white/70 hover:text-[var(--accent)] dark:text-gray-500 dark:hover:bg-zinc-800'
              }`}
              aria-label={`Flag issue for ${checkpoint.name}`}
            >
              <AlertTriangle className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
      <PhotoCapture
        photos={checkpoint.photos}
        files={checkpoint.files ?? []}
        onAddPhoto={onAddPhoto}
        onAddPhotos={onAddPhotos}
        onAddFiles={onAddFiles}
        onDeletePhoto={onDeletePhoto}
        onDeleteFile={onDeleteFile}
      />
      <textarea
        value={commentText}
        onChange={(e) => onCommentChange(e.target.value)}
        onBlur={(e) => void onCommentBlur(locationId, itemId, checkpoint.id, e.target.value)}
        className="min-h-[88px] w-full resize-none rounded-[1rem] bg-gray-100/90 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#ef4e24]/20 dark:bg-zinc-900/80 dark:text-white dark:placeholder:text-gray-500 dark:focus:ring-[#ef4e24]/25"
        placeholder="Add inspection note"
      />
      {recentComments.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {recentComments.map((comment) => (
            <button
              key={comment}
              onClick={() => onCommentChange(comment)}
              className="rounded-full bg-gray-100 px-3 py-1.5 text-left text-xs text-gray-700 transition hover:bg-gray-200 hover:text-gray-900 dark:bg-zinc-900 dark:text-gray-300 dark:hover:bg-zinc-800 dark:hover:text-white"
            >
              {comment}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
