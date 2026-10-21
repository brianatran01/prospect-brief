"use client";

import type { ReactNode } from "react";
import type { BriefResult, Flag, Mark, ScanResult, SourceKey } from "@/lib/types";
import { BRIEF_LABELS, CATEGORIES, CATEGORY_LABELS } from "@/lib/types";
import { formatPrice } from "@/lib/products";
import { SOURCES, VENDOR } from "@/lib/vendor";
import { TOOL_BY_ID } from "@/lib/signatures";
import { FitMeter } from "./FitMeter";
import { Highlight } from "./Highlight";

export type BriefState =
  | { state: "running"; startedAt: number }
  | { state: "done"; result: BriefResult }
  | { state: "error"; message: string };

const PLATFORM_LABELS: Record<ScanResult["platform"]["kind"], string> = {
  shopify: "Shopify",
  shopify_likely: "Probably Shopify, possibly custom-built",
  other: "Not Shopify",
  unknown: "Platform unknown",
};

const SOURCE_SHORT: Record<SourceKey, string> = {
  app: "App Store listing",
  klaviyo: "Klaviyo guide",
  firstDay: "Setup guide",
};

type DetailProps = {
  scan: ScanResult;
  brief: BriefState | undefined;
  now: number;
  canWrite: boolean;
  writeHint: string;
  copyMessage: string;
  onWrite: () => void;
  onCopy: () => void;
  onDownload: () => void;
};

