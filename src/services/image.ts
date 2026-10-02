/**
 * Compresses uploaded screenshot image using browser Canvas to WebP/JPEG.
 * Keeps evidence storage lightweight and portable.
 * Enforces 5MB limit, MIME type validation, and downscaling.
 */
export interface ImageProcessResult {
  dataUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export async function processEvidenceImage(
  file: File,
  maxWidth = 1600,
  maxHeight = 1200,
  quality = 0.82
): Promise<ImageProcessResult> {
  // Validate MIME type
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files (PNG, JPEG, WebP) are allowed.');
  }

  // Validate maximum 5MB input size to prevent IndexedDB storage bloat
  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error('Image exceeds 5MB limit. Please upload a smaller screenshot.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const rawUrl = e.target?.result as string;
          resolve({
            dataUrl: rawUrl,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
          });
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        let finalUrl: string;
        let mime = 'image/jpeg';
        try {
          const webpData = canvas.toDataURL('image/webp', quality);
          if (webpData.startsWith('data:image/webp')) {
            finalUrl = webpData;
            mime = 'image/webp';
          } else {
            finalUrl = canvas.toDataURL('image/jpeg', quality);
          }
        } catch {
          finalUrl = canvas.toDataURL('image/jpeg', quality);
        }

        const base64Len = finalUrl.length - (finalUrl.indexOf(',') + 1);
        const approxBytes = Math.round((base64Len * 3) / 4);

        resolve({
          dataUrl: finalUrl,
          fileName: file.name,
          fileSize: approxBytes,
          mimeType: mime,
        });
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function compressImage(file: File, maxWidth = 1600, maxHeight = 1200, quality = 0.82): Promise<string> {
  const result = await processEvidenceImage(file, maxWidth, maxHeight, quality);
  return result.dataUrl;
}
