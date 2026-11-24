import type { Metadata } from "next";
import Link from "next/link";
import { ProductHeader } from "@/components/ui/ProductHeader";
import { MIN_FRESH_SOURCES, RATE_FRESHNESS_THRESHOLD_MS } from "@/constants/rates";

export const metadata: Metadata = {
  title: "Evidence and freshness states — StellarCore",
  description: "A plain-language guide to StellarCore's reviewed configuration, persisted evidence, freshness, and read states.",
};

const freshnessWindowSeconds = RATE_FRESHNESS_THRESHOLD_MS / 1000;

const states = [
  {
    id: "reviewed-configuration",
    title: "Reviewed configuration",
    body: "A reviewed anchor or corridor is included in StellarCore's maintained registry. Review means the relationship is intentionally listed for evidence collection; it does not establish that a transfer route is operational, that a service is currently available, or that a transfer has succeeded.",
  },
  {
    id: "synchronized-metadata",
    title: "Synchronized metadata",
    body: "Anchor names, status, associated corridors, and advertised SEP numbers reflect metadata persisted by a synchronization. An advertised SEP describes a declared interface. It is not a live reachability check or proof that the interface is accepting requests now.",
  },
  {
    id: "persisted-observation",
    title: "Persisted observation",
    body: "A rate observation is indicative SEP-38 data captured from a reviewed source and stored with its anchor identity and capture time. It records evidence seen at that time; it is not an executable price, live offer, firm quote, or instruction to transfer funds.",
  },
  {
    id: "freshness",
    title: "Freshness belongs to an observation",
    body: `Freshness is evaluated from an observation's capture time. Under the current ${freshnessWindowSeconds}-second threshold, recent valid evidence can be marked fresh; older evidence is stale and is excluded from the current median. Fresh describes evidence age, not whether an anchor or transfer service is operational.`,
  },
  {
    id: "insufficient-sources",
    title: "Insufficient independent sources",
    body: `A median is published only when at least ${MIN_FRESH_SOURCES} fresh independent sources are eligible. If the threshold is unmet, the read can still succeed: the API reports state "insufficient_fresh_sources" and medianRate null. One observation remains an observation; it is not promoted to a median.`,
  },
  {
    id: "stale-fallback",
    title: "Stale or degraded fallback",
    body: "Per-observation stale means that particular capture is too old for current median eligibility. A degraded response is different: when a current read cannot be completed, StellarCore may serve a verified last-known-good snapshot with stale metadata. Its timestamps still describe the original evidence; the fallback does not make that evidence current.",
  },
  {
    id: "failed-retrieval",
    title: "Failed retrieval is not an empty result",
    body: "A successful read with no matching observations is valid no data: for rates, the API can return HTTP 200, an empty observations array, and a null median. An unavailable read returns an API error when no usable fallback is available. Do not interpret an error, missing field, or unavailable response as zero or as proof that no evidence exists.",
  },
] as const;

export default function EvidenceStatesPage() {
  return (
    <>
      <ProductHeader current="dashboard" />
      <main id="main-content" className="min-h-screen bg-[var(--black)] px-4 py-8 text-[var(--white)] sm:px-8 sm:py-10 lg:px-12">
        <div className="mx-auto max-w-4xl">
          <nav aria-label="Breadcrumb" className="text-xs text-[var(--muted)]">
            <Link href="/dashboard" className="underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]">Dashboard</Link>
            <span aria-hidden="true" className="px-2">/</span>
            <span aria-current="page">Evidence and freshness</span>
          </nav>

          <header className="mt-8 max-w-3xl">
            <p className="eyebrow">Learn</p>
            <h1 className="mt-2 text-3xl leading-tight sm:text-4xl" style={{ fontFamily: "var(--display)" }}>How to read StellarCore evidence</h1>
            <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">
              StellarCore is a read-only view of reviewed configuration and persisted evidence. The labels below describe different stages of that evidence; none alone guarantees a currently available service.
            </p>
          </header>

          <section aria-labelledby="stages-heading" className="mt-8 rounded-lg border border-[var(--ghost)] bg-[var(--surface)] p-5 sm:p-6">
            <h2 id="stages-heading" className="text-xl" style={{ fontFamily: "var(--display)" }}>Evidence stages</h2>
            <ol className="mt-4 space-y-5 border-l border-[var(--ghost)] pl-4 sm:pl-6">
              {states.map((state, index) => (
                <li key={state.id} id={state.id} className="relative scroll-mt-6">
                  <span aria-hidden="true" className="absolute -left-[1.35rem] top-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--ghost)] bg-[var(--black)] text-[10px] text-[var(--accent)] sm:-left-[1.85rem]">{index + 1}</span>
                  <h3 className="text-base font-semibold text-[var(--white)]">{state.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{state.body}</p>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="example-heading" className="mt-6 rounded-lg border border-[var(--ghost)] bg-[var(--surface)] p-5 sm:p-6">
            <p className="eyebrow">Illustrative example · not live data</p>
            <h2 id="example-heading" className="mt-2 text-lg" style={{ fontFamily: "var(--display)" }}>Why a fresh observation may still have no median</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              Suppose an example corridor has one fresh observation and the current requirement is {MIN_FRESH_SOURCES} fresh independent sources. The observation can be shown as fresh, while the median remains unpublished because the independent-source threshold is not met. This example describes the rule only; it is not a report about a live anchor or corridor.
            </p>
          </section>

          <section aria-labelledby="references-heading" className="mt-6 rounded-lg border border-[var(--ghost)] bg-[var(--surface)] p-5 sm:p-6">
            <h2 id="references-heading" className="text-lg" style={{ fontFamily: "var(--display)" }}>Explore the evidence and technical contracts</h2>
            <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
              <li><Link href="/dashboard" className="text-[var(--white)] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]">Open the public dashboard</Link></li>
              <li><Link href="/docs/api-reference.md" className="text-[var(--white)] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]">Public API reference: response and error states</Link></li>
              <li><Link href="/docs/dashboard-guide.md" className="text-[var(--white)] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]">Dashboard guide: interpreting persisted evidence</Link></li>
              <li><Link href="/insights/rate-observation-breakdown" className="text-[var(--white)] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]">Inspect persisted rate observation fields</Link></li>
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-[var(--muted)]">
              Technical definitions: <code className="text-[var(--white)]">GET /api/anchors</code>, <code className="text-[var(--white)]">GET /api/corridors</code>, and <code className="text-[var(--white)]">GET /api/rates?corridor=&lt;slug&gt;</code> are read-only. Reading them does not trigger synchronization or a rate capture.
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
