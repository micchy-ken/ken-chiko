import confettiBase from 'canvas-confetti';

/**
 * Defensive Polyfill:
 * In Chromium browsers and iframes where OffscreenCanvas is supported,
 * some libraries (including canvas-confetti when useWorker is true) attempt to invoke
 * canvas.getBoundingClientRect() on an OffscreenCanvas or transferred canvas object.
 * Because OffscreenCanvas does not inherit from Element, getBoundingClientRect is undefined,
 * causing: "TypeError: canvas.getBoundingClientRect is not a function".
 */
if (typeof OffscreenCanvas !== 'undefined' && !(OffscreenCanvas.prototype as any).getBoundingClientRect) {
  try {
    (OffscreenCanvas.prototype as any).getBoundingClientRect = function () {
      return {
        top: 0,
        left: 0,
        right: this.width || 0,
        bottom: this.height || 0,
        width: this.width || 0,
        height: this.height || 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };
    };
  } catch (e) {
    // Ignore if prototype is sealed
  }
}

// Ensure HTMLCanvasElement prototype has getBoundingClientRect fallback
if (typeof HTMLCanvasElement !== 'undefined' && !HTMLCanvasElement.prototype.getBoundingClientRect) {
  try {
    HTMLCanvasElement.prototype.getBoundingClientRect = function () {
      return {
        top: 0,
        left: 0,
        right: this.width || 0,
        bottom: this.height || 0,
        width: this.width || 0,
        height: this.height || 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };
    };
  } catch (e) {
    // Ignore if prototype is sealed
  }
}

let safeInstance: confettiBase.CreateTypes | null = null;

function getSafeConfettiInstance(): confettiBase.CreateTypes | null {
  if (!safeInstance && typeof window !== 'undefined' && typeof document !== 'undefined') {
    try {
      // By specifying useWorker: false, canvas-confetti will run strictly on the main thread via
      // requestAnimationFrame, bypassing OffscreenCanvas Web Worker creation and its associated
      // getBoundingClientRect resize crash in iframe/mobile environments.
      safeInstance = confettiBase.create(undefined as any, {
        resize: true,
        useWorker: false,
        disableForReducedMotion: true,
      });
    } catch {
      safeInstance = null;
    }
  }
  return safeInstance;
}

export type ConfettiOptions = confettiBase.Options;

/**
 * Safe confetti trigger that guarantees no uncaught exceptions will bubble up.
 */
export function triggerConfetti(options?: confettiBase.Options): Promise<null> | Promise<void> | void {
  try {
    if (typeof window === 'undefined') return;

    const instance = getSafeConfettiInstance();
    if (instance) {
      return instance(options);
    }
    // Fallback: direct call with error guard
    return confettiBase(options);
  } catch (err) {
    console.warn('[Confetti] Suppressed error during confetti execution:', err);
    return Promise.resolve(null);
  }
}

export default triggerConfetti;
