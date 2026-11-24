import type { Metadata } from "next";
import Link from "next/link";
import { ProductHeader } from "@/components/ui/ProductHeader";
import { getCorridorsApiResult } from "@/lib/api/corridors";
import { getRatesApiResult } from "@/lib/api/rates";
import { RateObservationBreakdownView } from "./RateObservationBreakdownView";

type Props = Readonly<{
  searchParams?: Promise<Readonly<{ corridor?: string }>>;
}>;

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rate Observation Breakdown — StellarCore",
  description: "Inspect persisted indicative rate observation amounts and reported fees by reviewed corridor.",
};

export default async function RateObservationBreakdownPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : {};
  const corridorsResult = await getCorridorsApiResult();
  const corridors = corridorsResult.status === 200 ? corridorsResult.body.corridors : [];
  const requested = params.corridor;
  const selectedSlug = requested && corridors.some((corridor) => corridor.slug === requested)
    ? requested
    : corridors[0]?.slug ?? "";
  const ratesResult = selectedSlug ? await getRatesApiResult(selectedSlug) : null;

  return (
    <>
      <ProductHeader current="insights" />
      <main id="main-content" className="min-h-screen bg-[var(--black)] px-4 py-8 text-[var(--white)] sm:px-8 sm:py-10 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <nav aria-label="Breadcrumb" className="text-xs text-[var(--muted)]">
            <Link href="/dashboard" className="underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]">Dashboard</Link>
            <span aria-hidden="true" className="px-2">/</span>
            <span aria-current="page">Rate Observation Breakdown</span>
          </nav>
          <header className="mt-8 max-w-3xl">
            <p className="eyebrow">Indicative Rate Evidence</p>
            <h1 className="mt-2 text-3xl leading-tight sm:text-4xl" style={{ fontFamily: "var(--display)" }}>Rate Observation Breakdown</h1>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
              Inspect the amounts and raw fees recorded for each anchor observation in a reviewed corridor. These are persisted indicative SEP-38 data, not executable prices, live offers, or firm quotes.
            </p>
          </header>
          {corridorsResult.status !== 200 ? (
            <p role="alert" className="mt-8 rounded-lg border border-[rgba(238,143,129,0.35)] bg-[rgba(238,143,129,0.08)] p-4 text-sm text-[#ee8f81]">Unable to load reviewed corridors: {corridorsResult.body.error.message}</p>
          ) : (
            <section aria-label="Observation evidence" className="mt-8">
              <RateObservationBreakdownView corridors={corridors} selectedCorridorSlug={selectedSlug} ratesResult={ratesResult} />
            </section>
          )}
        </div>
      </main>
    </>
  );
}
