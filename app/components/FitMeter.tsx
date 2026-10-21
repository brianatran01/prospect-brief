import type { FitRating } from "@/lib/types";

const DOTS: Record<FitRating, number> = { strong: 3, good: 2, possible: 1, not_yet: 0 };

/** Fit as three pink segments plus a label. Green and red stay reserved for the fact check. */
export function FitMeter({ rating, label, big = false }: { rating: FitRating; label: string; big?: boolean }) {
  const on = DOTS[rating];
  return (
    <span className={big ? "fit fit-big" : "fit"}>
      <span className="fit-bar" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <i key={i} className={i < on ? "on" : undefined} />
        ))}
      </span>
      <span className="fit-label">{label}</span>
    </span>
  );
}