export function StoreDetail({ scan, brief, now, canWrite, writeHint, copyMessage, onWrite, onCopy, onDownload }: DetailProps) {
  const notFound = VENDOR.integrations
    .filter((id) => !scan.tools.some((t) => t.id === id))
    .map((id) => TOOL_BY_ID[id].name);
  const c = scan.catalog;

  return (
    <article className="detail" aria-label={`${scan.name} details`}>
      <header className="detail-head">
        <div>
          <h3>{scan.name}</h3>
          <p>
            <a href={scan.url} target="_blank" rel="noopener noreferrer">
              {scan.host}
            </a>{" "}
            · {PLATFORM_LABELS[scan.platform.kind]}
          </p>
        </div>
        <FitMeter rating={scan.fit.rating} label={scan.fit.label} big />
      </header>

      {scan.notes.map((note) => (
        <p className="note" key={note}>
          {note}
        </p>
      ))}

      <div className="cards">
        <section className="card" aria-label="Fit">
          <h4>Why it got this rating</h4>
          <ul className="reasons">
            {scan.fit.reasons.map((r) => (
              <li key={r.text} className={r.effect}>
                <span>{r.text}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card" aria-label="Stack">
          <h4>Stack on the homepage</h4>
          {scan.tools.length === 0 && <p className="muted">None of the tracked tools were found in the page code.</p>}
          {CATEGORIES.map((category) => {
            const tools = scan.tools.filter((t) => t.category === category);
            if (!tools.length) return null;
            return (
              <div className="stack-group" key={category}>
                <h5>{CATEGORY_LABELS[category]}</h5>
                {tools.map((t) => (
                  <div className="tool" key={t.id}>
                    <span className="tool-name">
                      {t.name}
                      {t.listed && <span className="tag">OuterSignal integration</span>}
                    </span>
                    <details className="evidence">
                      <summary>Show the evidence</summary>
                      <code>
                        <Evidence text={t.evidence} match={t.match} />
                      </code>
                    </details>
                  </div>
                ))}
              </div>
            );
          })}
          {notFound.length > 0 && scan.homepageRead && (
            <p className="small">
              Not found on the homepage: {notFound.join(", ")}. Not found doesn&rsquo;t mean not used.
            </p>
          )}
          {scan.platform.evidence.length > 0 && (
            <details className="evidence">
              <summary>How we know it&rsquo;s {scan.platform.kind === "shopify" ? "Shopify" : "probably Shopify"}</summary>
              <code>{scan.platform.evidence.join(" · ")}</code>
            </details>
          )}
        </section>

        <section className="card" aria-label="Catalog">
          <h4>Catalog</h4>
          {c ? (
            <>
              <p className="stat">
                <strong>
                  {c.count}
                  {c.capped ? "+" : ""}
                </strong>
                <span>{c.count === 1 && !c.capped ? "product" : "products"} in the public catalog</span>
              </p>
              <dl className="facts">
                {c.minPrice !== null && c.maxPrice !== null && (
                  <>
                    <dt>Price range</dt>
                    <dd>
                      {formatPrice(c.minPrice)} to {formatPrice(c.maxPrice)}
                    </dd>
                  </>
                )}
                {c.medianPrice !== null && (
                  <>
                    <dt>Typical product</dt>
                    <dd>from {formatPrice(c.medianPrice)}</dd>
                  </>
                )}
                {c.topTypes.length > 0 && (
                  <>
                    <dt>Top types</dt>
                    <dd>{c.topTypes.map((t) => `${t.type} (${t.count})`).join(", ")}</dd>
                  </>
                )}
              </dl>
            </>
          ) : (
            <p className="muted">No public product list at /products.json.</p>
          )}
        </section>
      </div>

      <div className="cards">
        <section className="card" aria-label="Pilot plan">
          <h4>Pilot plan</h4>
          <ol className="plan">
            {scan.plan.steps.map((step) => (
              <li key={step.text}>
                <span>
                  {step.text}
                  <a className="cite" href={SOURCES[step.source].url} target="_blank" rel="noopener noreferrer">
                    {SOURCE_SHORT[step.source]}
                  </a>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <div className="cards-col">
          {scan.plan.watchOuts.length > 0 && (
            <section className="card watch" aria-label="Watch-outs">
              <h4>Watch-outs</h4>
              <ul>
                {scan.plan.watchOuts.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </section>
          )}
          <section className="card" aria-label="Questions to ask">
            <h4>Questions to ask</h4>
            <ul>
              {scan.plan.questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <section className="brief" aria-label="Call-prep brief">
        <div className="brief-head">
          <h4>Call-prep brief</h4>
          <div className="row">
            <button type="button" className="btn btn-pink" onClick={onWrite} disabled={!canWrite || brief?.state === "running"}>
              {brief?.state === "running" ? "Writing…" : brief?.state === "done" ? "Rewrite the brief" : "Write the brief"}
            </button>
            <button type="button" className="btn-quiet" onClick={onCopy}>
              Copy as Markdown
            </button>
            <button type="button" className="btn-quiet" onClick={onDownload}>
              Download .md
            </button>
          </div>
        </div>
        {copyMessage && (
          <p className="small" role="status">
            {copyMessage}
          </p>
        )}
        {!canWrite && writeHint && <p className="hint-inline">{writeHint}</p>}
        <BriefBody brief={brief} now={now} onRetry={onWrite} />
      </section>

      <section aria-label="Sources">
        <p className="small">Sources for the OuterSignal facts above:</p>
        <ul className="sources">
          {Object.values(SOURCES).map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}

/** The page-code excerpt with the matching part in bold. */
function Evidence({ text, match }: { text: string; match: string }) {
  const at = match ? text.indexOf(match) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <b>{match}</b>
      {text.slice(at + match.length)}
    </>
  );
}

function BriefBody({ brief, now, onRetry }: { brief: BriefState | undefined; now: number; onRetry: () => void }) {
  if (!brief) {
    return (
      <p className="muted">
        The scan above is free and instant. The brief adds a snapshot, talking points, persona guesses and tailored
        questions, written by Claude and fact-checked by code against the scan, the catalog and OuterSignal&rsquo;s case
        studies.
      </p>
    );
  }
  if (brief.state === "running") {
    return (
      <div className="writing">
        <div className="writing-bar" aria-hidden="true" />
        <p role="status">
          Re-scanning the store and writing the brief
          <span aria-hidden="true">, {Math.max(0, Math.floor((now - brief.startedAt) / 1000))} s</span>
        </p>
      </div>
    );
  }
  if (brief.state === "error") {
    return (
      <div className="brief-error" role="alert">
        <p>{brief.message}</p>
        <button type="button" className="btn-quiet" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }

  const { brief: b, check, stats } = brief.result;
  const m = check.marks;
  return (
    <>
      <CheckSummary flags={check.flags} />
      <p className="legend">
        <span>
          <mark className="proof proof-ok">Green</mark> matches the scan, the catalog or a case study.
        </span>
        <span>
          <mark className="proof proof-flag">Red</mark> couldn&rsquo;t be verified. Hover a mark to see why.
        </span>
      </p>
      <div className="brief-columns">
        <div className="detail">
          <Section title={BRIEF_LABELS.snapshot}>
            <p>
              <Highlight text={b.snapshot} marks={m.snapshot} />
            </p>
          </Section>
          <Section title={BRIEF_LABELS.angle}>
            <p>
              <Highlight text={b.angle} marks={m.angle} />
            </p>
          </Section>
          <Section title={BRIEF_LABELS.talking_points}>
            <List items={b.talking_points} marks={m.talking_points} />
          </Section>
        </div>
        <div className="detail">
          <Section title={BRIEF_LABELS.persona_guesses}>
            <ul>
              {b.persona_guesses.map((g) => (
                <li key={g.name}>
                  <strong>{g.name}.</strong> <Highlight text={g.why} marks={m.persona_guesses} />
                </li>
              ))}
            </ul>
          </Section>
          <Section title={BRIEF_LABELS.questions}>
            <List items={b.questions} marks={m.questions} />
          </Section>
          <Section title={BRIEF_LABELS.opener}>
            <blockquote className="opener">
              <Highlight text={b.opener} marks={m.opener} />
            </blockquote>
          </Section>
        </div>
      </div>
      <p className="stats">
        <span>{stats.model}</span>
        <span>{stats.effort} effort</span>
        <span>
          {stats.inputTokens.toLocaleString("en-US")} in / {stats.outputTokens.toLocaleString("en-US")} out tokens
        </span>
        {stats.costUsd !== null && <span>${stats.costUsd.toFixed(3)}</span>}
        <span>{(stats.latencyMs / 1000).toFixed(1)} s</span>
      </p>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="brief-section">
      <h5>{title}</h5>
      {children}
    </div>
  );
}

function List({ items, marks }: { items: string[]; marks: Mark[] }) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item}>
          <Highlight text={item} marks={marks} />
        </li>
      ))}
    </ul>
  );
}

function CheckSummary({ flags }: { flags: Flag[] }) {
  const errors = flags.filter((f) => f.severity === "error");
  if (!flags.length) {
    return (
      <div className="check check-ok" role="status">
        <p>Every tool, price and stat in this brief checks out against the scan, the catalog and OuterSignal&rsquo;s case studies.</p>
      </div>
    );
  }
  return (
    <div className={errors.length ? "check check-bad" : "check check-warn"} role="status">
      <p>
        {errors.length
          ? `${errors.length} ${errors.length === 1 ? "thing" : "things"} couldn't be verified. Fix or cut ${errors.length === 1 ? "it" : "them"} before the call:`
          : `Nothing wrong, but ${flags.length} ${flags.length === 1 ? "thing" : "things"} to tidy:`}
      </p>
      <ul>
        {[...errors, ...flags.filter((f) => f.severity !== "error")].map((f, i) => (
          <li key={`${f.field}-${i}`}>{f.message}</li>
        ))}
      </ul>
    </div>
  );
}
