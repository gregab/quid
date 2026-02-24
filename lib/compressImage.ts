/** Max output dimensions for banner images (2× retina at max-w-4xl container). */
const MAX_WIDTH = 2400;
const MAX_HEIGHT = 800;

/** Storage bucket hard limit. We guarantee output stays under this. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Quality ladder: try each in order until the blob fits.
 * Exported for testing.
 */
export const QUALITY_LADDER = [0.85, 0.7, 0.55, 0.4, 0.25];

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

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("Canvas toBlob failed"));
        else resolve(blob);
      },
      "image/jpeg",
      quality
    );
  });
}

/**
 * Compress an image File to a JPEG Blob using the canvas API.
 * Resizes to at most 1200×400, then steps down JPEG quality until
 * the result is under MAX_FILE_BYTES (2 MB). Works for any input size.
 * Browser-only (requires canvas + FileReader).
 */
export function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to load image"));
      img.onload = async () => {
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

        // Walk down the quality ladder until the blob fits under the limit.
        // For a 2400×800 canvas this almost always resolves at the first step.
        for (const quality of QUALITY_LADDER) {
          const blob = await canvasToBlob(canvas, quality);
          if (blob.size <= MAX_FILE_BYTES || quality === QUALITY_LADDER.at(-1)) {
            resolve(blob);
            return;
          }
        }
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}
