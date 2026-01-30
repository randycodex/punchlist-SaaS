'use client';

import { useState, useRef } from 'react';
import { Camera, Image as ImageIcon, X, Trash2 } from 'lucide-react';
import { PhotoAttachment } from '@/types';

interface PhotoCaptureProps {
  photos: PhotoAttachment[];
  onAddPhoto: (imageData: string, thumbnail: string) => void;
  onDeletePhoto: (photoId: string) => void;
}

export default function PhotoCapture({ photos, onAddPhoto, onDeletePhoto }: PhotoCaptureProps) {
  const [showCamera, setShowCamera] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowCamera(true);
    } catch (error) {
      console.error('Failed to access camera:', error);
      alert('Could not access camera. Please check permissions.');
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  }

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const imageData = canvas.toDataURL('image/jpeg', 0.8);

    // Create thumbnail
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 150;
    thumbCanvas.height = 150;
    const thumbCtx = thumbCanvas.getContext('2d');
    if (thumbCtx) {
      const size = Math.min(video.videoWidth, video.videoHeight);
      const x = (video.videoWidth - size) / 2;
      const y = (video.videoHeight - size) / 2;
      thumbCtx.drawImage(canvas, x, y, size, size, 0, 0, 150, 150);
    }
    const thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.6);

    onAddPhoto(imageData, thumbnail);
    stopCamera();
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const imageData = event.target?.result as string;

      // Create thumbnail
      const img = new window.Image();
      img.onload = () => {
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = 150;
        thumbCanvas.height = 150;
        const thumbCtx = thumbCanvas.getContext('2d');
        if (thumbCtx) {
          const size = Math.min(img.width, img.height);
          const x = (img.width - size) / 2;
          const y = (img.height - size) / 2;
          thumbCtx.drawImage(img, x, y, size, size, 0, 0, 150, 150);
        }
        const thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.6);
        onAddPhoto(imageData, thumbnail);
      };
      img.src = imageData;
    };
    reader.readAsDataURL(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
          onClick={startCamera}
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
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Camera modal */}
      {showCamera && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="flex-1 relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <div className="p-4 flex justify-center gap-4 bg-black">
            <button
              onClick={stopCamera}
              className="p-4 bg-gray-700 text-white rounded-full"
            >
              <X className="w-6 h-6" />
            </button>
            <button
              onClick={capturePhoto}
              className="p-4 bg-white rounded-full"
            >
              <div className="w-6 h-6 bg-red-500 rounded-full" />
            </button>
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
