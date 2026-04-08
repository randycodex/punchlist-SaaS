'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, Paperclip, X } from 'lucide-react';
import { PhotoAttachment, FileAttachment } from '@/types';

interface PhotoCaptureProps {
  photos: PhotoAttachment[];
  files: FileAttachment[];
  onAddPhoto: (imageData: string, thumbnail?: string) => void | Promise<void>;
  onAddPhotos?: (photos: Array<{ imageData: string; thumbnail?: string }>) => void | Promise<void>;
  onAddFiles?: (files: Array<{ data: string; name: string; mimeType: string; size: number }>) => void;
  onDeletePhoto: (photoId: string) => void;
  onDeleteFile: (fileId: string) => void;
  compactActions?: boolean;
  hideCameraButton?: boolean;
  openCameraSignal?: number;
}

export default function PhotoCapture({
  photos,
  files,
  onAddPhoto,
  onAddPhotos,
  onAddFiles,
  onDeletePhoto,
  onDeleteFile,
  compactActions = false,
  hideCameraButton = false,
  openCameraSignal,
}: PhotoCaptureProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [capturedBatch, setCapturedBatch] = useState<Array<{ imageData: string; thumbnail?: string }>>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [savingPhotos, setSavingPhotos] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const maxImageSize = 1280;
  const thumbnailSize = 360;

  function createScaledImageData(img: HTMLImageElement, maxSize: number, quality: number) {
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return img.src;
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', quality);
  }

  function getPhotoPayloadFromDataUrl(sourceData: string): Promise<{ imageData: string; thumbnail?: string } | null> {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const imageData = createScaledImageData(img, maxImageSize, 0.72);
        const thumbnail = createScaledImageData(img, thumbnailSize, 0.6);
        resolve({ imageData, thumbnail });
      };
      img.onerror = () => resolve(null);
      img.src = sourceData;
    });
  }

  function stopCameraStream() {
    if (!streamRef.current) return;
    streamRef.current.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function openCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setCapturedBatch([]);
      setCameraOpen(true);
    } catch {
      setCameraError('Could not access camera. Opening device camera fallback.');
      cameraInputRef.current?.click();
    }
  }

  function closeCamera(discard = false) {
    stopCameraStream();
    setCameraOpen(false);
    if (discard) {
      setCapturedBatch([]);
    }
  }

  function captureFromVideo() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (!video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const frameData = canvas.toDataURL('image/jpeg', 0.92);
    void getPhotoPayloadFromDataUrl(frameData).then((payload) => {
      if (!payload) return;
      setCapturedBatch((prev) => [...prev, payload]);
    });
  }

  async function addCapturedBatch() {
    if (capturedBatch.length === 0) return;
    setSavingPhotos(true);
    try {
      if (onAddPhotos) {
        await onAddPhotos(capturedBatch);
      } else {
        for (const photo of capturedBatch) {
          await onAddPhoto(photo.imageData, photo.thumbnail);
        }
      }
      closeCamera(true);
    } finally {
      setSavingPhotos(false);
    }
  }

  function fileToPhotoPayload(file: File): Promise<{ imageData: string; thumbnail?: string } | null> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const sourceData = event.target?.result as string;
        void getPhotoPayloadFromDataUrl(sourceData).then(resolve);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  function fileToAttachmentPayload(
    file: File
  ): Promise<{ data: string; name: string; mimeType: string; size: number } | null> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = event.target?.result;
        if (typeof data !== 'string') {
          resolve(null);
          return;
        }
        resolve({
          data,
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
        });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;

    setSavingPhotos(true);
    const processed = await Promise.all(selected.map((file) => fileToPhotoPayload(file)));
    const readyPhotos = processed.filter((photo): photo is { imageData: string; thumbnail?: string } => photo !== null);
    try {
      if (readyPhotos.length > 0) {
        if (onAddPhotos) {
          await onAddPhotos(readyPhotos);
        } else {
          for (const photo of readyPhotos) {
            await onAddPhoto(photo.imageData, photo.thumbnail);
          }
        }
      }
    } finally {
      setSavingPhotos(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  }

  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().catch(() => {
      setCameraError('Camera preview failed to start.');
    });
  }, [cameraOpen]);

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  useEffect(() => {
    if (!openCameraSignal) return;
    void openCamera();
  }, [openCameraSignal]);

  return (
    <div className="space-y-3">
      {photos.length > 0 && (
        <div className="-mx-1 overflow-x-auto pb-1">
          <div className={`flex gap-2 px-1 ${compactActions ? '' : 'sm:gap-2.5'}`}>
          {photos.map((photo) => (
            <div
              key={photo.id}
              className={`group relative shrink-0 overflow-hidden bg-gray-100 dark:bg-zinc-900 ${
                compactActions ? 'h-16 w-16 rounded-xl' : 'h-24 w-24 rounded-[1.1rem] sm:h-28 sm:w-28'
              }`}
              onClick={() => {
                setSelectedPhoto(photo.imageData);
              }}
            >
              <img
                src={photo.thumbnail || photo.imageData}
                alt="Checkpoint photo"
                className="w-full h-full object-cover"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeletePhoto(photo.id);
                }}
                className={`absolute flex items-center justify-center rounded-full bg-black/55 text-white transition ${
                  compactActions ? 'right-1 top-1 h-5 w-5' : 'right-1.5 top-1.5 h-6 w-6'
                }`}
              >
                <X className={compactActions ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
              </button>
            </div>
          ))}
          </div>
        </div>
      )}

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((file) => (
            <div
              key={file.id}
              className={`flex items-center gap-2 rounded-full bg-gray-100 text-xs dark:bg-zinc-900 ${compactActions ? 'pr-1 pl-2 py-1.5' : 'border border-gray-200 dark:border-zinc-700 px-3 py-2'}`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <Paperclip className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                <a
                  href={file.data}
                  download={file.name}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-gray-700 underline-offset-2 hover:underline dark:text-gray-300"
                  onClick={(e) => e.stopPropagation()}
                >
                  {file.name}
                </a>
              </div>
              <button
                onClick={() => onDeleteFile(file.id)}
                className={`flex items-center justify-center rounded-full text-gray-400 transition hover:bg-black/[0.04] hover:text-[var(--accent)] dark:hover:bg-white/[0.06] ${compactActions ? 'h-5 w-5' : 'ml-2 h-7 w-7'}`}
                aria-label={`Delete ${file.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        {!hideCameraButton && (
          <button
            onClick={openCamera}
            disabled={savingPhotos}
            className={`flex items-center justify-center rounded-[1rem] bg-gray-100 text-gray-700 transition hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-100 dark:hover:bg-zinc-700 ${
              compactActions ? 'h-10 w-10' : 'h-11 w-11'
            }`}
            aria-label="Take photo"
          >
            <Camera className={compactActions ? 'h-4 w-4' : 'h-4.5 w-4.5'} />
          </button>
        )}
        {cameraError && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{cameraError}</p>}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoSelect}
          disabled={savingPhotos}
          className="hidden"
        />
      </div>

      {cameraOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black">
          <video ref={videoRef} autoPlay playsInline className="absolute inset-0 h-full w-full object-cover" />

          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pb-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
            <button
              onClick={() => closeCamera(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm"
              aria-label="Close camera"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="h-10 w-10" />
          </div>

          <div className="absolute inset-x-0 bottom-0 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-6">
            <div className="grid grid-cols-[64px_1fr_64px] items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center">
                {capturedBatch.length > 0 ? (
                  <button
                    onClick={() => {
                      const latest = capturedBatch[capturedBatch.length - 1];
                      setSelectedPhoto(latest.imageData);
                    }}
                    className="h-14 w-14 overflow-hidden rounded-[1rem] bg-white/10 backdrop-blur-sm"
                    aria-label="Open last captured photo"
                  >
                    <img
                      src={capturedBatch[capturedBatch.length - 1]?.thumbnail || capturedBatch[capturedBatch.length - 1]?.imageData}
                      alt="Last captured photo"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ) : null}
              </div>

              <div className="flex items-center justify-center">
                <button
                  onClick={captureFromVideo}
                  disabled={savingPhotos}
                  className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/20 shadow-[0_0_0_1px_rgba(255,255,255,0.34)] backdrop-blur-sm transition active:scale-95"
                  aria-label="Capture photo"
                >
                  <span className="h-14 w-14 rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)]" />
                </button>
              </div>

              <div className="flex h-16 w-16 items-center justify-center">
                {capturedBatch.length > 0 ? (
                  <button
                    onClick={() => {
                      void addCapturedBatch();
                    }}
                    disabled={savingPhotos}
                    className="rounded-full bg-white px-4 py-2 text-sm font-medium text-gray-900"
                  >
                    {savingPhotos ? 'Saving...' : 'Done'}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full photo viewer */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/95"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
            <button
              onClick={(event) => {
                event.stopPropagation();
                setSelectedPhoto(null);
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white"
              aria-label="Close photo viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="h-full overflow-auto p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex min-h-full items-center justify-center">
              <img
                src={selectedPhoto}
                alt="Full size"
                className="max-h-[88vh] max-w-full rounded-2xl object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
