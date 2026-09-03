/**
 * Smart background removal and image optimization engine for Kenchiko & Nyans.
 * Uses edge-seeded flood fill, color de-fringing, and alpha-feathering
 * to isolate hand-drawn sketches on white/cream paper without destroying
 * internal white details (e.g. white T-shirts, glasses reflection, teeth).
 */

const LOCAL_KENCHIKO_IMAGE_KEY = 'kenchiko_custom_avatar_image';
const LOCAL_KENCHIKO_RAW_IMAGE_KEY = 'kenchiko_raw_original_image';

const LOCAL_KIHON_NYAN_IMAGE_KEY = 'kihon_nyan_custom_base_image';
const LOCAL_KIHON_NYAN_RAW_IMAGE_KEY = 'kihon_nyan_raw_original_image';

export function saveLocalKenchikoImage(dataUrl: string, rawDataUrl?: string): void {
  try {
    if (dataUrl) {
      localStorage.setItem(LOCAL_KENCHIKO_IMAGE_KEY, dataUrl);
      if (rawDataUrl) {
        localStorage.setItem(LOCAL_KENCHIKO_RAW_IMAGE_KEY, rawDataUrl);
      }
    } else {
      localStorage.removeItem(LOCAL_KENCHIKO_IMAGE_KEY);
      localStorage.removeItem(LOCAL_KENCHIKO_RAW_IMAGE_KEY);
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

export function loadLocalKenchikoRawImage(): string | null {
  try {
    return localStorage.getItem(LOCAL_KENCHIKO_RAW_IMAGE_KEY);
  } catch (e) {
    return null;
  }
}

export function saveLocalKihonNyanImage(dataUrl: string, rawDataUrl?: string): void {
  try {
    if (dataUrl) {
      localStorage.setItem(LOCAL_KIHON_NYAN_IMAGE_KEY, dataUrl);
      if (rawDataUrl) {
        localStorage.setItem(LOCAL_KIHON_NYAN_RAW_IMAGE_KEY, rawDataUrl);
      }
    } else {
      localStorage.removeItem(LOCAL_KIHON_NYAN_IMAGE_KEY);
      localStorage.removeItem(LOCAL_KIHON_NYAN_RAW_IMAGE_KEY);
    }
  } catch (e) {
    console.warn('LocalStorage save note:', e);
  }
}

export function loadLocalKihonNyanImage(): string | null {
  try {
    return localStorage.getItem(LOCAL_KIHON_NYAN_IMAGE_KEY);
  } catch (e) {
    return null;
  }
}

export function loadLocalKihonNyanRawImage(): string | null {
  try {
    return localStorage.getItem(LOCAL_KIHON_NYAN_RAW_IMAGE_KEY);
  } catch (e) {
    return null;
  }
}

export interface TransparencyOptions {
  enableTransparency: boolean;
  tolerance: number; // 5 to 80 (default ~30)
  feather: number; // 1 to 5 (edge smoothing)
  trimPadding: boolean;
}

/**
 * Perform smart background removal on a canvas
 */
export function processBackgroundTransparency(
  canvas: HTMLCanvasElement,
  options: TransparencyOptions
): HTMLCanvasElement {
  if (!options.enableTransparency) return canvas;

  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || width === 0 || height === 0) return canvas;

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // 1. Sample background colors along the perimeter
  const samples: { r: number; g: number; b: number }[] = [];
  const sampleStep = Math.max(1, Math.floor(Math.min(width, height) / 20));

  for (let x = 0; x < width; x += sampleStep) {
    // Top border
    let idx = (0 * width + x) * 4;
    samples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
    // Bottom border
    idx = ((height - 1) * width + x) * 4;
    samples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
  }

  for (let y = 0; y < height; y += sampleStep) {
    // Left border
    let idx = (y * width + 0) * 4;
    samples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
    // Right border
    idx = (y * width + (width - 1)) * 4;
    samples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
  }

  // Calculate average background color
  let totalR = 0, totalG = 0, totalB = 0;
  for (const s of samples) {
    totalR += s.r;
    totalG += s.g;
    totalB += s.b;
  }
  const avgBgR = totalR / samples.length;
  const avgBgG = totalG / samples.length;
  const avgBgB = totalB / samples.length;

  const tolerance = Math.max(5, Math.min(100, options.tolerance));
  const tolSq = tolerance * tolerance * 3; // RGB squared distance tolerance

  // Helper to test if a pixel matches background
  const isBgMatch = (r: number, g: number, b: number): number => {
    // Check distance to average bg
    const dR = r - avgBgR;
    const dG = g - avgBgG;
    const dB = b - avgBgB;
    const distSq = dR * dR + dG * dG + dB * dB;

    // Also check if pixel is near-white (> 240 in all channels)
    const isPureWhite = r >= 242 && g >= 242 && b >= 242;

    if (distSq <= tolSq || isPureWhite) {
      const dist = Math.sqrt(distSq);
      return dist;
    }
    return -1;
  };

  // 2. Flood fill BFS starting from all 4 borders
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  // Seed borders
  for (let x = 0; x < width; x++) {
    // Top
    const topIdx = 0 * width + x;
    const p0 = topIdx * 4;
    if (isBgMatch(data[p0], data[p0 + 1], data[p0 + 2]) >= 0) {
      visited[topIdx] = 1;
      queue.push(topIdx);
    }
    // Bottom
    const botIdx = (height - 1) * width + x;
    const p1 = botIdx * 4;
    if (isBgMatch(data[p1], data[p1 + 1], data[p1 + 2]) >= 0) {
      visited[botIdx] = 1;
      queue.push(botIdx);
    }
  }

  for (let y = 0; y < height; y++) {
    // Left
    const leftIdx = y * width + 0;
    const p0 = leftIdx * 4;
    if (isBgMatch(data[p0], data[p0 + 1], data[p0 + 2]) >= 0 && !visited[leftIdx]) {
      visited[leftIdx] = 1;
      queue.push(leftIdx);
    }
    // Right
    const rightIdx = y * width + (width - 1);
    const p1 = rightIdx * 4;
    if (isBgMatch(data[p1], data[p1 + 1], data[p1 + 2]) >= 0 && !visited[rightIdx]) {
      visited[rightIdx] = 1;
      queue.push(rightIdx);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];
    const cx = curr % width;
    const cy = Math.floor(curr / width);

    // Check 4-connected neighbors
    const neighbors = [
      cx > 0 ? curr - 1 : -1,
      cx < width - 1 ? curr + 1 : -1,
      cy > 0 ? curr - width : -1,
      cy < height - 1 ? curr + width : -1,
    ];

    for (const n of neighbors) {
      if (n >= 0 && visited[n] === 0) {
        const p = n * 4;
        const matchDist = isBgMatch(data[p], data[p + 1], data[p + 2]);
        if (matchDist >= 0) {
          visited[n] = 1;
          queue.push(n);
        }
      }
    }
  }

  // 3. Apply transparency and soft edge de-fringing
  for (let i = 0; i < width * height; i++) {
    if (visited[i] === 1) {
      const p = i * 4;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];

      const dR = r - avgBgR;
      const dG = g - avgBgG;
      const dB = b - avgBgB;
      const dist = Math.sqrt(dR * dR + dG * dG + dB * dB);

      // Feathering edge
      const softEdgeThreshold = tolerance * 0.7;
      if (dist < softEdgeThreshold) {
        data[p + 3] = 0; // completely transparent
      } else {
        // smooth gradient transition
        const factor = (dist - softEdgeThreshold) / (tolerance - softEdgeThreshold + 0.001);
        const alpha = Math.max(0, Math.min(255, Math.floor(factor * 255)));
        data[p + 3] = alpha;

        // De-fringe: blend out white background influence from line edge
        if (alpha > 0) {
          const unmix = alpha / 255;
          data[p] = Math.max(0, Math.min(255, Math.floor((r - (1 - unmix) * avgBgR) / unmix)));
          data[p + 1] = Math.max(0, Math.min(255, Math.floor((g - (1 - unmix) * avgBgG) / unmix)));
          data[p + 2] = Math.max(0, Math.min(255, Math.floor((b - (1 - unmix) * avgBgB) / unmix)));
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // 4. Optional: Trim empty padding so the character centers neatly
  if (options.trimPadding) {
    let minX = width, minY = height, maxX = 0, maxY = 0;
    let hasContent = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (data[idx + 3] > 20) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          hasContent = true;
        }
      }
    }

    if (hasContent && (minX > 10 || minY > 10 || maxX < width - 10 || maxY < height - 10)) {
      const pad = 12;
      const cropX = Math.max(0, minX - pad);
      const cropY = Math.max(0, minY - pad);
      const cropW = Math.min(width - cropX, maxX - minX + pad * 2);
      const cropH = Math.min(height - cropY, maxY - minY + pad * 2);

      const maxDim = Math.max(cropW, cropH);
      const trimmedCanvas = document.createElement('canvas');
      trimmedCanvas.width = maxDim;
      trimmedCanvas.height = maxDim;
      const trimCtx = trimmedCanvas.getContext('2d');
      if (trimCtx) {
        const destX = Math.round((maxDim - cropW) / 2);
        const destY = Math.round((maxDim - cropH) / 2);
        trimCtx.drawImage(canvas, cropX, cropY, cropW, cropH, destX, destY, cropW, cropH);
        return trimmedCanvas;
      }
    }
  }

  return canvas;
}

/**
 * Main compression & processing entrypoint
 */
export async function compressAndResizeImage(
  fileOrDataUrl: File | string,
  maxWidth = 600,
  maxHeight = 600,
  quality = 0.9,
  transparencyOpts?: TransparencyOptions
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

      let canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '');
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Apply background transparency if requested
      if (transparencyOpts && transparencyOpts.enableTransparency) {
        canvas = processBackgroundTransparency(canvas, transparencyOpts);
      }

      try {
        // Use PNG or WebP to guarantee alpha transparency channel
        const pngData = canvas.toDataURL('image/png');
        resolve(pngData);
      } catch (e) {
        // Fallback
        const fallbackData = canvas.toDataURL();
        resolve(fallbackData);
      }
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
