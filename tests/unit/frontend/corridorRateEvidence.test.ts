import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { CorridorRateEvidence } from "@/components/corridors/CorridorRateEvidence";
import type { PublicRatesResponse } from "@/types/api/rates";
import { exposeReactForClassicJsx, fixtureAsApiResult } from "../../support/dashboardContracts";

exposeReactForClassicJsx();

const fixture = fixtureAsApiResult<{ status: 200; body: PublicRatesResponse }>("rates.healthy.success").body;

function render(rates: PublicRatesResponse): string {
  return renderToStaticMarkup(createElement(CorridorRateEvidence, { rates }));
}

test("renders evaluation and capture timestamps in stable explicit UTC", () => {
  const rates = { ...fixture, evaluatedAt: "2026-08-28T12:00:00.000Z" };
  const html = render(rates);
  assert.match(html, /2026-08-28 12:00:00Z UTC/);
  assert.match(html, /<time dateTime="2026-08-28T12:00:00\.000Z">2026-08-28 12:00:00Z UTC<\/time>/);
  assert.match(html, /2026-08-28 11:59:50Z UTC/);
  assert.match(html, /<time dateTime="2026-08-28T11:59:50\.000Z">2026-08-28 11:59:50Z UTC<\/time>/);
});

test("normalizes offset timestamps to the same UTC instant for display", () => {
  const rates: PublicRatesResponse = {
    ...fixture,
    evaluatedAt: "2026-08-28T14:00:00+02:00",
    observations: fixture.observations.map((observation, index) => index === 0
      ? { ...observation, capturedAt: "2026-08-28T13:59:50+02:00" }
      : observation),
  };
  const html = render(rates);
  assert.match(html, /2026-08-28 12:00:00Z UTC/);
  assert.match(html, /dateTime="2026-08-28T12:00:00\.000Z"/);
  assert.match(html, /2026-08-28 11:59:50Z UTC/);
  assert.match(html, /dateTime="2026-08-28T11:59:50\.000Z"/);
});

test("shows unavailable for missing and invalid timestamps without changing evidence state", () => {
  const rates: PublicRatesResponse = {
    ...fixture,
    evaluatedAt: "not-a-date",
    observations: fixture.observations.map((observation, index) => index === 0
      ? { ...observation, capturedAt: "" }
      : { ...observation, capturedAt: "2026-99-44T25:61:00Z" }),
  };
  const html = render(rates);
  assert.match(html, /Evaluated<\/dt><dd[^>]*>Unavailable<\/dd>/);
  assert.equal((html.match(/Unavailable/g) ?? []).length, 3);
  assert.doesNotMatch(html, /Invalid Date/);
  assert.match(html, /data-state="healthy"/);
  assert.match(html, /fresh/);
  assert.match(html, /Included/);
});

test("keeps timestamps on each observation row while preserving freshness and eligibility labels", () => {
  const rates: PublicRatesResponse = {
    ...fixture,
    observations: fixture.observations.map((observation, index) => index === 1
      ? { ...observation, eligibleForMedian: false, exclusionReason: "stale" }
      : observation),
  };
  const html = render(rates);
  assert.match(html, /Anchor/);
  assert.match(html, /Captured/);
  assert.match(html, /Persisted rate observations/);
  assert.match(html, /aria-describedby="rate-observations-scroll-hint"/);
  assert.match(html, /tabindex="0"/);
  assert.match(html, /fresh/);
  assert.match(html, /Included/);
  assert.match(html, /Excluded/);
  assert.match(html, /2026-08-28 11:59:50Z UTC/);
  assert.match(html, /2026-08-28 11:59:45Z UTC/);
});
