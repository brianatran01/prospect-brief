"use client";

import type { DetectedTool, ScanResult, ToolCategory } from "@/lib/types";
import { formatPrice } from "@/lib/products";
import { FitMeter } from "./FitMeter";

export type Row =
  | { key: string; state: "queued" | "scanning" }
  | { key: string; state: "done"; scan: ScanResult }
  | { key: string; state: "error"; message: string };

const OTHER: ToolCategory[] = ["support", "reviews", "subscriptions", "ads"];

function Chips({ tools }: { tools: DetectedTool[] }) {
  if (!tools.length) return <span className="dash">–</span>;
  return (
    <span className="chips">
      {tools.map((t) => (
        <span
          key={t.id}
          className={t.listed ? "chip chip-listed" : "chip"}
          title={t.listed ? `${t.name}: an OuterSignal integration` : t.name}
        >
          {t.name}
        </span>
      ))}
    </span>
  );
}

function catalogSummary(scan: ScanResult): string {
  const c = scan.catalog;
  if (!c) return "No public catalog";
  const count = `${c.count}${c.capped ? "+" : ""} ${c.count === 1 && !c.capped ? "product" : "products"}`;
  if (c.minPrice === null || c.maxPrice === null) return count;
  const range = c.minPrice === c.maxPrice ? formatPrice(c.minPrice) : `${formatPrice(c.minPrice)}–${formatPrice(c.maxPrice)}`;
  return `${count}, ${range}`;
}

type TableProps = {
  rows: Row[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onRetry: (key: string) => void;
};

export function ProspectTable({ rows, selectedKey, onSelect, onRetry }: TableProps) {
  let rank = 0;
  return (
    <div className="table-wrap">
      <table className="prospects">
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Rank</span>
            </th>
            <th scope="col">Store</th>
            <th scope="col">Fit</th>
            <th scope="col">Email</th>
            <th scope="col">SMS</th>
            <th scope="col">Other tools</th>
            <th scope="col">Catalog</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            if (row.state !== "done") {
              return (
                <tr key={row.key}>
                  <td className="rank" />
                  <td>
                    <span className="store-btn">
                      <strong>{row.key}</strong>
                    </span>
                  </td>
                  <td colSpan={5}>
                    {row.state === "error" ? (
                      <span className="row-error" role="alert">
                        {row.message}
                        <button type="button" className="link-btn" onClick={() => onRetry(row.key)}>
                          Try again
                        </button>
                      </span>
                    ) : (
                      <span className="row-status" role="status">
                        {row.state === "scanning" ? "Scanning…" : "Waiting…"}
                        {row.state === "scanning" && <span className="scan-bar" aria-hidden="true" />}
                      </span>
                    )}
                  </td>
                </tr>
              );
            }

            const { scan } = row;
            rank += 1;
            const selected = row.key === selectedKey;
            return (
              <tr key={row.key} className={selected ? "is-selected" : undefined} onClick={() => onSelect(row.key)}>
                <td className="rank">{rank}</td>
                <td>
                  <button
                    type="button"
                    className="store-btn"
                    aria-pressed={selected}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(row.key);
                    }}
                  >
                    <strong>{scan.name}</strong>
                    <span className="host">{scan.host}</span>
                  </button>
                </td>
                <td data-label="Fit">
                  <FitMeter rating={scan.fit.rating} label={scan.fit.label} />
                </td>
                <td data-label="Email">
                  <Chips tools={scan.tools.filter((t) => t.category === "email")} />
                </td>
                <td data-label="SMS">
                  <Chips tools={scan.tools.filter((t) => t.category === "sms")} />
                </td>
                <td data-label="Other tools">
                  <Chips tools={scan.tools.filter((t) => OTHER.includes(t.category))} />
                </td>
                <td data-label="Catalog" className="host">
                  {catalogSummary(scan)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
