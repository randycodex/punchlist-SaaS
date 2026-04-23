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
    <div className={`flex w-full flex-col ${inline ? '' : 'modal-panel max-h-[92vh] max-w-xl overflow-hidden rounded-[30px] p-4'}`}>
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
            className="field-shell min-h-[108px] text-sm"
            placeholder="Add inspection note"
          />
          {recentComments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {recentComments.map((comment) => (
                <button
                  key={comment}
                  onClick={() => onCommentChange(comment)}
                  className="segmented-chip px-3 py-1.5 text-left text-xs transition hover:bg-white dark:hover:bg-white/[0.08]"
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
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
      {content}
    </div>
  );
}
