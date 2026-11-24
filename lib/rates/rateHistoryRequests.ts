import type { PublicRateHistoryResponse } from "@/types/api/rateHistory";

export const RATE_HISTORY_REQUEST_TIMEOUT_MS = 10_000;

const DEFAULT_ERROR_MESSAGE = "Unable to load rate history.";
const TIMEOUT_ERROR_MESSAGE = "Rate history request timed out.";
const INVALID_RESPONSE_ERROR_MESSAGE = "Rate history response was invalid.";
const SUPPORTED_WINDOWS = new Set([7, 30, 90]);

type FetchLike = (input: string, init: { signal: AbortSignal }) => Promise<Response>;

export type RateHistoryLoaderCallbacks = Readonly<{
  onSuccess: (history: PublicRateHistoryResponse, days: number) => void;
  onError: (message: string, days: number) => void;
}>;

export type RateHistoryLoaderOptions = Readonly<{
  corridorSlug: string;
  callbacks: RateHistoryLoaderCallbacks;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}>;

export type RateHistoryLoader = Readonly<{
  load: (days: number) => Promise<void>;
  dispose: () => void;
}>;

/**
 * Sequences client-side rate-history requests for one chart panel.
 *
 * Only the most recent `load` may report a result: starting a new request aborts
 * the previous one, and any response that still arrives late is discarded by its
 * sequence number. Every active request settles with exactly one callback —
 * success, error, or timeout — so the caller's loading state cannot hang.
 */
export function createRateHistoryLoader(options: RateHistoryLoaderOptions): RateHistoryLoader {
  const {
    corridorSlug,
    callbacks,
    fetchImpl = (input, init) => fetch(input, init),
    timeoutMs = RATE_HISTORY_REQUEST_TIMEOUT_MS,
    setTimer = (callback, ms) => setTimeout(callback, ms),
    clearTimer = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  } = options;

  let sequence = 0;
  let activeController: AbortController | null = null;
  let disposed = false;

  async function load(days: number): Promise<void> {
    if (disposed) return;

    activeController?.abort();
    const controller = new AbortController();
    activeController = controller;
    const requestId = ++sequence;
    const isCurrent = () => !disposed && requestId === sequence;

    let timedOut = false;
    const timer = setTimer(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetchImpl(
        `/api/rates/history?corridor=${encodeURIComponent(corridorSlug)}&days=${days}`,
        { signal: controller.signal },
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error?.message ?? DEFAULT_ERROR_MESSAGE);
      }
      let data: unknown;
      try {
        data = await response.json();
      } catch {
        throw new Error(INVALID_RESPONSE_ERROR_MESSAGE);
      }
      if (!isCurrent()) return;
      if (!isValidHistoryResponse(data, corridorSlug, days)) {
        throw new Error(INVALID_RESPONSE_ERROR_MESSAGE);
      }
      callbacks.onSuccess(data, days);
    } catch (err) {
      if (!isCurrent()) return;
      if (timedOut) {
        callbacks.onError(TIMEOUT_ERROR_MESSAGE, days);
        return;
      }
      callbacks.onError(err instanceof Error && err.message ? err.message : DEFAULT_ERROR_MESSAGE, days);
    } finally {
      clearTimer(timer);
      if (activeController === controller) {
        activeController = null;
      }
    }
  }

  function dispose() {
    disposed = true;
    activeController?.abort();
    activeController = null;
  }

  return { load, dispose };
}

function isValidHistoryResponse(
  value: unknown,
  corridorSlug: string,
  requestedDays: number,
): value is PublicRateHistoryResponse {
  if (!isRecord(value) || !isRecord(value.corridor)) return false;
  if (
    value.corridor.slug !== corridorSlug
    || typeof value.corridor.sourceAsset !== "string"
    || typeof value.corridor.sourceCountry !== "string"
    || typeof value.corridor.destinationAsset !== "string"
    || typeof value.corridor.destinationCountry !== "string"
    || !SUPPORTED_WINDOWS.has(requestedDays)
    || value.windowDays !== requestedDays
    || !isTimestamp(value.evaluatedAt)
    || !Array.isArray(value.points)
  ) {
    return false;
  }

  return value.points.every(isValidHistoryPoint);
}

function isValidHistoryPoint(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (
    !isTimestamp(value.timestamp)
    || !(value.medianRate === null || typeof value.medianRate === "string")
    || !(value.state === "healthy" || value.state === "insufficient_fresh_sources")
    || !isNonNegativeCount(value.sourceCount)
    || !isNonNegativeCount(value.freshSourceCount)
    || !Array.isArray(value.observations)
  ) {
    return false;
  }

  return value.observations.every(isValidHistoryObservation);
}

function isValidHistoryObservation(value: unknown): boolean {
  return isRecord(value)
    && isRecord(value.anchor)
    && typeof value.anchor.slug === "string"
    && typeof value.anchor.name === "string"
    && typeof value.rate === "string"
    && typeof value.sourceAmount === "string"
    && typeof value.destinationAmount === "string"
    && typeof value.fee === "string"
    && isTimestamp(value.capturedAt);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && Number.isFinite(Date.parse(value));
}
