import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createRateHistoryLoader } from "@/lib/rates/rateHistoryRequests";
import type { PublicRateHistoryResponse } from "@/types/api/rateHistory";

const CORRIDOR = "usdc-us-brl-br";

function history(windowDays: number, marker = `${windowDays}d`): PublicRateHistoryResponse {
  const markerSeconds = marker.startsWith("req-") ? Number(marker.slice(4)) : windowDays;
  return {
    corridor: {
      slug: CORRIDOR,
      sourceAsset: "USDC",
      sourceCountry: "US",
      destinationAsset: "BRL",
      destinationCountry: "BR",
    },
    evaluatedAt: new Date(Date.UTC(2026, 9, 1, 0, 0, markerSeconds)).toISOString(),
    windowDays,
    points: [],
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

type PendingRequest = {
  url: string;
  signal: AbortSignal;
  respond: (response: Response) => Promise<void>;
  fail: (error: Error) => Promise<void>;
};

/**
 * A fetch double whose responses are released explicitly by the test, in any
 * order. Like real fetch, a pending request rejects with AbortError when its
 * signal aborts.
 */
function controlledFetch() {
  const requests: PendingRequest[] = [];
  const fetchImpl = (url: string, init: { signal: AbortSignal }) =>
    new Promise<Response>((resolve, reject) => {
      const onAbort = () => reject(new DOMException("The operation was aborted.", "AbortError"));
      if (init.signal.aborted) onAbort();
      init.signal.addEventListener("abort", onAbort, { once: true });
      requests.push({
        url,
        signal: init.signal,
        respond: async (response) => {
          resolve(response);
          await flush();
        },
        fail: async (error) => {
          reject(error);
          await flush();
        },
      });
    });
  return { requests, fetchImpl };
}

/** Manual timers so timeouts fire only when the test says so. */
function manualTimers() {
  let nextId = 0;
  const pending = new Map<number, () => void>();
  return {
    setTimer: (callback: () => void) => {
      const id = ++nextId;
      pending.set(id, callback);
      return id;
    },
    clearTimer: (handle: unknown) => {
      pending.delete(handle as number);
    },
    fireAll: async () => {
      const callbacks = [...pending.values()];
      pending.clear();
      for (const callback of callbacks) callback();
      await flush();
    },
    get size() {
      return pending.size;
    },
  };
}

async function flush() {
  for (let i = 0; i < 10; i += 1) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

/** Mirrors the chart's state transitions so assertions read like UI state. */
function panelState() {
  const state = {
    history: null as PublicRateHistoryResponse | null,
    error: null as string | null,
    loading: false,
    settledCount: 0,
  };
  return {
    state,
    callbacks: {
      onSuccess: (data: PublicRateHistoryResponse) => {
        state.history = data;
        state.loading = false;
        state.settledCount += 1;
      },
      onError: (message: string) => {
        state.error = message;
        state.loading = false;
        state.settledCount += 1;
      },
    },
    begin: () => {
      state.loading = true;
      state.error = null;
    },
  };
}

function setup() {
  const network = controlledFetch();
  const timers = manualTimers();
  const panel = panelState();
  const loader = createRateHistoryLoader({
    corridorSlug: CORRIDOR,
    callbacks: panel.callbacks,
    fetchImpl: network.fetchImpl,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  const select = (days: number) => {
    panel.begin();
    void loader.load(days);
  };
  return { network, timers, panel, loader, select };
}

test("a slow earlier response cannot overwrite a newer response that completed first", async () => {
  const { network, panel, select } = setup();

  select(30);
  select(90);
  assert.equal(network.requests.length, 2);

  await network.requests[1]!.respond(jsonResponse(history(90)));
  assert.equal(panel.state.history?.windowDays, 90);
  assert.equal(panel.state.loading, false);

  await network.requests[0]!.respond(jsonResponse(history(30)));
  assert.equal(panel.state.history?.windowDays, 90, "stale 30D response must be discarded");
  assert.equal(panel.state.settledCount, 1);
});

test("sequencing discards a late response even when the transport ignores abort", async () => {
  const releases: Array<(response: Response) => void> = [];
  const panel = panelState();
  const loader = createRateHistoryLoader({
    corridorSlug: CORRIDOR,
    callbacks: panel.callbacks,
    fetchImpl: () => new Promise<Response>((resolve) => releases.push(resolve)),
    setTimer: () => 0,
    clearTimer: () => {},
  });

  panel.begin();
  void loader.load(30);
  panel.begin();
  void loader.load(90);

  releases[1]!(jsonResponse(history(90)));
  await flush();
  releases[0]!(jsonResponse(history(30)));
  await flush();

  assert.equal(panel.state.history?.windowDays, 90);
  assert.equal(panel.state.settledCount, 1);
});

test("in order completion still only applies the latest selection", async () => {
  const { network, panel, select } = setup();

  select(30);
  select(90);
  await network.requests[0]!.respond(jsonResponse(history(30)));
  assert.equal(panel.state.history, null, "superseded response is ignored");
  assert.equal(panel.state.loading, true, "loading stays on while the active request is pending");

  await network.requests[1]!.respond(jsonResponse(history(90)));
  // Re-read through a call: the assertion above narrowed the property to null.
  const latest = ((): PublicRateHistoryResponse | null => panel.state.history)();
  assert.equal(latest?.windowDays, 90);
  assert.equal(panel.state.loading, false);
});

test("starting a new request aborts the superseded one", () => {
  const { network, select } = setup();

  select(30);
  select(90);
  select(7);
  assert.equal(network.requests[0]!.signal.aborted, true);
  assert.equal(network.requests[1]!.signal.aborted, true);
  assert.equal(network.requests[2]!.signal.aborted, false);
  assert.match(network.requests[2]!.url, /corridor=usdc-us-brl-br&days=7$/);
});

test("a stale failure cannot surface an error over a newer success", async () => {
  const { network, panel, select } = setup();

  select(30);
  select(90);
  await network.requests[1]!.respond(jsonResponse(history(90)));
  await network.requests[0]!.respond(
    jsonResponse({ error: { code: "internal_error", message: "boom" } }, 500),
  );
  assert.equal(panel.state.error, null);
  assert.equal(panel.state.history?.windowDays, 90);
});

test("loading settles with the API error message when the active request fails", async () => {
  const { network, panel, select } = setup();

  select(30);
  await network.requests[0]!.respond(
    jsonResponse({ error: { code: "invalid_days", message: "Unsupported history window." } }, 400),
  );
  assert.equal(panel.state.loading, false);
  assert.equal(panel.state.error, "Unsupported history window.");
});

test("loading settles with a generic message on network failure", async () => {
  const { network, panel, select } = setup();

  select(30);
  await network.requests[0]!.fail(new TypeError(""));
  assert.equal(panel.state.loading, false);
  assert.equal(panel.state.error, "Unable to load rate history.");
});

test("a request that never responds times out instead of loading forever", async () => {
  const { network, timers, panel, select } = setup();

  select(30);
  assert.equal(timers.size, 1);
  await timers.fireAll();

  assert.equal(network.requests[0]!.signal.aborted, true);
  assert.equal(panel.state.loading, false);
  assert.equal(panel.state.error, "Rate history request timed out.");
});

test("timers are cleared once the active request settles", async () => {
  const { network, timers, select } = setup();

  select(30);
  await network.requests[0]!.respond(jsonResponse(history(30)));
  assert.equal(timers.size, 0);
});

test("a response for a different window is rejected rather than shown as the selection", async () => {
  const { network, panel, select } = setup();

  select(30);
  await network.requests[0]!.respond(jsonResponse(history(7)));
  assert.equal(panel.state.history, null);
  assert.equal(panel.state.loading, false);
  assert.equal(panel.state.error, "Rate history response was invalid.");
});

test("accepts valid history and a genuine empty points array", async () => {
  const { network, panel, select } = setup();

  select(30);
  await network.requests[0]!.respond(jsonResponse(history(30)));
  assert.equal(panel.state.history?.windowDays, 30);
  assert.equal(panel.state.error, null);

  select(90);
  await network.requests[1]!.respond(jsonResponse(history(90)));
  assert.deepEqual(panel.state.history?.points, []);
  assert.equal(panel.state.history?.windowDays, 90);

  select(7);
  await network.requests[2]!.respond(jsonResponse({
    ...history(7),
    points: [{
      timestamp: "2026-09-30T00:00:00.000Z",
      medianRate: null,
      state: "insufficient_fresh_sources",
      sourceCount: 0,
      freshSourceCount: 0,
      observations: [],
    }],
  }));
  assert.equal(panel.state.history?.points[0]?.medianRate, null);
  assert.equal(panel.state.history?.points[0]?.observations.length, 0);
});

test("rejects null or incomplete points using a fixed safe error and retains prior evidence", async () => {
  const { network, panel, select } = setup();

  select(30);
  await network.requests[0]!.respond(jsonResponse(history(30)));

  const malformed = [
    null,
    { timestamp: "2026-09-30T00:00:00.000Z" },
    {
      timestamp: "2026-09-30T00:00:00.000Z",
      medianRate: null,
      state: "healthy",
      sourceCount: 1,
      freshSourceCount: 1,
      observations: [null],
    },
    {
      timestamp: "not-a-date",
      medianRate: null,
      state: "healthy",
      sourceCount: 1,
      freshSourceCount: 1,
      observations: [],
    },
  ];

  for (const point of malformed) {
    select(90);
    await network.requests[network.requests.length - 1]!.respond(jsonResponse({
      ...history(90),
      points: [point],
    }));
    assert.equal(panel.state.history?.windowDays, 30);
    assert.equal(panel.state.error, "Rate history response was invalid.");
  }
});

test("rejects missing envelope fields and unexpected windows", async () => {
  const { network, panel, select } = setup();
  const malformedPayloads = [
    { ...history(30), evaluatedAt: undefined },
    { ...history(30), corridor: { slug: CORRIDOR } },
    { ...history(30), windowDays: 14 },
  ];

  for (const body of malformedPayloads) {
    select(30);
    await network.requests[network.requests.length - 1]!.respond(jsonResponse(body));
    assert.equal(panel.state.history, null);
    assert.equal(panel.state.error, "Rate history response was invalid.");
  }
});

test("rejects malformed observation elements before they reach the chart", async () => {
  const { network, panel, select } = setup();
  const malformedHistory = {
    ...history(30),
    points: [{
      timestamp: "2026-09-30T00:00:00.000Z",
      medianRate: "5.2",
      state: "healthy",
      sourceCount: 1,
      freshSourceCount: 1,
      observations: [{ anchor: null, rate: "5.2" }],
    }],
  };

  select(30);
  await network.requests[0]!.respond(jsonResponse(malformedHistory));
  assert.equal(panel.state.history, null);
  assert.equal(panel.state.error, "Rate history response was invalid.");
});

test("uses a fixed safe error for malformed JSON from a successful response", async () => {
  const { network, panel, select } = setup();

  select(30);
  await network.requests[0]!.respond(jsonResponse(history(30)));
  select(90);
  await network.requests[1]!.respond(new Response("{ malformed", { status: 200 }));

  assert.equal(panel.state.history?.windowDays, 30);
  assert.equal(panel.state.error, "Rate history response was invalid.");
  assert.doesNotMatch(panel.state.error ?? "", /malformed|JSON|Unexpected/);
});

test("ignores a malformed response from a superseded request", async () => {
  const { network, panel, select } = setup();

  select(30);
  select(90);
  await network.requests[1]!.respond(jsonResponse(history(90)));
  await network.requests[0]!.respond(jsonResponse({ ...history(30), points: [null] }));

  assert.equal(panel.state.history?.windowDays, 90);
  assert.equal(panel.state.error, null);
  assert.equal(panel.state.settledCount, 1);
});

test("disposing the loader aborts the pending request and suppresses late updates", async () => {
  const { network, panel, loader, select } = setup();

  select(30);
  loader.dispose();
  assert.equal(network.requests[0]!.signal.aborted, true);
  await flush();
  assert.equal(panel.state.settledCount, 0);

  select(90);
  assert.equal(network.requests.length, 1, "a disposed loader starts no new requests");
});

test("rapid reversed sequences always converge on the last selection", async () => {
  const { network, panel, select } = setup();
  const selections = [7, 30, 90, 30, 7];

  for (const days of selections) select(days);
  for (let i = network.requests.length - 1; i >= 0; i -= 1) {
    await network.requests[i]!.respond(jsonResponse(history(selections[i]!, `req-${i}`)));
  }

  assert.equal(panel.state.history?.evaluatedAt, "2026-10-01T00:00:04.000Z");
  assert.equal(panel.state.settledCount, 1);
  assert.equal(panel.state.loading, false);
});

test("the corridor chart routes timeframe requests through the sequenced loader", () => {
  const source = readFileSync(
    new URL("../../../components/corridors/CorridorRateHistoryChart.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /createRateHistoryLoader\(/);
  assert.match(source, /loader\.dispose\(\)/);
  assert.doesNotMatch(source, /\bfetch\(/, "the chart must not issue unsequenced requests");
});
