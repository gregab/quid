/** Max output dimensions for banner images. */
const MAX_WIDTH = 1200;
const MAX_HEIGHT = 400;
const JPEG_QUALITY = 0.8;

/**
 * Calculate output dimensions preserving aspect ratio, capped at MAX_WIDTH × MAX_HEIGHT.
 * Exported for testing.
 */
export function calculateDimensions(
  srcWidth: number,
  srcHeight: number
): { width: number; height: number } {
  const widthRatio = MAX_WIDTH / srcWidth;
  const heightRatio = MAX_HEIGHT / srcHeight;
  const ratio = Math.min(widthRatio, heightRatio, 1); // never upscale
  return {
    width: Math.round(srcWidth * ratio),
    height: Math.round(srcHeight * ratio),
  };
}

/**
 * Compress an image File to a JPEG Blob using the canvas API.
 * Resizes to at most 1200×400, JPEG quality 0.8.
 * Browser-only (requires canvas + FileReader).
 */
export function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to load image"));
      img.onload = () => {
        const { width, height } = calculateDimensions(img.naturalWidth, img.naturalHeight);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Canvas toBlob failed"));
              return;
            }
            resolve(blob);
          },
          "image/jpeg",
          JPEG_QUALITY
        );
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}
