'use client';

import { AlertTriangle, CheckCheck, CheckCircle2, Clock3, ShieldCheck, X } from 'lucide-react';
import type { Checkpoint, IssueState } from '@/types';
import PhotoCapture from '@/components/PhotoCapture';

type CheckpointReviewState = 'pending' | 'ok' | Exclude<IssueState, 'none'>;

type CheckpointEditorSheetProps = {
  open: boolean;
  areaName: string;
  checkpoint: Checkpoint | null;
  commentText: string;
  recentComments: string[];
  onClose: () => void;
  onCommentChange: (value: string) => void;
  onSave: () => void;
  onStatusChange: (value: CheckpointReviewState) => void;
  onAddPhoto: (imageData: string, thumbnail?: string) => void;
  onAddPhotos: (photos: Array<{ imageData: string; thumbnail?: string }>) => void;
  onAddFiles: (files: Array<{ data: string; name: string; mimeType: string; size: number }>) => void;
  onDeletePhoto: (photoId: string) => void;
  onDeleteFile: (fileId: string) => void;
  statusValue: CheckpointReviewState;
};

const issueOptions: Array<{
  value: CheckpointReviewState;
  label: string;
  icon: typeof Clock3;
}> = [
  { value: 'pending', label: 'Pending', icon: Clock3 },
  { value: 'ok', label: 'OK', icon: CheckCircle2 },
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
  onStatusChange,
  onAddPhoto,
  onAddPhotos,
  onAddFiles,
  onDeletePhoto,
  onDeleteFile,
  statusValue,
}: CheckpointEditorSheetProps) {
  if (!open || !checkpoint) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
      <div className="menu-surface flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-[30px]">
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
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-black/[0.05] hover:text-gray-900 dark:bg-zinc-900 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <div className="rounded-[1.5rem] border border-gray-200 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-3">
              <div className="section-eyebrow">
                Inspection Status
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Mark the checkpoint as pending, OK, or track the issue state for follow-up.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {issueOptions.map((option) => {
                const Icon = option.icon;
                const isActive = statusValue === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => onStatusChange(option.value)}
                    className={`flex items-center gap-2 rounded-2xl border px-3 py-3 text-sm font-medium transition ${
                      isActive
                        ? option.value === 'open'
                          ? 'border-red-200 bg-red-600 text-white dark:border-red-800'
                          : option.value === 'ok'
                            ? 'border-emerald-200 bg-emerald-600 text-white dark:border-emerald-800'
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

          <div className="rounded-[1.5rem] border border-gray-200 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-3">
              <div className="section-eyebrow">
                Attachments
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Capture photos from the field, add images from the library, or attach files to this inspection note.
              </p>
            </div>
            <PhotoCapture
              photos={checkpoint.photos}
              files={checkpoint.files ?? []}
              onAddPhoto={onAddPhoto}
              onAddPhotos={onAddPhotos}
              onAddFiles={onAddFiles}
              onDeletePhoto={onDeletePhoto}
              onDeleteFile={onDeleteFile}
            />
          </div>

          <div className="rounded-[1.5rem] border border-gray-200 bg-gray-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-3">
              <div className="section-eyebrow">
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
