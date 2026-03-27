'use client';
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
  onAddPhoto: (imageData: string, thumbnail?: string) => void;
  onAddPhotos: (photos: Array<{ imageData: string; thumbnail?: string }>) => void;
  onAddFiles: (files: Array<{ data: string; name: string; mimeType: string; size: number }>) => void;
  onDeletePhoto: (photoId: string) => void;
  onDeleteFile: (fileId: string) => void;
  inline?: boolean;
};

export default function CheckpointEditorSheet({
  open,
  areaName,
  checkpoint,
  commentText,
  recentComments,
  onClose,
  onCommentChange,
  onSave,
  onAddPhoto,
  onAddPhotos,
  onAddFiles,
  onDeletePhoto,
  onDeleteFile,
  inline = false,
}: CheckpointEditorSheetProps) {
  if (!open || !checkpoint) return null;

  const content = (
    <div className={`menu-surface flex w-full flex-col overflow-hidden ${inline ? 'rounded-[1.5rem]' : 'max-h-[92vh] max-w-xl rounded-[30px]'}`}>
      <div className="flex justify-end px-4 pt-4">
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
        <div className="rounded-[1.5rem] bg-gray-50/60 p-4 dark:bg-zinc-900/55">
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

        <div className="rounded-[1.5rem] bg-gray-50/60 p-4 dark:bg-zinc-900/55">
          <textarea
            value={commentText}
            onChange={(e) => onCommentChange(e.target.value)}
            className="min-h-[140px] w-full rounded-2xl bg-white/80 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:bg-zinc-800/80 dark:text-white dark:placeholder:text-gray-500 dark:focus:ring-zinc-600"
            placeholder="Add inspection note"
          />
          {recentComments.length > 0 && (
            <div className="mt-4">
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

      <div className="sticky sticky-surface bottom-0 p-4 pt-0">
        <button
          onClick={onSave}
          className="w-full rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
        >
          Save Note
        </button>
      </div>
    </div>
  );

  if (inline) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      {content}
    </div>
  );
}
