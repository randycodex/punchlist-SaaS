'use client';

import { useState, useRef } from 'react';
import { Camera, Image as ImageIcon, X } from 'lucide-react';
import { PhotoAttachment } from '@/types';

interface PhotoCaptureProps {
  photos: PhotoAttachment[];
  onAddPhoto: (imageData: string, thumbnail: string) => void;
  onDeletePhoto: (photoId: string) => void;
}

export default function PhotoCapture({ photos, onAddPhoto, onDeletePhoto }: PhotoCaptureProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const maxImageSize = 1600;

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

  function createThumbnailData(img: HTMLImageElement, size: number, quality: number) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return img.src;
    const cropSize = Math.min(img.width, img.height);
    const sx = Math.round((img.width - cropSize) / 2);
    const sy = Math.round((img.height - cropSize) / 2);
    ctx.drawImage(img, sx, sy, cropSize, cropSize, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', quality);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const sourceData = event.target?.result as string;

      // Create thumbnail
      const img = new window.Image();
      img.onload = () => {
        const imageData = createScaledImageData(img, maxImageSize, 0.8);
        const thumbnail = createThumbnailData(img, 150, 0.6);
        onAddPhoto(imageData, thumbnail);
      };
      img.src = sourceData;
    };
    reader.readAsDataURL(file);

    // Reset inputs
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  }

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
                src={photo.thumbnail}
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

      {/* Add photo buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => cameraInputRef.current?.click()}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
        >
          <Camera className="w-3 h-3" />
          Camera
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-50 text-gray-600 rounded hover:bg-gray-100"
        >
          <ImageIcon className="w-3 h-3" />
          Gallery
        </button>
        {/* Camera input - directly opens camera on mobile */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />
        {/* Gallery input - opens photo picker */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

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
