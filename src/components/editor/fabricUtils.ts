import { fabric } from 'fabric';

export const scaleImageToFillCanvas = (img: fabric.Image, canvasWidth: number, canvasHeight: number) => {
  const imgWidth = img.width || 1;
  const imgHeight = img.height || 1;
  const scaleX = canvasWidth / imgWidth;
  const scaleY = canvasHeight / imgHeight;
  const scale = Math.max(scaleX, scaleY);
  img.set({ scaleX: scale, scaleY: scale });
  const scaledWidth = imgWidth * scale;
  const scaledHeight = imgHeight * scale;
  img.set({ left: (canvasWidth - scaledWidth) / 2, top: (canvasHeight - scaledHeight) / 2, originX: 'left', originY: 'top' });
};

export type ImageFromUrlOptions = { crossOrigin?: string };

export const loadFabricImage = (url: string, options?: ImageFromUrlOptions): Promise<fabric.Image> => {
  return new Promise((resolve, reject) => {
    try {
      fabric.Image.fromURL(
        url,
        (img: fabric.Image | undefined) => {
          if (img) resolve(img);
          else reject(new Error('Failed to load image'));
        },
        (options as any) || { crossOrigin: 'anonymous' }
      );
    } catch (err) {
      reject(err);
    }
  });
};


