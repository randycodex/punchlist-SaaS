'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, RotateCcw, X, Paperclip } from 'lucide-react';
import { PhotoAttachment, FileAttachment } from '@/types';

interface PhotoCaptureProps {
  photos: PhotoAttachment[];
  files: FileAttachment[];
  onAddPhoto: (imageData: string, thumbnail?: string) => void;
  onAddPhotos?: (photos: Array<{ imageData: string; thumbnail?: string }>) => void;
  onDeletePhoto: (photoId: string) => void;
  onDeleteFile: (fileId: string) => void;
}

export default function PhotoCapture({
  photos,
  files,
  onAddPhoto,
  onAddPhotos,
  onDeletePhoto,
  onDeleteFile,
}: PhotoCaptureProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [capturedBatch, setCapturedBatch] = useState<Array<{ imageData: string; thumbnail?: string }>>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const maxImageSize = 1280;

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
    const img = new window.Image();
    img.onload = () => {
      const imageData = createScaledImageData(img, maxImageSize, 0.72);
      setCapturedBatch((prev) => [...prev, { imageData }]);
    };
    img.src = frameData;
  }

  function addCapturedBatch() {
    if (capturedBatch.length === 0) return;
    if (onAddPhotos) {
      onAddPhotos(capturedBatch);
    } else {
      capturedBatch.forEach((photo) => onAddPhoto(photo.imageData, photo.thumbnail));
    }
    closeCamera(true);
  }

  function removeCaptured(index: number) {
    setCapturedBatch((prev) => prev.filter((_, i) => i !== index));
  }

  function fileToPhotoPayload(file: File): Promise<{ imageData: string; thumbnail?: string } | null> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const sourceData = event.target?.result as string;

        const img = new window.Image();
        img.onload = () => {
          const imageData = createScaledImageData(img, maxImageSize, 0.72);
          resolve({ imageData });
        };
        img.onerror = () => resolve(null);
        img.src = sourceData;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;

    const processed = await Promise.all(selected.map((file) => fileToPhotoPayload(file)));
    const readyPhotos = processed.filter((photo): photo is { imageData: string; thumbnail?: string } => photo !== null);
    if (readyPhotos.length > 0) {
      if (onAddPhotos) {
        onAddPhotos(readyPhotos);
      } else {
        readyPhotos.forEach((photo) => onAddPhoto(photo.imageData, photo.thumbnail));
      }
    }

    // Reset inputs
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
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

  return (
    <div>
      {/* Photo thumbnails */}
      {photos.length > 0 && (
        <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-gray-200"
              onClick={() => setSelectedPhoto(photo.imageData)}
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
                className="absolute top-0 right-0 p-0.5 bg-red-500 text-white rounded-bl"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* File attachments */}
      {files.length > 0 && (
        <div className="space-y-1 mb-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Paperclip className="w-3.5 h-3.5 text-gray-500" />
                <span className="truncate text-gray-700 dark:text-gray-300">
                  {file.name}
                </span>
              </div>
              <button
                onClick={() => onDeleteFile(file.id)}
                className="ml-2 p-1 text-gray-400 hover:text-red-500"
                aria-label={`Delete ${file.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add photo buttons */}
      <div className="flex gap-2">
        <button
          onClick={openCamera}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-zinc-600"
        >
          <Camera className="w-3 h-3" />
          Camera
        </button>
        {cameraError && <span className="text-[11px] text-gray-500">{cameraError}</span>}
        {/* Camera input - directly opens camera on mobile */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoSelect}
          className="hidden"
        />
      </div>

      {cameraOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 p-3 border-b border-white/15">
            <button
              onClick={() => closeCamera(true)}
              className="justify-self-start text-white/90 text-sm px-2 py-1 rounded border border-white/30"
            >
              Cancel
            </button>
            <span className="text-white text-sm">
              {capturedBatch.length} photo{capturedBatch.length === 1 ? '' : 's'}
            </span>
            <div className="justify-self-end flex items-center gap-2">
              <button
                onClick={() => setCapturedBatch([])}
                disabled={capturedBatch.length === 0}
                className="px-2 py-1 rounded border border-white/35 text-white text-sm disabled:opacity-40 flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Clear
              </button>
              <button
                onClick={addCapturedBatch}
                disabled={capturedBatch.length === 0}
                className="text-white text-sm px-2 py-1 rounded border border-gray-400 disabled:opacity-40"
              >
                Add All
              </button>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center p-2">
            <video ref={videoRef} autoPlay playsInline className="w-full max-h-full object-contain rounded-lg" />
          </div>

          {capturedBatch.length > 0 && (
            <div className="px-3 pb-2 overflow-x-auto">
              <div className="flex gap-2">
                {capturedBatch.map((photo, index) => (
                  <div key={`${photo.imageData.slice(0, 32)}-${index}`} className="relative w-16 h-16 flex-shrink-0 rounded overflow-hidden">
                    <img src={photo.thumbnail || photo.imageData} alt={`Captured ${index + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeCaptured(index)}
                      className="absolute top-0 right-0 bg-black/70 text-white rounded-bl px-1"
                      aria-label={`Remove captured photo ${index + 1}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-3 border-t border-white/15">
            <div className="flex items-center justify-center">
              <button
                onClick={captureFromVideo}
                className="w-16 h-16 rounded-full bg-white border-4 border-white/90 shadow-[0_0_0_2px_rgba(255,255,255,0.25)]"
                aria-label="Capture photo"
              />
            </div>
          </div>
        </div>
      )}

      {/* Full photo viewer */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black z-50 flex items-center justify-center"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            onClick={() => setSelectedPhoto(null)}
            className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={selectedPhoto}
            alt="Full size"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </div>
  );
}
