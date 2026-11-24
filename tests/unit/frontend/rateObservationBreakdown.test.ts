import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { RateObservationBreakdownView } from "@/app/insights/rate-observation-breakdown/RateObservationBreakdownView";
import type { PublicCorridor } from "@/types/api/corridors";
import type { RatesApiResult } from "@/types/api/rates";
import { exposeReactForClassicJsx, fixtureAsApiResult } from "../../support/dashboardContracts";

exposeReactForClassicJsx();

const pageSource = readFileSync(new URL("../../../app/insights/rate-observation-breakdown/page.tsx", import.meta.url), "utf8");
const corridors: readonly PublicCorridor[] = [{ slug: "usdc-us-brl-br", sourceAsset: "USDC", sourceCountry: "US", destinationAsset: "BRL", destinationCountry: "BR", anchorCount: 2 }];

function render(result: RatesApiResult | null): string {
  return renderToStaticMarkup(createElement(RateObservationBreakdownView, {
    corridors,
    selectedCorridorSlug: corridors[0].slug,
    ratesResult: result,
  }));
}

test("page reads reviewed corridor and persisted rates through existing read models", () => {
  assert.match(pageSource, /getCorridorsApiResult/);
  assert.match(pageSource, /getRatesApiResult\(selectedSlug\)/);
  assert.match(pageSource, /<RateObservationBreakdownView/);
  assert.match(pageSource, /persisted indicative SEP-38 data/);
  assert.match(pageSource, /not executable prices, live offers, or firm quotes/);
});

test("renders every source observation with raw amounts, fee, identity, and capture provenance", () => {
  const result = fixtureAsApiResult<RatesApiResult>("rates.healthy.success");
  const html = render(result);
  assert.match(html, /<select/);
  assert.match(html, /Source Amount \(USDC\)/);
  assert.match(html, /Destination Amount \(BRL\)/);
  assert.match(html, /Raw Fee \(as reported\)/);
  assert.match(html, /100\.000000000000000000/);
  assert.match(html, /524\.000000000000000000/);
  assert.match(html, /1\.000000000000000000/);
  assert.match(html, /Cowrie/);
  assert.match(html, /Zeam/);
  assert.match(html, /2026-08-28T11:59:50\.000Z/);
  assert.match(html, /Eligible/);
  assert.match(html, /dateTime="2026-08-28T11:59:50\.000Z"/);
});

test("keeps null median distinct from the individual observations", () => {
  const html = render(fixtureAsApiResult<RatesApiResult>("rates.insufficient.success"));
  assert.match(html, /Median rate: <\/span>Unavailable/);
  assert.match(html, /Insufficient eligible fresh independent sources/);
  assert.match(html, /Not eligible · stale/);
  assert.match(html, /5\.100000000000000000/);
  assert.doesNotMatch(html, /Median rate: <\/span>0/);
});

test("shows a legitimately empty observation set separately from API failure", () => {
  const empty = render(fixtureAsApiResult<RatesApiResult>("rates.empty.success"));
  assert.match(empty, /No individual rate observations are currently persisted/);
  const failed = render(fixtureAsApiResult<RatesApiResult>("rates.error_500"));
  assert.match(failed, /Unable to load observations: Unable to read rates\./);
  assert.doesNotMatch(failed, /No individual rate observations are currently persisted/);
});

test("does not assign a currency denomination to the API fee", () => {
  const html = render(fixtureAsApiResult<RatesApiResult>("rates.healthy.success"));
  assert.match(html, /Raw Fee \(as reported\)/);
  assert.doesNotMatch(html, /Fee \(USDC\)|Fee \(BRL\)/);
});
