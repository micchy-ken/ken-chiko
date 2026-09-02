/**
 * Helper to compress and resize uploaded images for Kenchiko and Nyans
 * Keeps images lightweight (~30-80KB WebP/JPEG) so they save smoothly in Firestore
 * and persist across sessions without exceeding document size limits.
 */

const LOCAL_KENCHIKO_IMAGE_KEY = 'kenchiko_custom_avatar_image';

export function saveLocalKenchikoImage(dataUrl: string): void {
  try {
    if (dataUrl) {
      localStorage.setItem(LOCAL_KENCHIKO_IMAGE_KEY, dataUrl);
    } else {
      localStorage.removeItem(LOCAL_KENCHIKO_IMAGE_KEY);
    }
  } catch (e) {
    console.warn('LocalStorage save note:', e);
  }
}

export function loadLocalKenchikoImage(): string | null {
  try {
    return localStorage.getItem(LOCAL_KENCHIKO_IMAGE_KEY);
  } catch (e) {
    return null;
  }
}

export async function compressAndResizeImage(
  fileOrDataUrl: File | string,
  maxWidth = 400,
  maxHeight = 400,
  quality = 0.88
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '');
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      try {
        // Try WebP first for compact size and alpha transparency support
        const webpData = canvas.toDataURL('image/webp', quality);
        if (webpData && webpData.startsWith('data:image/webp')) {
          resolve(webpData);
          return;
        }
      } catch (e) {
        // fallback
      }

      // Fallback to PNG / JPEG
      const pngData = canvas.toDataURL('image/png');
      resolve(pngData);
    };

    img.onerror = (err) => {
      reject(err);
    };

    if (typeof fileOrDataUrl === 'string') {
      img.src = fileOrDataUrl;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = (e.target?.result as string) || '';
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(fileOrDataUrl);
    }
  });
}
