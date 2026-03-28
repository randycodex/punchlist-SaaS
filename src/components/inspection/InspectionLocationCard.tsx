'use client';

import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  MessageSquare,
  Paperclip,
} from 'lucide-react';
import type { Area, Checkpoint, IssueState } from '@/types';
import { getCheckpointIssueState } from '@/types';
import CheckpointEditorSheet from '@/components/inspection/CheckpointEditorSheet';

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
  expandedItems: Set<string>;
  isExpanded: boolean;
  alwaysExpanded?: boolean;
  hideHeader?: boolean;
  onToggleLocation: (locationId: string) => void;
  onToggleItem: (itemId: string) => void;
  onOpenCheckpoint: (payload: { locationId: string; itemId: string; checkpointId: string; comments: string }) => void;
  onUpdateCheckpointStatus: (
    locationId: string,
    itemId: string,
    checkpointId: string,
    nextState: CheckpointReviewState
  ) => void;
  editingCheckpointId: string | null;
  commentText: string;
  recentComments: string[];
  onCloseEditor: () => void;
  onCommentChange: (value: string) => void;
  onSaveEditor: () => void;
  onAddPhoto: (imageData: string, thumbnail?: string) => void;
  onAddPhotos: (photos: Array<{ imageData: string; thumbnail?: string }>) => void;
  onAddFiles: (files: Array<{ data: string; name: string; mimeType: string; size: number }>) => void;
  onDeletePhoto: (photoId: string) => void;
  onDeleteFile: (fileId: string) => void;
  registerItemRef: (itemId: string, node: HTMLDivElement | null) => void;
};

const CUSTOM_ITEM_CHECKPOINT_NAME = 'Notes';

