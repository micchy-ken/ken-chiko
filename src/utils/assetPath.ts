import React from 'react';

/**
 * Universal Asset URL resolver for GitHub Pages, Custom Domains, and Preview environments.
 * Ensures relative and base-aware path resolution so images never 404 regardless of deployment subpaths.
 */

export function getAssetUrl(path: string | null | undefined): string {
  if (!path) return '';
  
  // Data URLs, Blobs, and external HTTP(S) URLs
  if (
    path.startsWith('data:') ||
    path.startsWith('blob:') ||
    path.startsWith('http://') ||
    path.startsWith('https://')
  ) {
    return path;
  }

  // Strip leading slashes to append cleanly to BASE_URL
  const cleanPath = path.replace(/^\/+/, '');
  
  const rawBase = import.meta.env.BASE_URL || './';
  const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
  
  return `${base}${cleanPath}`;
}

/**
 * Standard default image paths with guaranteed cross-environment resolution.
 */
export const ASSET_PATHS = {
  KIHON_NYAN_SQUARE: getAssetUrl('images/kihon-nyan-square.jpg'),
  KIHON_NYAN_TRANSPARENT: getAssetUrl('images/kihon-nyan-transparent.png'),
  KIHON_NYAN_GDRIVE: getAssetUrl('images/kihon-nyan-gdrive.jpg'),
  BASE_NYANKO_SQUARE: getAssetUrl('images/base-nyanko-square.jpg'),
  BASE_NYANKO: getAssetUrl('images/base-nyanko.jpg'),
  HOMURA_NYAN_SQUARE: getAssetUrl('images/homura-nyan-square.jpg'),
  HOMURA_NYAN_TRANSPARENT: getAssetUrl('images/homura-nyan-transparent.png'),
};

/**
 * Image error handler that attempts fallback paths (e.g. relative path fallback)
 */
export function handleImageError(
  event: React.SyntheticEvent<HTMLImageElement, Event>,
  fallbackPath?: string
): void {
  const img = event.currentTarget;
  if (!img) return;

  const currentSrc = img.src;
  
  // If fallback is provided and hasn't been tried yet
  if (fallbackPath && !currentSrc.endsWith(fallbackPath)) {
    img.src = getAssetUrl(fallbackPath);
    return;
  }

  // If was absolute '/images/...', try relative './images/...'
  if (currentSrc.includes('/images/')) {
    const imageName = currentSrc.split('/images/').pop();
    if (imageName && !img.dataset.retried) {
      img.dataset.retried = 'true';
      img.src = `./images/${imageName}`;
      return;
    }
  }

  // Ultimate fallback to square base cat
  if (!img.dataset.finalFallback) {
    img.dataset.finalFallback = 'true';
    img.src = ASSET_PATHS.KIHON_NYAN_SQUARE;
  }
}
