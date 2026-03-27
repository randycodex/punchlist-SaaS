'use client';

import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Circle,
  Image as ImageIcon,
  MessageSquare,
  Paperclip,
  Wrench,
} from 'lucide-react';
import type { Area, Checkpoint, IssueState } from '@/types';
import { getCheckpointIssueState } from '@/types';

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
  onToggleLocation: (locationId: string) => void;
  onToggleItem: (itemId: string) => void;
  onOpenCheckpoint: (payload: { locationId: string; itemId: string; checkpointId: string; comments: string }) => void;
  onToggleIssue: (locationId: string, itemId: string, checkpointId: string, nextState: IssueState) => void;
  registerItemRef: (itemId: string, node: HTMLDivElement | null) => void;
};

export default function InspectionLocationCard({
  location,
  locationMetric,
  itemMetrics,
  expandedItems,
  isExpanded,
  onToggleLocation,
  onToggleItem,
  onOpenCheckpoint,
  onToggleIssue,
  registerItemRef,
}: InspectionLocationCardProps) {
  const locationStats = locationMetric?.stats ?? { total: 0, ok: 0, issues: 0 };
  const locationPending = locationMetric?.pending ?? 0;
  const locationPhotoCount = locationMetric?.photoCount ?? 0;
  const locationCommentCount = locationMetric?.commentCount ?? 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-300 bg-white/90 dark:border-zinc-700 dark:bg-zinc-800">
      <button
        onClick={() => onToggleLocation(location.id)}
        className="w-full px-4 py-4 text-left transition hover:bg-gray-50 dark:hover:bg-zinc-700/60"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-base font-semibold text-gray-900 dark:text-white">{location.name}</div>
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {locationStats.total > 0 ? `${locationStats.total} checkpoints` : 'No checklist items yet'}
            </div>
          </div>
          <div className="ml-4 flex items-center gap-2 sm:gap-3">
            {locationStats.issues > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 dark:bg-red-900/20">
                <AlertTriangle className="w-3.5 h-3.5" />
                {locationStats.issues}
              </span>
            )}
            {locationPending > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500 dark:bg-zinc-900 dark:text-gray-400">
                <Circle className="w-3.5 h-3.5" />
                {locationPending}
              </span>
            )}
            {locationPhotoCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-zinc-900 dark:text-gray-300">
                <ImageIcon className="w-3.5 h-3.5" />
                {locationPhotoCount}
              </span>
            )}
            {locationCommentCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-zinc-900 dark:text-gray-300">
                <MessageSquare className="w-3.5 h-3.5" />
                {locationCommentCount}
              </span>
            )}
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-200 px-3 pb-3 pt-2 dark:border-zinc-700">
          {location.items.map((item) => {
            const itemMetric = itemMetrics.get(item.id);
            const itemStats = itemMetric?.stats ?? { total: 0, ok: 0, issues: 0 };
            const itemPending = itemMetric?.pending ?? 0;
            const itemPhotoCount = itemMetric?.photoCount ?? 0;
            const itemCommentCount = itemMetric?.commentCount ?? 0;
            const isItemExpanded = expandedItems.has(item.id);

            return (
              <div
                key={item.id}
                ref={(node) => registerItemRef(item.id, node)}
                className="mt-2 first:mt-0"
              >
                <button
                  onClick={() => onToggleItem(item.id)}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-left transition hover:border-gray-300 hover:bg-white dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-950"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex items-center gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gray-200 text-gray-600 dark:bg-zinc-800 dark:text-gray-300">
                        <Wrench className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-gray-900 dark:text-white">{item.name}</div>
                        <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          {itemStats.total} checkpoints
                        </div>
                      </div>
                    </div>
                    <div className="ml-4 flex items-center gap-2 sm:gap-3">
                      {itemStats.issues > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-[11px] font-medium text-red-600 dark:bg-red-900/20">
                          <AlertTriangle className="w-3 h-3" />
                          {itemStats.issues}
                        </span>
                      )}
                      {itemPending > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-500 dark:bg-zinc-800 dark:text-gray-400">
                          <Circle className="w-3 h-3" />
                          {itemPending}
                        </span>
                      )}
                      {itemPhotoCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-600 dark:bg-zinc-800 dark:text-gray-300">
                          <ImageIcon className="w-3 h-3" />
                          {itemPhotoCount}
                        </span>
                      )}
                      {itemCommentCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-600 dark:bg-zinc-800 dark:text-gray-300">
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
                  </div>
                </button>

                {isItemExpanded && (
                  <div className="space-y-2 px-2 pb-1 pt-2">
                    {item.checkpoints.map((checkpoint) => {
                      const issueState = getCheckpointIssueState(checkpoint);

                      return (
                        <CheckpointRow
                          key={checkpoint.id}
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
                            onToggleIssue(
                              location.id,
                              item.id,
                              checkpoint.id,
                              issueState === 'none' ? 'open' : 'none'
                            )
                          }
                        />
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
  return (
    <div
      className={`rounded-2xl border px-3 py-3 transition ${
        issueState === 'open'
          ? 'border-red-200 bg-red-50/70 dark:border-red-900/40 dark:bg-red-950/20'
          : issueState === 'resolved' || issueState === 'verified'
            ? 'border-gray-300 bg-gray-100 dark:border-zinc-600 dark:bg-zinc-950'
            : 'border-gray-200 bg-gray-50 dark:border-zinc-700 dark:bg-zinc-900'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-gray-900 dark:text-white">{checkpoint.name}</div>
          {(checkpoint.comments || checkpoint.photos.length > 0 || (checkpoint.files?.length ?? 0) > 0 || issueState !== 'none') && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {issueState !== 'none' && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${
                    issueState === 'open'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      : 'bg-gray-200 text-gray-700 dark:bg-zinc-800 dark:text-gray-300'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  {issueState === 'open'
                    ? 'Open issue'
                    : issueState === 'resolved'
                      ? 'Resolved'
                      : 'Verified'}
                </span>
              )}
              {checkpoint.comments && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-2 py-1 text-gray-700 dark:bg-zinc-800 dark:text-gray-300">
                  <MessageSquare className="w-3 h-3" />
                  Note added
                </span>
              )}
              {checkpoint.photos.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-2 py-1 text-gray-700 dark:bg-zinc-800 dark:text-gray-300">
                  <ImageIcon className="w-3 h-3" />
                  {checkpoint.photos.length} photo{checkpoint.photos.length === 1 ? '' : 's'}
                </span>
              )}
              {(checkpoint.files?.length ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-2 py-1 text-gray-700 dark:bg-zinc-800 dark:text-gray-300">
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
            className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${
              checkpoint.comments || checkpoint.photos.length > 0 || (checkpoint.files?.length ?? 0) > 0
                ? 'border-gray-300 bg-gray-900 text-white dark:border-zinc-600 dark:bg-white dark:text-gray-900'
                : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-700 dark:border-zinc-700 dark:text-gray-500 dark:hover:border-zinc-600 dark:hover:text-gray-200'
            }`}
            aria-label={`Add note for ${checkpoint.name}`}
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
            onClick={onToggleIssue}
            className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${
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
      {checkpoint.photos.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {checkpoint.photos.map((photo) => (
            <img
              key={photo.id}
              src={photo.thumbnail || photo.imageData}
              alt=""
              className="aspect-square w-full rounded-xl object-cover cursor-pointer"
              onClick={onOpen}
            />
          ))}
        </div>
      )}
    </div>
  );
}
