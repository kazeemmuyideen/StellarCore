import Link from "next/link";
import type { PublicCorridor } from "@/types/api/corridors";
import type { RatesApiResult } from "@/types/api/rates";

type Props = Readonly<{
  corridors: readonly PublicCorridor[];
  selectedCorridorSlug: string;
  ratesResult: RatesApiResult | null;
}>;

export function RateObservationBreakdownView({ corridors, selectedCorridorSlug, ratesResult }: Props) {
  const selected = corridors.find(({ slug }) => slug === selectedCorridorSlug);
  const rates = ratesResult?.status === 200 ? ratesResult.body : null;
  const observations = rates?.observations ?? [];
  const pair = selected ? `${selected.sourceAsset} (${selected.sourceCountry}) → ${selected.destinationAsset} (${selected.destinationCountry})` : "No reviewed corridor";

  return (
    <div className="space-y-6">
      {corridors.length === 0 ? (
        <p role="status" className="rounded-lg border border-[var(--ghost)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">No reviewed corridors are currently available.</p>
      ) : (
        <form action="/insights/rate-observation-breakdown" method="get" className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--ghost)] bg-[var(--surface)] p-4">
          <div>
            <label htmlFor="breakdown-corridor" className="block text-xs uppercase tracking-wide text-[var(--muted)]">Reviewed Corridor</label>
            <select id="breakdown-corridor" name="corridor" defaultValue={selectedCorridorSlug} className="mt-1 max-w-full rounded border border-[var(--ghost)] bg-[var(--black)] px-3 py-2 text-sm text-[var(--white)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
              {corridors.map((corridor) => <option key={corridor.slug} value={corridor.slug}>{corridor.sourceAsset} ({corridor.sourceCountry}) → {corridor.destinationAsset} ({corridor.destinationCountry}) [{corridor.slug}]</option>)}
            </select>
          </div>
          <button type="submit" className="rounded border border-[var(--ghost)] px-4 py-2 text-sm hover:bg-[var(--black)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">View observations</button>
        </form>
      )}

      {ratesResult && ratesResult.status !== 200 ? (
        <p role="alert" className="rounded-lg border border-[rgba(238,143,129,0.35)] bg-[rgba(238,143,129,0.08)] p-4 text-sm text-[#ee8f81]">Unable to load observations: {ratesResult.body.error.message}</p>
      ) : null}

      {rates ? (
        <section aria-labelledby="breakdown-heading" className="rounded-lg border border-[var(--ghost)] bg-[var(--surface)] p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--ghost)] pb-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Selected Corridor</p>
              <h2 id="breakdown-heading" className="mt-1 text-xl" style={{ fontFamily: "var(--display)" }}>{pair}</h2>
            </div>
            <p className="text-xs text-[var(--muted)]">Evaluated <time dateTime={rates.evaluatedAt}>{new Date(rates.evaluatedAt).toLocaleString()}</time></p>
          </div>

          {rates.degraded ? <p role="status" className="mt-4 rounded border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-400">Showing persisted last-known-good indicative evidence because the current read is temporarily unavailable.</p> : null}
          <div className="mt-4 rounded border border-[var(--ghost)] p-3 text-sm">
            <p><span className="text-[var(--muted)]">Median rate: </span>{rates.medianRate ?? "Unavailable"}</p>
            {rates.medianRate === null ? <p className="mt-1 text-xs text-[var(--muted)]">Insufficient eligible fresh independent sources ({rates.freshSourceCount} fresh of {rates.medianRequirement.minimumFreshIndependentSources} required); no median is published.</p> : null}
          </div>

          {observations.length === 0 ? (
            <p role="status" className="mt-4 p-8 text-center text-sm text-[var(--muted)]">No individual rate observations are currently persisted for this corridor.</p>
          ) : (
            <div className="mt-4">
              <p id="breakdown-scroll-hint" className="sr-only">The evidence table scrolls horizontally on narrow screens. Use the horizontal scroll area to view all columns.</p>
              <div role="region" aria-label={`Persisted rate observations for ${pair}`} aria-describedby="breakdown-scroll-hint" tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]">
                <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                  <caption className="sr-only">Persisted indicative SEP-38 amounts, reported fee, rate, source anchor, capture timestamp, freshness, and median eligibility for {pair}.</caption>
                  <thead><tr className="border-b border-[var(--ghost)] text-xs uppercase tracking-wide text-[var(--muted)]">
                    <th scope="col" className="px-3 py-3 font-medium">Anchor</th><th scope="col" className="px-3 py-3 font-medium">Source Amount ({rates.corridor.sourceAsset})</th><th scope="col" className="px-3 py-3 font-medium">Destination Amount ({rates.corridor.destinationAsset})</th><th scope="col" className="px-3 py-3 font-medium">Raw Fee (as reported)</th><th scope="col" className="px-3 py-3 font-medium">Rate</th><th scope="col" className="px-3 py-3 font-medium">Captured At</th><th scope="col" className="px-3 py-3 font-medium">Freshness</th><th scope="col" className="px-3 py-3 font-medium">Median Eligibility</th>
                  </tr></thead>
                  <tbody>{observations.map((observation, index) => (
                    <tr key={`${observation.anchor.slug}-${observation.capturedAt}-${index}`} className="border-b border-[var(--ghost)] align-top last:border-0 hover:bg-[rgba(255,255,255,0.02)]">
                      <th scope="row" className="px-3 py-3 text-xs font-medium"><Link href={`/anchors/${observation.anchor.slug}`} className="underline underline-offset-2 hover:text-[var(--accent)] focus-visible:outline-1 focus-visible:outline-[var(--accent)]">{observation.anchor.name || observation.anchor.slug}</Link><span className="mt-1 block font-mono text-[10px] text-[var(--muted)]">{observation.anchor.slug}</span></th>
                      <td className="break-all px-3 py-3 font-mono text-xs">{observation.sourceAmount}</td><td className="break-all px-3 py-3 font-mono text-xs">{observation.destinationAmount}</td><td className="break-all px-3 py-3 font-mono text-xs">{observation.fee || "Not reported"}</td><td className="break-all px-3 py-3 font-mono text-xs">{observation.rate}</td>
                      <td className="px-3 py-3 font-mono text-xs"><time dateTime={observation.capturedAt}>{new Date(observation.capturedAt).toLocaleString()}</time></td><td className="px-3 py-3 text-xs">{observation.freshness.state.replaceAll("_", " ")}</td>
                      <td className="px-3 py-3 text-xs">{observation.eligibleForMedian ? "Eligible" : `Not eligible${observation.exclusionReason ? ` · ${observation.exclusionReason.replaceAll("_", " ")}` : ""}`}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
