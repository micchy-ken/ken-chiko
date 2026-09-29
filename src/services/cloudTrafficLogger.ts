/**
 * cloudTrafficLogger: Lightweight network and storage audit logger for Synology NAS PostgreSQL and local storage.
 * Completely free of Firebase dependencies.
 */

export type CloudOpType = 'READ' | 'WRITE' | 'DELETE' | 'BATCH_WRITE';
export type TrafficLogStatus = 'SUCCESS' | 'BLOCKED_CIRCUIT_BREAKER' | 'ERROR' | 'QUOTA_EXHAUSTED';

export interface TrafficLogEntry {
  id: string;
  timestamp: number;
  timeFormatted: string;
  type: CloudOpType;
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

export interface TrafficStats {
  totalReads: number;
  totalWrites: number;
  totalDeletes: number;
  totalBlocked: number;
  readsLastSec: number;
  readsLast10Sec: number;
  readsLastMinute: number;
  writesLastSec: number;
  writesLastMinute: number;
  isBreakerTripped: boolean;
  breakerTrippedUntil: number;
  breakerTripReason: string;
  breakerTripCount: number;
  quotaExhaustedUntil: number;
  quotaExhaustedReason: string;
  isQuotaExhausted: boolean;
}

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  maxReadsPerSec: 50,
  maxReadsPer10Sec: 200,
  maxReadsPerMinute: 500,
  maxWritesPerSec: 20,
  maxWritesPerMinute: 100,
  cooldownMs: 5000,
};

const TRAFFIC_STORAGE_KEY = 'kenchiko_cloud_audit_log_v1';
const MAX_STORED_LOGS = 200;

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

export function isFirestoreQuotaExhausted(): boolean {
  return false;
}

export function isCloudQuotaExhausted(): boolean {
  return false;
}

export function getQuotaExhaustedInfo(): { exhausted: boolean; reason: string; until: number } {
  return {
    exhausted: false,
    reason: '',
    until: 0,
  };
}

export function markQuotaExhausted(_reason: string, _durationMs: number = 0): void {}

export function clearQuotaExhausted(): void {}

export function getTrafficStats(): TrafficStats {
  const now = Date.now();
  let totalReads = 0;
  let totalWrites = 0;
  let totalDeletes = 0;
  let totalBlocked = 0;
  let readsLastSec = 0;
  let readsLast10Sec = 0;
  let readsLastMinute = 0;
  let writesLastSec = 0;
  let writesLastMinute = 0;

  for (const log of inMemoryLogs) {
    const age = now - log.timestamp;
    if (log.type === 'READ') totalReads++;
    if (log.type === 'WRITE' || log.type === 'BATCH_WRITE') totalWrites++;
    if (log.type === 'DELETE') totalDeletes++;
    if (log.status === 'BLOCKED_CIRCUIT_BREAKER') totalBlocked++;

    if (age <= 1000) {
      if (log.type === 'READ') readsLastSec++;
      if (log.type === 'WRITE' || log.type === 'BATCH_WRITE') writesLastSec++;
    }
    if (age <= 10000) {
      if (log.type === 'READ') readsLast10Sec++;
    }
    if (age <= 60000) {
      if (log.type === 'READ') readsLastMinute++;
      if (log.type === 'WRITE' || log.type === 'BATCH_WRITE') writesLastMinute++;
    }
  }

  return {
    totalReads,
    totalWrites,
    totalDeletes,
    totalBlocked,
    readsLastSec,
    readsLast10Sec,
    readsLastMinute,
    writesLastSec,
    writesLastMinute,
    isBreakerTripped: false,
    breakerTrippedUntil: 0,
    breakerTripReason: '',
    breakerTripCount: 0,
    quotaExhaustedUntil: 0,
    quotaExhaustedReason: '',
    isQuotaExhausted: false,
  };
}

export function getTrafficLogs(): TrafficLogEntry[] {
  return [...inMemoryLogs];
}

export function recordAuditLog(
  type: CloudOpType,
  caller: string,
  path: string,
  status: TrafficLogStatus = 'SUCCESS',
  durationMs?: number,
  error?: string,
  payloadSummary?: string
): void {
  const entry: TrafficLogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    timeFormatted: new Date().toLocaleTimeString('ja-JP', { hour12: false }),
    type,
    path,
    docId: path.split('/').pop() || '',
    collection: path.split('/')[0] || '',
    caller,
    status,
    durationMs,
    error,
    payloadSummary,
  };

  inMemoryLogs.unshift(entry);
  if (inMemoryLogs.length > MAX_STORED_LOGS) {
    inMemoryLogs = inMemoryLogs.slice(0, MAX_STORED_LOGS);
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(TRAFFIC_STORAGE_KEY, JSON.stringify(inMemoryLogs.slice(0, 50)));
    } catch {}
  }

  const stats = getTrafficStats();
  for (const listener of listeners) {
    try {
      listener(entry, stats);
    } catch {}
  }
}

export function subscribeTrafficChange(
  listener: (entry: TrafficLogEntry, stats: TrafficStats) => void
): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function clearTrafficLogs(): void {
  inMemoryLogs = [];
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.removeItem(TRAFFIC_STORAGE_KEY);
    } catch {}
  }
}

export function resetCircuitBreakerManual(): void {}
