import type { Evidence } from '../types';

export interface ProcessedImageResult {
  dataUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface ImageProcessingOptions {
  maxDimension?: number;
  quality?: number;
  maxSizeBytes?: number;
}

/**
 * Validates file type and size, then downscales and compresses image via Canvas
 * to prevent IndexedDB storage bloat.
 */
export async function validateAndCompressImage(
  file: File,
  options: ImageProcessingOptions = {}
): Promise<ProcessedImageResult> {
  const {
    maxDimension = 1920,
    quality = 0.85,
    maxSizeBytes = 5 * 1024 * 1024, // 5MB limit
  } = options;

  // 1. MIME type check
  if (!file.type.startsWith('image/')) {
    throw new Error('Only valid image files (PNG, JPEG, WebP) are supported.');
  }

  // 2. Initial size check
  if (file.size > maxSizeBytes) {
    throw new Error(`Image size (${formatBytes(file.size)}) exceeds maximum allowed limit of ${formatBytes(maxSizeBytes)}.`);
  }

  // 3. Load image into memory
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        try {
          let { width, height } = img;

          // Scale down if larger than maxDimension
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('Canvas context could not be acquired.');
          }

          // Draw image
          ctx.drawImage(img, 0, 0, width, height);

          // Always output high efficiency JPEG or preserve PNG if transparency
          const outMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const dataUrl = canvas.toDataURL(outMime, quality);

          // Calculate approximate byte size of base64
          const base64Length = dataUrl.length - (dataUrl.indexOf(',') + 1);
          const approximateBytes = Math.round((base64Length * 3) / 4);

          resolve({
            dataUrl,
            fileName: file.name,
            fileSize: approximateBytes,
            mimeType: outMime,
          });
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to decode image data.'));
      };

      img.src = readerEvent.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file from disk.'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Format raw byte size into human readable string (KB, MB)
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Audit storage footprint of evidence items in IndexedDB
 */
export function calculateEvidenceStorageSize(evidenceList: Evidence[]): {
  totalBytes: number;
  formattedSize: string;
  count: number;
} {
  let totalBytes = 0;

  for (const item of evidenceList) {
    if (item.fileSize && item.fileSize > 0) {
      totalBytes += item.fileSize;
    } else if (item.dataUrl) {
      const base64Length = item.dataUrl.length - (item.dataUrl.indexOf(',') + 1);
      totalBytes += Math.round((base64Length * 3) / 4);
    }
  }

  return {
    totalBytes,
    formattedSize: formatBytes(totalBytes),
    count: evidenceList.length,
  };
}
