import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import EvidenceStatesPage from "@/app/learn/evidence-states/page";
import { MIN_FRESH_SOURCES, RATE_FRESHNESS_THRESHOLD_MS } from "@/constants/rates";
import { exposeReactForClassicJsx } from "../../support/dashboardContracts";

exposeReactForClassicJsx();

const pageSource = readFileSync(new URL("../../../app/learn/evidence-states/page.tsx", import.meta.url), "utf8");

test("explains evidence stages and binds threshold and freshness window to current constants", () => {
  const html = renderToStaticMarkup(createElement(EvidenceStatesPage));
  assert.match(html, /Reviewed configuration/);
  assert.match(html, /Synchronized metadata/);
  assert.match(html, /Persisted observation/);
  assert.match(html, /Freshness belongs to an observation/);
  assert.match(html, /Insufficient independent sources/);
  assert.match(html, /Stale or degraded fallback/);
  assert.match(html, /Failed retrieval is not an empty result/);
  assert.match(html, new RegExp(`at least ${MIN_FRESH_SOURCES} fresh independent sources`));
  assert.match(html, new RegExp(`${RATE_FRESHNESS_THRESHOLD_MS / 1000}-second threshold`));
  assert.match(pageSource, /MIN_FRESH_SOURCES/);
  assert.match(pageSource, /RATE_FRESHNESS_THRESHOLD_MS/);
});

test("distinguishes empty data, insufficient evidence, and failed retrieval", () => {
  const html = renderToStaticMarkup(createElement(EvidenceStatesPage));
  assert.match(html, /HTTP 200, an empty observations array, and a null median/);
  assert.match(html, /state "insufficient_fresh_sources" and medianRate null/);
  assert.match(html, /An unavailable read returns an API error/);
  assert.match(html, /Do not interpret an error, missing field, or unavailable response as zero/);
});

test("labels the example as illustrative and avoids claims of operational routes or current availability", () => {
  const html = renderToStaticMarkup(createElement(EvidenceStatesPage));
  assert.match(html, /Illustrative example · not live data/);
  assert.match(html, /not a report about a live anchor or corridor/);
  assert.match(html, /does not establish that a transfer route is operational/);
  assert.match(html, /An advertised SEP describes a declared interface/);
  assert.doesNotMatch(html, /verified transfer route/);
});

test("provides internal links to dashboard and relevant technical references", () => {
  const html = renderToStaticMarkup(createElement(EvidenceStatesPage));
  assert.match(html, /href="\/dashboard"/);
  assert.match(html, /href="\/docs\/api-reference\.md"/);
  assert.match(html, /href="\/docs\/dashboard-guide\.md"/);
  assert.match(html, /href="\/insights\/rate-observation-breakdown"/);
  assert.match(html, /focus-visible:outline-2/);
  assert.match(html, /<main id="main-content"/);
});
