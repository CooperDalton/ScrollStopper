'use client';

import React, { useState, useRef, useEffect } from 'react';
import * as fabric from 'fabric';

interface ImageCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  currentCrop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  onCropConfirm: (crop: { x: number; y: number; width: number; height: number }) => void;
}

const XIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export default function ImageCropModal({ 
  isOpen, 
  onClose, 
  imageUrl, 
  currentCrop,
  onCropConfirm 
}: ImageCropModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const [cropRect, setCropRect] = useState<fabric.Rect | null>(null);
  const [originalImage, setOriginalImage] = useState<fabric.Image | null>(null);
  const [imageScale, setImageScale] = useState(1);
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      initializeCropCanvas();
    }
    
    return () => {
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, [isOpen, imageUrl]);

  const initializeCropCanvas = () => {
    if (!canvasRef.current) return;

    // Dispose existing canvas
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.dispose();
    }

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: 600,
      height: 400,
      backgroundColor: '#f0f0f0'
    });

    fabricCanvasRef.current = canvas;

    // Load the image
    fabric.Image.fromURL(imageUrl).then((img: fabric.Image) => {
      const canvasWidth = 600;
      const canvasHeight = 400;
      const imgWidth = img.width || 1;
      const imgHeight = img.height || 1;

      // Calculate scale to fit image in canvas while maintaining aspect ratio
      const scaleX = canvasWidth / imgWidth;
      const scaleY = canvasHeight / imgHeight;
      const scale = Math.min(scaleX, scaleY) * 0.9; // 90% to leave some margin

      const scaledWidth = imgWidth * scale;
      const scaledHeight = imgHeight * scale;

      // Center the image
      const offsetX = (canvasWidth - scaledWidth) / 2;
      const offsetY = (canvasHeight - scaledHeight) / 2;

      img.set({
        left: offsetX,
        top: offsetY,
        scaleX: scale,
        scaleY: scale,
        selectable: false,
        evented: false
      });

      setOriginalImage(img);
      setImageScale(scale);
      setImageOffset({ x: offsetX, y: offsetY });

      canvas.add(img);

      // Create initial crop rectangle
      const cropWidth = currentCrop ? (currentCrop.width / imgWidth) * scaledWidth : scaledWidth * 0.6;
      const cropHeight = currentCrop ? (currentCrop.height / imgHeight) * scaledHeight : scaledHeight * 0.6;
      const cropLeft = currentCrop ? offsetX + (currentCrop.x / imgWidth) * scaledWidth : offsetX + (scaledWidth - cropWidth) / 2;
      const cropTop = currentCrop ? offsetY + (currentCrop.y / imgHeight) * scaledHeight : offsetY + (scaledHeight - cropHeight) / 2;

      const rect = new fabric.Rect({
        left: cropLeft,
        top: cropTop,
        width: cropWidth,
        height: cropHeight,
        fill: 'transparent',
        stroke: '#007bff',
        strokeWidth: 2,
        strokeDashArray: [5, 5],
        cornerColor: '#007bff',
        cornerSize: 8,
        transparentCorners: false,
        lockRotation: true
      });

      // Constrain crop rectangle to image bounds
      rect.on('moving', () => constrainCropRect(rect, img, offsetX, offsetY, scaledWidth, scaledHeight));
      rect.on('scaling', () => constrainCropRect(rect, img, offsetX, offsetY, scaledWidth, scaledHeight));

      setCropRect(rect);
      canvas.add(rect);
      canvas.renderAll();
    }).catch((error) => {
      console.error('Failed to load image for cropping:', error);
    });
  };

  const constrainCropRect = (
    rect: fabric.Rect, 
    img: fabric.Image, 
    imgLeft: number, 
    imgTop: number, 
    imgWidth: number, 
    imgHeight: number
  ) => {
    const rectLeft = rect.left || 0;
    const rectTop = rect.top || 0;
    const rectWidth = (rect.width || 0) * (rect.scaleX || 1);
    const rectHeight = (rect.height || 0) * (rect.scaleY || 1);

    // Constrain to image bounds
    const minLeft = imgLeft;
    const minTop = imgTop;
    const maxLeft = imgLeft + imgWidth - rectWidth;
    const maxTop = imgTop + imgHeight - rectHeight;

    rect.set({
      left: Math.max(minLeft, Math.min(maxLeft, rectLeft)),
      top: Math.max(minTop, Math.min(maxTop, rectTop))
    });

    fabricCanvasRef.current?.renderAll();
  };

  const handleConfirm = () => {
    if (!cropRect || !originalImage) return;

    const imgWidth = originalImage.width || 1;
    const imgHeight = originalImage.height || 1;

    // Convert canvas coordinates back to original image coordinates
    const rectLeft = (cropRect.left || 0) - imageOffset.x;
    const rectTop = (cropRect.top || 0) - imageOffset.y;
    const rectWidth = ((cropRect.width || 0) * (cropRect.scaleX || 1));
    const rectHeight = ((cropRect.height || 0) * (cropRect.scaleY || 1));

    const crop = {
      x: (rectLeft / imageScale),
      y: (rectTop / imageScale),
      width: (rectWidth / imageScale),
      height: (rectHeight / imageScale)
    };

    onCropConfirm(crop);
    onClose();
  };

  const handleClose = () => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.dispose();
      fabricCanvasRef.current = null;
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={handleClose}
    >
      {/* Modal */}
      <div 
        className="relative bg-[var(--color-bg)] rounded-2xl border border-[var(--color-border)] p-6 w-full max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-[var(--color-text)]">
              Crop Image
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Drag the corners to adjust the crop area
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            <XIcon />
          </button>
        </div>

        {/* Canvas */}
        <div className="flex justify-center mb-6">
          <canvas
            ref={canvasRef}
            className="border border-[var(--color-border)] rounded-lg"
          />
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-6 py-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-6 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
          >
            Apply Crop
          </button>
        </div>
      </div>
    </div>
  );
} 