export default function InspectionLocationCard({
  location,
  locationMetric,
  itemMetrics,
  expandedItems,
  isExpanded,
  alwaysExpanded = false,
  hideHeader = false,
  onToggleLocation,
  onToggleItem,
  onOpenCheckpoint,
  onUpdateCheckpointStatus,
  editingCheckpointId,
  commentText,
  recentComments,
  onCloseEditor,
  onCommentChange,
  onSaveEditor,
  onAddPhoto,
  onAddPhotos,
  onAddFiles,
  onDeletePhoto,
  onDeleteFile,
  registerItemRef,
}: InspectionLocationCardProps) {
  const locationStats = locationMetric?.stats ?? { total: 0, ok: 0, issues: 0 };
  const locationMetricsLabel =
    locationStats.total > 0
      ? `${locationStats.total} items${locationStats.issues > 0 ? ` · ${locationStats.issues} issues` : ''}`
      : 'No items yet';

  return (
    <div className={hideHeader ? '' : 'card-surface-subtle overflow-hidden rounded-[1.6rem]'}>
      {!hideHeader && (
        <button
          onClick={() => {
            if (!alwaysExpanded) {
              onToggleLocation(location.id);
            }
          }}
          className="w-full px-4 py-4 text-left transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-[1.02rem] font-semibold tracking-[-0.01em] text-gray-900 dark:text-white">
                {location.name}
              </div>
              <div className={`mt-1 text-sm ${locationStats.issues > 0 ? 'text-red-600 dark:text-red-300' : 'text-gray-500 dark:text-gray-400'}`}>
                {locationMetricsLabel}
              </div>
            </div>
            {!alwaysExpanded && (
              <div className="ml-4 flex items-center gap-2 sm:gap-3">
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
              </div>
            )}
          </div>
        </button>
      )}

      {(alwaysExpanded || isExpanded) && (
        <div className={hideHeader ? 'space-y-2' : 'border-t border-gray-200 px-3 pb-3 pt-2 dark:border-zinc-700'}>
          {location.items.map((item) => {
            const itemMetric = itemMetrics.get(item.id);
            const itemStats = itemMetric?.stats ?? { total: 0, ok: 0, issues: 0 };
            const itemPending = itemMetric?.pending ?? 0;
            const itemPhotoCount = itemMetric?.photoCount ?? 0;
            const itemCommentCount = itemMetric?.commentCount ?? 0;
            const isItemExpanded = expandedItems.has(item.id);
            const isFlatCustomItem =
              hideHeader && item.checkpoints.length === 1 && item.checkpoints[0]?.name === CUSTOM_ITEM_CHECKPOINT_NAME;
            const customCheckpoint = isFlatCustomItem ? item.checkpoints[0] : null;
            const customIssueState = customCheckpoint ? getCheckpointIssueState(customCheckpoint) : 'none';
            const isCustomEditorOpen = customCheckpoint ? editingCheckpointId === customCheckpoint.id : false;

            return (
              <div
                key={item.id}
                ref={(node) => registerItemRef(item.id, node)}
                className={hideHeader ? '' : 'mt-2 first:mt-0'}
              >
                {isFlatCustomItem && customCheckpoint ? (
                  <div className="rounded-[1.35rem] border border-gray-200 bg-gray-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[1.02rem] font-semibold tracking-[-0.01em] text-gray-900 dark:text-white">{item.name}</div>
                        <div className={`mt-1 text-sm ${customIssueState === 'open' ? 'text-red-600 dark:text-red-300' : 'text-gray-500 dark:text-gray-400'}`}>
                          {itemPending > 0
                            ? `${itemPending} pending`
                            : customIssueState === 'open'
                              ? 'Issue'
                              : 'No items yet'}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          onClick={() =>
                            onOpenCheckpoint({
                              locationId: location.id,
                              itemId: item.id,
                              checkpointId: customCheckpoint.id,
                              comments: customCheckpoint.comments,
                            })
                          }
                          className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition ${
                            customCheckpoint.comments || customCheckpoint.photos.length > 0 || (customCheckpoint.files?.length ?? 0) > 0
                              ? 'border-gray-300 bg-gray-900 text-white dark:border-zinc-600 dark:bg-white dark:text-gray-900'
                              : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-700 dark:border-zinc-700 dark:text-gray-500 dark:hover:border-zinc-600 dark:hover:text-gray-200'
                          }`}
                          aria-label={`Add note for ${item.name}`}
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() =>
                            onUpdateCheckpointStatus(
                              location.id,
                              item.id,
                              customCheckpoint.id,
                              customIssueState === 'open' ? 'pending' : 'open'
                            )
                          }
                          className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition ${
                            customIssueState === 'open'
                              ? 'border-red-200 bg-red-600 text-white dark:border-red-800 dark:bg-red-600'
                              : 'border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-600 dark:border-zinc-700 dark:text-gray-500'
                          }`}
                          aria-label={`Flag issue for ${item.name}`}
                        >
                          <AlertTriangle className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    {isCustomEditorOpen && (
                      <div className="mt-3">
                        <CheckpointEditorSheet
                          inline
                          open
                          areaName={location.name}
                          checkpoint={customCheckpoint}
                          commentText={commentText}
                          recentComments={recentComments}
                          onClose={onCloseEditor}
                          onCommentChange={onCommentChange}
                          onSave={onSaveEditor}
                          onAddPhoto={onAddPhoto}
                          onAddPhotos={onAddPhotos}
                          onAddFiles={onAddFiles}
                          onDeletePhoto={onDeletePhoto}
                          onDeleteFile={onDeleteFile}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                <button
                  onClick={() => onToggleItem(item.id)}
                  className="w-full rounded-[1.35rem] border border-gray-200 bg-gray-50 px-4 py-3 text-left transition hover:border-gray-300 hover:bg-white dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-950"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[1.02rem] font-semibold tracking-[-0.01em] text-gray-900 dark:text-white">{item.name}</div>
                      <div className={`mt-1 text-sm ${itemStats.issues > 0 ? 'text-red-600 dark:text-red-300' : 'text-gray-500 dark:text-gray-400'}`}>
                        {itemStats.total > 0
                          ? `${itemStats.total} items${itemStats.issues > 0 ? ` · ${itemStats.issues} issues` : ''}`
                          : 'No items yet'}
                      </div>
                    </div>
                    <div className="ml-4 flex items-center gap-2 sm:gap-3">
                      {(itemCommentCount > 0 || itemPhotoCount > 0 || itemPending > 0) && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {[
                            itemPending > 0 ? `${itemPending} pending` : null,
                            itemCommentCount > 0 ? `${itemCommentCount} notes` : null,
                            itemPhotoCount > 0 ? `${itemPhotoCount} photos` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      )}
                      {isItemExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                </button>
                )}

                {!isFlatCustomItem && isItemExpanded && (
                  <div className="space-y-2 pl-5 pr-2 pb-1 pt-3">
                    {item.checkpoints.map((checkpoint) => {
                      const issueState = getCheckpointIssueState(checkpoint);
                      const isEditorOpen = editingCheckpointId === checkpoint.id;

                      return (
                        <div key={checkpoint.id} className="space-y-2">
                          <CheckpointRow
                            checkpoint={checkpoint}
                            issueState={issueState}
                            onOpen={() =>
                              onOpenCheckpoint({
                                locationId: location.id,
                                itemId: item.id,
                                checkpointId: checkpoint.id,
                                comments: checkpoint.comments,
                              })
                            }
                            onToggleIssue={() =>
                              onUpdateCheckpointStatus(
                                location.id,
                                item.id,
                                checkpoint.id,
                                issueState === 'open' ? 'pending' : 'open'
                              )
                            }
                          />
                          {isEditorOpen && (
                            <CheckpointEditorSheet
                              inline
                            open
                            areaName={location.name}
                            checkpoint={checkpoint}
                            commentText={commentText}
                            recentComments={recentComments}
                              onClose={onCloseEditor}
                              onCommentChange={onCommentChange}
                              onSave={onSaveEditor}
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
      )}
    </div>
  );
}

function CheckpointRow({
  checkpoint,
  issueState,
  onOpen,
  onToggleIssue,
}: {
  checkpoint: Checkpoint;
  issueState: IssueState;
  onOpen: () => void;
  onToggleIssue: () => void;
}) {
  const isOk = checkpoint.status === 'ok';

  return (
    <div
      className={`rounded-[1.35rem] border px-3 py-3 transition ${
        isOk
          ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20'
          : issueState === 'open'
          ? 'border-red-200 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/15'
          : issueState === 'resolved' || issueState === 'verified'
            ? 'border-gray-300 bg-gray-100 dark:border-zinc-600 dark:bg-zinc-950'
            : 'border-gray-200 bg-gray-50 dark:border-zinc-700 dark:bg-zinc-900'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-gray-900 dark:text-white">{checkpoint.name}</div>
          {(checkpoint.comments || checkpoint.photos.length > 0 || (checkpoint.files?.length ?? 0) > 0 || issueState !== 'none') && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {(issueState === 'resolved' || issueState === 'verified') && (
                <span
                  className="pill-chip px-2.5 py-1 bg-gray-200 text-gray-700 dark:bg-zinc-800 dark:text-gray-300"
                >
                  {issueState === 'resolved' ? 'Resolved' : 'Verified'}
                </span>
              )}
              {checkpoint.comments && (
                <span className="pill-chip px-2.5 py-1 bg-gray-200 text-gray-700 dark:bg-zinc-800 dark:text-gray-300">
                  <MessageSquare className="w-3 h-3" />
                  Note
                </span>
              )}
              {checkpoint.photos.length > 0 && (
                <span className="pill-chip px-2.5 py-1 bg-gray-200 text-gray-700 dark:bg-zinc-800 dark:text-gray-300">
                  <ImageIcon className="w-3 h-3" />
                  {checkpoint.photos.length} photo{checkpoint.photos.length === 1 ? '' : 's'}
                </span>
              )}
              {(checkpoint.files?.length ?? 0) > 0 && (
                <span className="pill-chip px-2.5 py-1 bg-gray-200 text-gray-700 dark:bg-zinc-800 dark:text-gray-300">
                  <Paperclip className="w-3 h-3" />
                  {checkpoint.files?.length} file{(checkpoint.files?.length ?? 0) === 1 ? '' : 's'}
                </span>
              )}
            </div>
          )}
          {checkpoint.comments && (
            <p className="mt-2 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{checkpoint.comments}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={onOpen}
            className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition ${
              checkpoint.comments || checkpoint.photos.length > 0 || (checkpoint.files?.length ?? 0) > 0
                ? 'border-gray-300 bg-gray-900 text-white dark:border-zinc-600 dark:bg-white dark:text-gray-900'
                : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-700 dark:border-zinc-700 dark:text-gray-500 dark:hover:border-zinc-600 dark:hover:text-gray-200'
            }`}
            aria-label={`Add note for ${checkpoint.name}`}
          >
            <MessageSquare className="w-4 h-4" />
          </button>
          <button
            onClick={onToggleIssue}
            className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition ${
              issueState === 'open'
                ? 'border-red-200 bg-red-600 text-white dark:border-red-800 dark:bg-red-600'
                : 'border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-600 dark:border-zinc-700 dark:text-gray-500'
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
