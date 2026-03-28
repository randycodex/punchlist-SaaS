'use client';
import type { Checkpoint } from '@/types';
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
  void areaName;
  void onClose;

  const content = (
    <div className={`flex w-full flex-col ${inline ? '' : 'menu-surface max-h-[92vh] max-w-xl rounded-[30px] overflow-hidden p-4'}`}>
      <div className={`flex-1 space-y-4 overflow-y-auto ${inline ? 'px-1 pt-1 pb-2' : 'pb-2'}`}>
        <PhotoCapture
          photos={checkpoint.photos}
          files={checkpoint.files ?? []}
          compactActions
          onAddPhoto={onAddPhoto}
          onAddPhotos={onAddPhotos}
          onAddFiles={onAddFiles}
          onDeletePhoto={onDeletePhoto}
          onDeleteFile={onDeleteFile}
        />

        <div className="space-y-3">
          <textarea
            value={commentText}
            onChange={(e) => onCommentChange(e.target.value)}
            onBlur={onSave}
            className="min-h-[108px] w-full rounded-[1rem] bg-gray-100/90 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#ef4e24]/20 dark:bg-zinc-900/75 dark:text-white dark:placeholder:text-gray-500 dark:focus:ring-[#ef4e24]/25"
            placeholder="Add inspection note"
          />
          {recentComments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {recentComments.map((comment) => (
                <button
                  key={comment}
                  onClick={() => onCommentChange(comment)}
                  className="rounded-full bg-gray-100 px-3 py-1.5 text-left text-xs text-gray-700 transition hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700"
                >
                  {comment}
                </button>
              ))}
            </div>
          )}
        </div>
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
