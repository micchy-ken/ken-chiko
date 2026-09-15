import {
  DocumentReference,
  DocumentSnapshot,
  SetOptions,
  getDoc,
  setDoc,
  deleteDoc,
  WriteBatch,
  writeBatch,
  Firestore,
} from 'firebase/firestore';

export type FirestoreOpType = 'READ' | 'WRITE' | 'DELETE' | 'BATCH_WRITE';
export type TrafficLogStatus = 'SUCCESS' | 'BLOCKED_CIRCUIT_BREAKER' | 'ERROR' | 'QUOTA_EXHAUSTED';

export interface TrafficLogEntry {
  id: string;
  timestamp: number;
  timeFormatted: string;
  type: FirestoreOpType;
  path: string;
  docId: string;
  collection: string;
  caller: string;
  status: TrafficLogStatus;
  durationMs?: number;
  error?: string;
  payloadSummary?: string;
  stackSnippet?: string;
}

export interface CircuitBreakerConfig {
  maxReadsPerSec: number;
  maxReadsPer10Sec: number;
  maxReadsPerMinute: number;
  maxWritesPerSec: number;
  maxWritesPerMinute: number;
  cooldownMs: number;
}

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  maxReadsPerSec: 10,
  maxReadsPer10Sec: 35,
  maxReadsPerMinute: 70,
  maxWritesPerSec: 4,
  maxWritesPerMinute: 20,
  cooldownMs: 30000, // 30 seconds cooldown when tripped
};

const TRAFFIC_STORAGE_KEY = 'kenchiko_firestore_audit_log_v1';
const MAX_STORED_LOGS = 300;

// In-memory sliding windows for rate monitoring
const recentReadTimestamps: number[] = [];
const recentWriteTimestamps: number[] = [];

// Circuit breaker state
let isBreakerTripped = false;
let breakerTrippedUntil = 0;
let breakerTripReason = '';
let breakerTripCount = 0;

// Global Quota Exhaustion protection state (prevents spamming Google Cloud when daily limit reached)
let quotaExhaustedUntil = 0;
let quotaExhaustedReason = '';

// In-flight read deduplication (Promise sharing across simultaneous callers)
const inFlightGetDocPromises = new Map<string, Promise<DocumentSnapshot>>();

// Short read cache (2.5s TTL to eliminate duplicate reads during multi-component render bursts)
const shortReadCache = new Map<string, { snapshot: DocumentSnapshot; timestamp: number }>();
const SHORT_CACHE_TTL_MS = 2500;

export function isFirestoreQuotaExhausted(): boolean {
  return Date.now() < quotaExhaustedUntil;
}

export function getQuotaExhaustedInfo(): { exhausted: boolean; reason: string; until: number } {
  const exhausted = Date.now() < quotaExhaustedUntil;
  return {
    exhausted,
    reason: quotaExhaustedReason,
    until: quotaExhaustedUntil,
  };
}

export function markQuotaExhausted(reason: string, durationMs: number = 15 * 60 * 1000): void {
  quotaExhaustedUntil = Date.now() + durationMs;
  quotaExhaustedReason = reason;
  console.warn(
    `%c🛑【FIRESTORE クォータ上限発動】\n理由: ${reason}\n今後${Math.round(durationMs / 60000)}分間、全Firestore通信をブラウザ側で即時遮断しローカル保護モードで稼働します。`,
    'color: white; background: #ea580c; font-size: 13px; font-weight: bold; padding: 4px 8px; border-radius: 4px;'
  );
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('kenchiko-quota-exhausted', {
          detail: { reason, until: quotaExhaustedUntil },
        })
      );
    }
  } catch {}
}

export function clearQuotaExhausted(): void {
  quotaExhaustedUntil = 0;
  quotaExhaustedReason = '';
  console.log('🔄 クォータ保護モードを手動解除しました');
}

// Log buffer
let inMemoryLogs: TrafficLogEntry[] = [];
let listeners: Array<(entry: TrafficLogEntry, stats: TrafficStats) => void> = [];

