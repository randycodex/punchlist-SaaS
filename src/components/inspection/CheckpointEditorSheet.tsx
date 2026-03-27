'use client';

import { AlertTriangle, CheckCheck, Clock3, ShieldCheck, X } from 'lucide-react';
import type { Checkpoint, IssueState } from '@/types';
import PhotoCapture from '@/components/PhotoCapture';

type CheckpointEditorSheetProps = {
  open: boolean;
  areaName: string;
  checkpoint: Checkpoint | null;
  commentText: string;
  recentComments: string[];
  onClose: () => void;
  onCommentChange: (value: string) => void;
  onSave: () => void;
  onIssueStateChange: (value: IssueState) => void;
  onAddPhoto: (imageData: string, thumbnail?: string) => void;
  onAddPhotos: (photos: Array<{ imageData: string; thumbnail?: string }>) => void;
  onDeletePhoto: (photoId: string) => void;
  onDeleteFile: (fileId: string) => void;
  issueState: IssueState;
};

const issueOptions: Array<{
  value: IssueState;
  label: string;
  icon: typeof Clock3;
}> = [
  { value: 'none', label: 'Clear', icon: X },
  { value: 'open', label: 'Open', icon: AlertTriangle },
  { value: 'resolved', label: 'Resolved', icon: CheckCheck },
  { value: 'verified', label: 'Verified', icon: ShieldCheck },
];

export default function CheckpointEditorSheet({
  open,
  areaName,
  checkpoint,
  commentText,
  recentComments,
  onClose,
  onCommentChange,
  onSave,
  onIssueStateChange,
  onAddPhoto,
  onAddPhotos,
  onDeletePhoto,
  onDeleteFile,
  issueState,
}: CheckpointEditorSheetProps) {
  if (!open || !checkpoint) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] border border-gray-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-800">
        <div className="sticky sticky-surface top-0 border-b border-gray-200 px-4 py-4 dark:border-zinc-700">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                Inspection Note
              </p>
              <h3 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                {checkpoint.name}
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{areaName}</p>
            </div>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-zinc-900 dark:text-gray-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                Issue Status
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Keep the issue state explicit for field follow-up and closeout.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {issueOptions.map((option) => {
                const Icon = option.icon;
                const isActive = issueState === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => onIssueStateChange(option.value)}
                    className={`flex items-center gap-2 rounded-2xl border px-3 py-3 text-sm font-medium transition ${
                      isActive
                        ? option.value === 'open'
                          ? 'border-red-200 bg-red-600 text-white dark:border-red-800'
                          : 'border-gray-300 bg-gray-900 text-white dark:border-zinc-600 dark:bg-white dark:text-gray-900'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-300 dark:hover:border-zinc-600'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                Attachments
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Capture photos from the field or add them from the photo library.
              </p>
            </div>
            <PhotoCapture
              photos={checkpoint.photos}
              files={checkpoint.files ?? []}
              onAddPhoto={onAddPhoto}
              onAddPhotos={onAddPhotos}
              onDeletePhoto={onDeletePhoto}
              onDeleteFile={onDeleteFile}
            />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                Comment
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Add the field note that explains what was found or what needs follow-up.
              </p>
            </div>
            <textarea
              value={commentText}
              onChange={(e) => onCommentChange(e.target.value)}
              className="min-h-[140px] w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-gray-500 dark:focus:ring-zinc-600"
              placeholder="Add inspection note"
            />
            {recentComments.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                  Recent Comments
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentComments.map((comment) => (
                    <button
                      key={comment}
                      onClick={() => onCommentChange(comment)}
                      className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-left text-xs text-gray-700 transition hover:border-gray-300 hover:text-gray-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-300 dark:hover:border-zinc-600 dark:hover:text-white"
                    >
                      {comment}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="sticky sticky-surface bottom-0 border-t border-gray-200 p-4 dark:border-zinc-700">
          <button
            onClick={onSave}
            className="w-full rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            Save Note
          </button>
        </div>
      </div>
    </div>
  );
}