// Initialize logs from localStorage if present
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const raw = localStorage.getItem(TRAFFIC_STORAGE_KEY);
    if (raw) {
      inMemoryLogs = JSON.parse(raw);
    }
  } catch {}
}

export interface TrafficStats {
  totalReads: number;
  totalWrites: number;
  totalDeletes: number;
  totalBlocked: number;
  readsLastMinute: number;
  writesLastMinute: number;
  isBreakerTripped: boolean;
  breakerTrippedUntil: number;
  breakerTripReason: string;
  isQuotaExhausted: boolean;
  quotaExhaustedUntil: number;
  quotaExhaustedReason: string;
  topRequestedDocs: Array<{ path: string; count: number; lastAccess: string; type: string }>;
}

/**
 * Extracts a concise, clean caller identity from the current execution stack.
 */
function extractCaller(): { caller: string; stackSnippet: string } {
  try {
    const err = new Error();
    const stack = err.stack || '';
    const lines = stack.split('\n');
    // Filter out internal interceptor frames
    const relevantLine = lines.find(
      (line, idx) =>
        idx > 1 &&
        !line.includes('firestoreTrafficLogger') &&
        !line.includes('extractCaller') &&
        !line.includes('node_modules')
    );
    if (relevantLine) {
      const trimmed = relevantLine.trim();
      const match = trimmed.match(/at\s+(?:async\s+)?([^\s(]+)?\s*\(?([^)]+)\)?/);
      if (match) {
        const fnName = match[1] || 'anonymous';
        const fileLoc = match[2] || '';
        const shortFile = fileLoc.replace(/^.*[\\/](src[\\/][^?#]+).*$/, '$1');
        return {
          caller: `${fnName} (${shortFile})`,
          stackSnippet: lines.slice(2, 6).map((l) => l.trim()).join('\n'),
        };
      }
      return { caller: trimmed.slice(0, 80), stackSnippet: lines.slice(2, 6).join('\n') };
    }
  } catch {}
  return { caller: 'unknown', stackSnippet: '' };
}

/**
 * Clean sliding window timestamps older than 60 seconds
 */
function pruneSlidingWindows(now: number): void {
  const oneMinAgo = now - 60000;
  while (recentReadTimestamps.length > 0 && recentReadTimestamps[0] < oneMinAgo) {
    recentReadTimestamps.shift();
  }
  while (recentWriteTimestamps.length > 0 && recentWriteTimestamps[0] < oneMinAgo) {
    recentWriteTimestamps.shift();
  }
}

/**
 * Evaluates whether a requested operation violates rate limits and trips the circuit breaker.
 */
function checkCircuitBreaker(
  type: FirestoreOpType,
  now: number,
  config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG
): { allowed: boolean; reason?: string } {
  // If already tripped, check if cooldown has elapsed
  if (isBreakerTripped) {
    if (now < breakerTrippedUntil) {
      return {
        allowed: false,
        reason: `🚨 サーキットブレーカー作動中: ${breakerTripReason} (残り解除時間: ${Math.ceil((breakerTrippedUntil - now) / 1000)}秒)`,
      };
    }
    // Cooldown ended, reset breaker
    isBreakerTripped = false;
    breakerTripReason = '';
  }

  pruneSlidingWindows(now);

  if (type === 'READ') {
    const readsLastSec = recentReadTimestamps.filter((t) => t >= now - 1000).length;
    const readsLast10Sec = recentReadTimestamps.filter((t) => t >= now - 10000).length;
    const readsLastMinute = recentReadTimestamps.length;

    if (readsLastSec >= config.maxReadsPerSec) {
      tripBreaker(`1秒間に${readsLastSec + 1}回のRead集中検知 (閾値: ${config.maxReadsPerSec}回/秒)`, now, config.cooldownMs);
      return { allowed: false, reason: breakerTripReason };
    }
    if (readsLast10Sec >= config.maxReadsPer10Sec) {
      tripBreaker(`10秒間に${readsLast10Sec + 1}回のRead集中検知 (閾値: ${config.maxReadsPer10Sec}回/10秒)`, now, config.cooldownMs);
      return { allowed: false, reason: breakerTripReason };
    }
    if (readsLastMinute >= config.maxReadsPerMinute) {
      tripBreaker(`1分間に${readsLastMinute + 1}回のRead集中検知 (閾値: ${config.maxReadsPerMinute}回/分)`, now, config.cooldownMs);
      return { allowed: false, reason: breakerTripReason };
    }
  } else if (type === 'WRITE' || type === 'BATCH_WRITE' || type === 'DELETE') {
    const writesLastSec = recentWriteTimestamps.filter((t) => t >= now - 1000).length;
    const writesLastMinute = recentWriteTimestamps.length;

    if (writesLastSec >= config.maxWritesPerSec) {
      tripBreaker(`1秒間に${writesLastSec + 1}回のWrite集中検知 (閾値: ${config.maxWritesPerSec}回/秒)`, now, config.cooldownMs);
      return { allowed: false, reason: breakerTripReason };
    }
    if (writesLastMinute >= config.maxWritesPerMinute) {
      tripBreaker(`1分間に${writesLastMinute + 1}回のWrite集中検知 (閾値: ${config.maxWritesPerMinute}回/分)`, now, config.cooldownMs);
      return { allowed: false, reason: breakerTripReason };
    }
  }

  return { allowed: true };
}

function tripBreaker(reason: string, now: number, cooldownMs: number): void {
  isBreakerTripped = true;
  breakerTrippedUntil = now + cooldownMs;
  breakerTripReason = reason;
  breakerTripCount++;

  console.error(
    `%c🚨【FIREBASEサーキットブレーカー発動】\n理由: ${reason}\n無料枠保護のため、今後${Math.round(cooldownMs / 1000)}秒間の通信を物理的に強制遮断します。`,
    'color: white; background: #dc2626; font-size: 14px; font-weight: bold; padding: 4px 8px; border-radius: 4px;'
  );

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('kenchiko-circuit-breaker-tripped', {
        detail: { reason, cooldownMs, trippedUntil: breakerTrippedUntil },
      })
    );
  }
}

/**
 * Append entry to log buffer and notify subscribers
 */
function recordLogEntry(entry: TrafficLogEntry): void {
  inMemoryLogs.unshift(entry);
  if (inMemoryLogs.length > MAX_STORED_LOGS) {
    inMemoryLogs.length = MAX_STORED_LOGS;
  }

  // Persist throttled to localStorage
  try {
    localStorage.setItem(TRAFFIC_STORAGE_KEY, JSON.stringify(inMemoryLogs.slice(0, 100)));
  } catch {}

  const stats = getTrafficStats();
  listeners.forEach((listener) => {
    try {
      listener(entry, stats);
    } catch {}
  });
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number, w: number = 2) => String(n).padStart(w, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

// ==========================================
// AUDITED FIRESTORE OPERATIONS (INTERCEPTORS)
// ==========================================

/**
 * Safely intercepted getDoc with rate limiting, logging, and circuit breaking.
 */
export async function auditedGetDoc(
  docRef: DocumentReference,
  callerName?: string,
  options?: { forceFresh?: boolean }
): Promise<DocumentSnapshot> {
  const now = Date.now();
  const path = docRef.path;
  const docId = docRef.id;
  const collection = docRef.parent.id;
  const { caller: detectedCaller, stackSnippet } = extractCaller();
  const effectiveCaller = callerName || detectedCaller;

  // 1. Quota Exhaustion Check: If Google Cloud quota is exhausted, immediately reject without touching network!
  if (isFirestoreQuotaExhausted() && !options?.forceFresh) {
    const errorMsg = `Firestore無料枠上限に達しています（ローカル保護モードで通信完全停止中: 残り${Math.max(1, Math.ceil((quotaExhaustedUntil - now) / 60000))}分）`;
    const blockedEntry: TrafficLogEntry = {
      id: `log-${now}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now,
      timeFormatted: formatTime(now),
      type: 'READ',
      path,
      docId,
      collection,
      caller: effectiveCaller,
      status: 'QUOTA_EXHAUSTED',
      error: errorMsg,
      payloadSummary: '通信完全停止 (0 Reads / ローカル保護モード稼働中)',
      stackSnippet,
    };
    recordLogEntry(blockedEntry);

    const err = new Error(errorMsg);
    (err as any).code = 'resource-exhausted';
    throw err;
  }

  // 2. Short Cache Check (2.5s window to absorb duplicate renders across sibling components)
  if (!options?.forceFresh) {
    const cached = shortReadCache.get(path);
    if (cached && now - cached.timestamp < SHORT_CACHE_TTL_MS) {
      const snap = cached.snapshot;
      const cachedEntry: TrafficLogEntry = {
        id: `log-${now}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: now,
        timeFormatted: formatTime(now),
        type: 'READ',
        path,
        docId,
        collection,
        caller: effectiveCaller,
        status: 'SUCCESS',
        durationMs: 0,
        payloadSummary: `キャッシュ利用 (0 Reads / 重複読込防止)`,
        stackSnippet,
      };
      recordLogEntry(cachedEntry);
      return snap;
    }

    // 3. In-Flight Read Deduplication: Share Promise for simultaneous requests to the same document
    const inFlight = inFlightGetDocPromises.get(path);
    if (inFlight) {
      const startInFlight = performance.now();
      try {
        const snap = await inFlight;
        const durationMs = Math.round(performance.now() - startInFlight);
        const mergedEntry: TrafficLogEntry = {
          id: `log-${now}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: now,
          timeFormatted: formatTime(now),
          type: 'READ',
          path,
          docId,
          collection,
          caller: effectiveCaller,
          status: 'SUCCESS',
          durationMs,
          payloadSummary: `同時通信マージ (0 Reads / Promise共有)`,
          stackSnippet,
        };
        recordLogEntry(mergedEntry);
        return snap;
      } catch (inFlightErr) {
        throw inFlightErr;
      }
    }
  }

  // 4. Rate check & Circuit Breaker
  const breakerCheck = checkCircuitBreaker('READ', now);
  if (!breakerCheck.allowed) {
    const blockedEntry: TrafficLogEntry = {
      id: `log-${now}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now,
      timeFormatted: formatTime(now),
      type: 'READ',
      path,
      docId,
      collection,
      caller: effectiveCaller,
      status: 'BLOCKED_CIRCUIT_BREAKER',
      error: breakerCheck.reason,
      stackSnippet,
    };
    recordLogEntry(blockedEntry);

    const err = new Error(breakerCheck.reason);
    (err as any).code = 'resource-exhausted-breaker';
    throw err;
  }

  recentReadTimestamps.push(now);

  const start = performance.now();
  const fetchPromise = (async () => {
    try {
      const snap = await getDoc(docRef);
      shortReadCache.set(path, { snapshot: snap, timestamp: Date.now() });
      return snap;
    } finally {
      inFlightGetDocPromises.delete(path);
    }
  })();

  inFlightGetDocPromises.set(path, fetchPromise);

  try {
    const snap = await fetchPromise;
    const durationMs = Math.round(performance.now() - start);

    const logEntry: TrafficLogEntry = {
      id: `log-${now}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now,
      timeFormatted: formatTime(now),
      type: 'READ',
      path,
      docId,
      collection,
      caller: effectiveCaller,
      status: 'SUCCESS',
      durationMs,
      payloadSummary: snap.exists() ? `存在 (約${JSON.stringify(snap.data()).length} bytes)` : '存在なし (404)',
      stackSnippet,
    };
    recordLogEntry(logEntry);
    return snap;
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - start);
    const errMsg = err?.message || String(err);
    const isQuota = errMsg.includes('quota') || errMsg.includes('resource-exhausted') || err?.code === 'resource-exhausted' || err?.status === 429;

    if (isQuota) {
      markQuotaExhausted(errMsg, 15 * 60 * 1000);
    }

    const errorEntry: TrafficLogEntry = {
      id: `log-${now}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now,
      timeFormatted: formatTime(now),
      type: 'READ',
      path,
      docId,
      collection,
      caller: effectiveCaller,
      status: isQuota ? 'QUOTA_EXHAUSTED' : 'ERROR',
      durationMs,
      error: errMsg,
      stackSnippet,
    };
    recordLogEntry(errorEntry);
    throw err;
  }
}

/**
 * Safely intercepted setDoc with rate limiting, logging, and circuit breaking.
 */
export async function auditedSetDoc(
  docRef: DocumentReference,
  data: any,
  options?: SetOptions,
  callerName?: string
): Promise<void> {
  const now = Date.now();
  const path = docRef.path;
  const docId = docRef.id;
  const collection = docRef.parent.id;
  const { caller: detectedCaller, stackSnippet } = extractCaller();
  const effectiveCaller = callerName || detectedCaller;

  // Invalidate read cache for this document on write
  shortReadCache.delete(path);

  // Quota check
  if (isFirestoreQuotaExhausted()) {
    const errorMsg = `Firestore無料枠上限に達しています（ローカル保護モードで書き込み停止中: 残り${Math.max(1, Math.ceil((quotaExhaustedUntil - now) / 60000))}分）`;
    const blockedEntry: TrafficLogEntry = {
      id: `log-${now}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now,
      timeFormatted: formatTime(now),
      type: 'WRITE',
      path,
      docId,
      collection,
      caller: effectiveCaller,
      status: 'QUOTA_EXHAUSTED',
      error: errorMsg,
      payloadSummary: `書き込み遮断 (0 Writes / ローカル保護モード)`,
      stackSnippet,
    };
    recordLogEntry(blockedEntry);

    const err = new Error(errorMsg);
    (err as any).code = 'resource-exhausted';
    throw err;
  }

  const breakerCheck = checkCircuitBreaker('WRITE', now);
  if (!breakerCheck.allowed) {
    const blockedEntry: TrafficLogEntry = {
      id: `log-${now}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now,
      timeFormatted: formatTime(now),
      type: 'WRITE',
      path,
      docId,
      collection,
      caller: effectiveCaller,
      status: 'BLOCKED_CIRCUIT_BREAKER',
      error: breakerCheck.reason,
      payloadSummary: `ペイロードサイズ: 約${JSON.stringify(data || {}).length} bytes`,
      stackSnippet,
    };
    recordLogEntry(blockedEntry);

    const err = new Error(breakerCheck.reason);
    (err as any).code = 'resource-exhausted-breaker';
    throw err;
  }

  recentWriteTimestamps.push(now);

  const start = performance.now();
  try {
    if (options) {
      await setDoc(docRef, data, options);
    } else {
      await setDoc(docRef, data);
    }
    const durationMs = Math.round(performance.now() - start);

    const logEntry: TrafficLogEntry = {
      id: `log-${now}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now,
      timeFormatted: formatTime(now),
      type: 'WRITE',
      path,
      docId,
      collection,
      caller: effectiveCaller,
      status: 'SUCCESS',
      durationMs,
      payloadSummary: `書き込み完了 (約${JSON.stringify(data || {}).length} bytes, merge: ${Boolean((options as any)?.merge)})`,
      stackSnippet,
    };
    recordLogEntry(logEntry);
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - start);
    const errMsg = err?.message || String(err);
    const isQuota = errMsg.includes('quota') || errMsg.includes('resource-exhausted') || err?.code === 'resource-exhausted' || err?.status === 429;

    if (isQuota) {
      markQuotaExhausted(errMsg, 15 * 60 * 1000);
    }

    const errorEntry: TrafficLogEntry = {
      id: `log-${now}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now,
      timeFormatted: formatTime(now),
      type: 'WRITE',
      path,
      docId,
      collection,
      caller: effectiveCaller,
      status: isQuota ? 'QUOTA_EXHAUSTED' : 'ERROR',
      durationMs,
      error: errMsg,
      stackSnippet,
    };
    recordLogEntry(errorEntry);
    throw err;
  }
}

/**
 * Safely intercepted deleteDoc
 */
export async function auditedDeleteDoc(
  docRef: DocumentReference,
  callerName?: string
): Promise<void> {
  const now = Date.now();
  const path = docRef.path;
  const docId = docRef.id;
  const collection = docRef.parent.id;
  const { caller: detectedCaller, stackSnippet } = extractCaller();
  const effectiveCaller = callerName || detectedCaller;

  shortReadCache.delete(path);

  if (isFirestoreQuotaExhausted()) {
    const errorMsg = `Firestore無料枠上限に達しています（ローカル保護モードで削除停止中）`;
    const err = new Error(errorMsg);
    (err as any).code = 'resource-exhausted';
    throw err;
  }

  const breakerCheck = checkCircuitBreaker('DELETE', now);
  if (!breakerCheck.allowed) {
    const blockedEntry: TrafficLogEntry = {
      id: `log-${now}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now,
      timeFormatted: formatTime(now),
      type: 'DELETE',
      path,
      docId,
      collection,
      caller: effectiveCaller,
      status: 'BLOCKED_CIRCUIT_BREAKER',
      error: breakerCheck.reason,
      stackSnippet,
    };
    recordLogEntry(blockedEntry);
    throw new Error(breakerCheck.reason);
  }

  recentWriteTimestamps.push(now);

  const start = performance.now();
  try {
    await deleteDoc(docRef);
    const durationMs = Math.round(performance.now() - start);
    const logEntry: TrafficLogEntry = {
      id: `log-${now}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now,
      timeFormatted: formatTime(now),
      type: 'DELETE',
      path,
      docId,
      collection,
      caller: effectiveCaller,
      status: 'SUCCESS',
      durationMs,
      stackSnippet,
    };
    recordLogEntry(logEntry);
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - start);
    const errMsg = err?.message || String(err);
    const isQuota = errMsg.includes('quota') || errMsg.includes('resource-exhausted') || err?.code === 'resource-exhausted';
    if (isQuota) {
      markQuotaExhausted(errMsg, 15 * 60 * 1000);
    }
    const errorEntry: TrafficLogEntry = {
      id: `log-${now}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now,
      timeFormatted: formatTime(now),
      type: 'DELETE',
      path,
      docId,
      collection,
      caller: effectiveCaller,
      status: isQuota ? 'QUOTA_EXHAUSTED' : 'ERROR',
      durationMs,
      error: errMsg,
      stackSnippet,
    };
    recordLogEntry(errorEntry);
    throw err;
  }
}

/**
 * Intercepted writeBatch commit
 */
export function auditedWriteBatch(db: Firestore, callerName?: string): WriteBatch {
  const batch = writeBatch(db);
  const originalCommit = batch.commit.bind(batch);
  const { caller: detectedCaller, stackSnippet } = extractCaller();
  const effectiveCaller = callerName || detectedCaller;

  batch.commit = async () => {
    const now = Date.now();
    shortReadCache.clear();

    if (isFirestoreQuotaExhausted()) {
      const errorMsg = `Firestore無料枠上限に達しています（ローカル保護モードでBatch書き込み停止中）`;
      const err = new Error(errorMsg);
      (err as any).code = 'resource-exhausted';
      throw err;
    }

    const breakerCheck = checkCircuitBreaker('BATCH_WRITE', now);
    if (!breakerCheck.allowed) {
      const blockedEntry: TrafficLogEntry = {
        id: `log-${now}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: now,
        timeFormatted: formatTime(now),
        type: 'BATCH_WRITE',
        path: 'batch-commit',
        docId: 'batch',
        collection: 'multi',
        caller: effectiveCaller,
        status: 'BLOCKED_CIRCUIT_BREAKER',
        error: breakerCheck.reason,
        stackSnippet,
      };
      recordLogEntry(blockedEntry);
      throw new Error(breakerCheck.reason);
    }

    recentWriteTimestamps.push(now);
    const start = performance.now();
    try {
      await originalCommit();
      const durationMs = Math.round(performance.now() - start);
      const logEntry: TrafficLogEntry = {
        id: `log-${now}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: now,
        timeFormatted: formatTime(now),
        type: 'BATCH_WRITE',
        path: 'batch-commit',
        docId: 'batch',
        collection: 'multi',
        caller: effectiveCaller,
        status: 'SUCCESS',
        durationMs,
        payloadSummary: 'Batch Commit 成功',
        stackSnippet,
      };
      recordLogEntry(logEntry);
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - start);
      const errMsg = err?.message || String(err);
      const isQuota = errMsg.includes('quota') || errMsg.includes('resource-exhausted') || err?.code === 'resource-exhausted';
      if (isQuota) {
        markQuotaExhausted(errMsg, 15 * 60 * 1000);
      }
      const errorEntry: TrafficLogEntry = {
        id: `log-${now}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: now,
        timeFormatted: formatTime(now),
        type: 'BATCH_WRITE',
        path: 'batch-commit',
        docId: 'batch',
        collection: 'multi',
        caller: effectiveCaller,
        status: isQuota ? 'QUOTA_EXHAUSTED' : 'ERROR',
        durationMs,
        error: errMsg,
        stackSnippet,
      };
      recordLogEntry(errorEntry);
      throw err;
    }
  };

  return batch;
}

// ==========================================
// STATS & QUERY UTILITIES
// ==========================================

export function getTrafficLogs(): TrafficLogEntry[] {
  return [...inMemoryLogs];
}

export function clearTrafficLogs(): void {
  inMemoryLogs = [];
  try {
    localStorage.removeItem(TRAFFIC_STORAGE_KEY);
  } catch {}
  const stats = getTrafficStats();
  listeners.forEach((l) => l({} as any, stats));
}

export function resetCircuitBreakerManual(): void {
  isBreakerTripped = false;
  breakerTrippedUntil = 0;
  breakerTripReason = '';
  recentReadTimestamps.length = 0;
  recentWriteTimestamps.length = 0;
  console.log('🔄 サーキットブレーカーを手動でリセットしました');
}

export function getTrafficStats(): TrafficStats {
  const now = Date.now();
  pruneSlidingWindows(now);

  let totalReads = 0;
  let totalWrites = 0;
  let totalDeletes = 0;
  let totalBlocked = 0;

  const docCountMap = new Map<string, { count: number; lastAccess: string; type: string }>();

  for (const log of inMemoryLogs) {
    if (log.type === 'READ') totalReads++;
    else if (log.type === 'WRITE' || log.type === 'BATCH_WRITE') totalWrites++;
    else if (log.type === 'DELETE') totalDeletes++;

    if (log.status === 'BLOCKED_CIRCUIT_BREAKER') {
      totalBlocked++;
    }

    const key = log.path || 'unknown';
    const cur = docCountMap.get(key) || { count: 0, lastAccess: log.timeFormatted, type: log.type };
    cur.count++;
    docCountMap.set(key, cur);
  }

  const topRequestedDocs = Array.from(docCountMap.entries())
    .map(([path, data]) => ({ path, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalReads,
    totalWrites,
    totalDeletes,
    totalBlocked,
    readsLastMinute: recentReadTimestamps.length,
    writesLastMinute: recentWriteTimestamps.length,
    isBreakerTripped: isBreakerTripped && now < breakerTrippedUntil,
    breakerTrippedUntil,
    breakerTripReason,
    isQuotaExhausted: now < quotaExhaustedUntil,
    quotaExhaustedUntil,
    quotaExhaustedReason,
    topRequestedDocs,
  };
}

export function subscribeTrafficChange(
  callback: (entry: TrafficLogEntry, stats: TrafficStats) => void
): () => void {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((l) => l !== callback);
  };
}
