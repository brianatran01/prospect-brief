"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { BriefResult, ScanResult } from "@/lib/types";
import { RATING_ORDER } from "@/lib/fit";
import { MAX_STORES, parseStoreList } from "@/lib/urls";
import { scansToCsv } from "@/lib/csv";
import { briefMarkdown } from "@/lib/markdown";
import { ProspectTable, type Row } from "./components/ProspectTable";
import { StoreDetail, type BriefState } from "./components/StoreDetail";

type Config = { model: string; effort: string; requiresAccessCode: boolean; hasApiKey: boolean };

/** How many stores to scan at once. Polite to the sites, and fast enough for 25. */
const CONCURRENCY = 4;
const CASE_STUDY_STORES = "gratsi.com";

async function postJson<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Couldn't reach the server. Check that it's running.");
  }
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) {
    if (data?.error) throw new Error(data.error);
    if (res.status === 504) throw new Error("The request timed out. Try again.");
    throw new Error(`The request failed with status ${res.status}.`);
  }
  return data as T;
}

const messageOf = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong.");

/** Run tasks with at most `limit` in flight. */
async function runPool<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await task(item);
    }
  });
  await Promise.all(workers);
}

function download(filename: string, type: string, content: string) {
  const href = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

/** Done rows by fit, then score, then name; rows still scanning next; errors last. */
function rankRows(rows: Row[]): Row[] {
  const done = rows.filter((r): r is Extract<Row, { state: "done" }> => r.state === "done");
  done.sort(
    (a, b) =>
      RATING_ORDER[a.scan.fit.rating] - RATING_ORDER[b.scan.fit.rating] ||
      b.scan.fit.score - a.scan.fit.score ||
      a.scan.name.localeCompare(b.scan.name),
  );
  return [
    ...done,
    ...rows.filter((r) => r.state === "queued" || r.state === "scanning"),
    ...rows.filter((r) => r.state === "error"),
  ];
}

export default function Home() {
  const [config, setConfig] = useState<Config | null>(null);
  const [text, setText] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [listNote, setListNote] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [briefs, setBriefs] = useState<Record<string, BriefState>>({});
  const [copyMessage, setCopyMessage] = useState("");
  const [now, setNow] = useState(0);
  const [scrollRequest, setScrollRequest] = useState(0);

  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((data: Config) => setConfig(data))
      .catch(() => setConfig(null));
  }, []);

  const writing = Object.values(briefs).some((b) => b.state === "running");
  useEffect(() => {
    if (!writing) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [writing]);

  // Scroll after React has rendered the brief section, not before.
  useEffect(() => {
    if (!scrollRequest) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("brief-step")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [scrollRequest]);

  useEffect(() => {
    if (!copyMessage) return;
    const timer = setTimeout(() => setCopyMessage(""), 2500);
    return () => clearTimeout(timer);
  }, [copyMessage]);

  const updateRow = (key: string, row: Row) => setRows((list) => list.map((r) => (r.key === key ? row : r)));

  async function scanOne(key: string) {
    updateRow(key, { key, state: "scanning" });
    try {
      const scan = await postJson<ScanResult>("/api/scan", { url: key, accessCode });
      updateRow(key, { key, state: "done", scan });
    } catch (err) {
      updateRow(key, { key, state: "error", message: messageOf(err) });
    }
  }

  async function handleScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { stores, skipped, truncated } = parseStoreList(text);
    const notes: string[] = [];
    if (skipped.length) notes.push(`Skipped ${skipped.slice(0, 3).join(", ")}${skipped.length > 3 ? "…" : ""}: not web addresses.`);
    if (truncated) notes.push(`Only the first ${MAX_STORES} stores are scanned at a time.`);
    setListNote(notes.join(" "));
    if (!stores.length) return;

    setRows(stores.map((key) => ({ key, state: "queued" })));
    setBriefs({});
    setSelectedKey(stores.length === 1 ? stores[0] : null);
    await runPool(stores, CONCURRENCY, scanOne);
  }

  async function writeBrief(key: string) {
    setBriefs((b) => ({ ...b, [key]: { state: "running", startedAt: Date.now() } }));
    try {
      const result = await postJson<BriefResult>("/api/brief", { url: key, accessCode });
      setBriefs((b) => ({ ...b, [key]: { state: "done", result } }));
      // The brief route re-scans the store, so keep the row in step with what it saw.
      updateRow(key, { key, state: "done", scan: result.scan });
    } catch (err) {
      setBriefs((b) => ({ ...b, [key]: { state: "error", message: messageOf(err) } }));
    }
  }

  const ranked = useMemo(() => rankRows(rows), [rows]);
  const doneScans = ranked.flatMap((r) => (r.state === "done" ? [r.scan] : []));
  const scanning = rows.some((r) => r.state === "queued" || r.state === "scanning");
  const selectedRow = rows.find((r) => r.key === selectedKey);
  const selectedScan = selectedRow?.state === "done" ? selectedRow.scan : null;
  const selectedBrief = selectedKey ? briefs[selectedKey] : undefined;
  const doneBrief = selectedBrief?.state === "done" ? selectedBrief.result.brief : null;

  const needsCode = Boolean(config?.requiresAccessCode) && !accessCode.trim();
  const canWrite = Boolean(config?.hasApiKey) && !needsCode;
  const writeHint = !config?.hasApiKey
    ? "Writing a brief needs ANTHROPIC_API_KEY. The scan works without it."
    : needsCode
      ? "Enter the access code above to write a brief."
      : "";

  const failed = rows.filter((r) => r.state === "error").length;
  const counts = {
    strong: doneScans.filter((s) => s.fit.rating === "strong").length,
    good: doneScans.filter((s) => s.fit.rating === "good").length,
  };

  async function handleCopy() {
    if (!selectedScan) return;
    try {
      await navigator.clipboard.writeText(briefMarkdown(selectedScan, doneBrief));
      setCopyMessage("Copied the brief as Markdown.");
    } catch {
      setCopyMessage("Your browser blocked copying. Use Download .md instead.");
    }
  }

  function handleDownloadMd() {
    if (!selectedScan) return;
    download(`${selectedScan.host}-brief.md`, "text/markdown", briefMarkdown(selectedScan, doneBrief));
  }

  function handleDownloadCsv() {
    const day = new Date().toISOString().slice(0, 10);
    download(`prospects-${day}.csv`, "text/csv", scansToCsv(doneScans));
  }

  function select(key: string) {
    setSelectedKey(key);
    setScrollRequest((n) => n + 1);
  }

  return (
    <>
      <p className="topbar">
        Unofficial concept by Bri Tran, built for OuterSignal&rsquo;s sales team. Not affiliated with OuterSignal.
        <a href="https://persona-playbook.vercel.app" target="_blank" rel="noopener noreferrer">
          See Persona Playbook
        </a>
      </p>
      <div className="page">
        <header className="masthead">
          <span className="wordmark">
            Prospect Brief
            <span className="pink-dot" aria-hidden="true" />
          </span>
          {config && (
            <span className="model">
              {config.model}, {config.effort} effort
            </span>
          )}
        </header>

        <section className="hero" aria-labelledby="hero-heading">
          <h1 id="hero-heading">
            Know a store&rsquo;s stack before the first call<span className="period">.</span>
          </h1>
          <p className="lede">
            Paste the Shopify stores you&rsquo;re prospecting. It finds the marketing tools in each site&rsquo;s code,
            rates the fit for OuterSignal, plans the pilot in OuterSignal&rsquo;s own setup steps, and fact-checks the
            call-prep brief Claude writes.
          </p>
          <ul className="features" aria-label="What it does">
            <li>Stack detection</li>
            <li>Fit rating</li>
            <li>Pilot plan</li>
            <li>Fact-checked brief</li>
          </ul>

          <form className="search" onSubmit={handleScan}>
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2" />
              <path d="m15.5 15.5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <label htmlFor="stores" className="sr-only">
              Store addresses
            </label>
            <textarea
              id="stores"
              // Grow with the list (3 to 8 lines) instead of scrolling inside a short box.
              rows={Math.min(8, Math.max(3, text.split("\n").length))}
              placeholder={"Which stores are you calling this week?\nbrand.com, anotherbrand.com"}
              autoComplete="off"
              spellCheck={false}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="search-actions">
              {config?.requiresAccessCode && (
                <label className="access">
                  <span>Access code</span>
                  <input type="password" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} />
                </label>
              )}
              <button type="button" className="link-btn" onClick={() => setText(CASE_STUDY_STORES)} disabled={scanning}>
                Try an OuterSignal case-study brand
              </button>
              <button className="btn btn-green" type="submit" disabled={scanning || !text.trim() || needsCode}>
                {scanning ? "Scanning…" : "Scan stores"}
              </button>
            </div>
          </form>
          <p className="search-hint">
            One per line, or separated by commas. Up to {MAX_STORES} at a time. Scanning is free; only briefs use
            Claude.
          </p>
          {listNote && <p className="note">{listNote}</p>}
          {config && !config.hasApiKey && (
            <p className="note" role="status">
              Scanning works now. To write briefs, add <code>ANTHROPIC_API_KEY</code> to <code>.env.local</code> and
              restart the server.
            </p>
          )}
        </section>

        {rows.length > 0 && (
          <section className="section" aria-labelledby="ranked-heading">
            <div className="section-head">
              <h2 id="ranked-heading">Ranked list</h2>
              <p className="summary-line">
                <strong>
                  {doneScans.length} of {rows.length}
                </strong>{" "}
                scanned
                {doneScans.length > 0 && (
                  <>
                    , <strong>{counts.strong}</strong> strong {counts.strong === 1 ? "fit" : "fits"} and{" "}
                    <strong>{counts.good}</strong> good {counts.good === 1 ? "fit" : "fits"}
                  </>
                )}
                {failed > 0 && (
                  <>
                    , <strong>{failed}</strong> couldn&rsquo;t be read
                  </>
                )}
                {scanning ? ", still scanning" : ""}.
              </p>
              <button type="button" className="btn-quiet" onClick={handleDownloadCsv} disabled={!doneScans.length}>
                Download CSV
              </button>
            </div>
            <ProspectTable rows={ranked} selectedKey={selectedKey} onSelect={select} onRetry={scanOne} />
            <p className="legend">
              <span>
                <span className="chip chip-listed">Klaviyo</span> green dot: an OuterSignal integration
              </span>
              <span>
                <span className="chip">Omnisend</span> no dot: found, but not on OuterSignal&rsquo;s list
              </span>
              <span>Select a store for its evidence, pilot plan and brief.</span>
            </p>
          </section>
        )}

        {selectedScan && (
          <section className="section" id="brief-step" aria-labelledby="brief-heading">
            <h2 id="brief-heading" className="sr-only">
              Store details and brief
            </h2>
            <StoreDetail
              scan={selectedScan}
              brief={selectedBrief}
              now={now}
              canWrite={canWrite}
              writeHint={writeHint}
              copyMessage={copyMessage}
              onWrite={() => selectedKey && writeBrief(selectedKey)}
              onCopy={handleCopy}
              onDownload={handleDownloadMd}
            />
          </section>
        )}

        <footer className="foot">
          <p>
            Prospect Brief is an unofficial concept by Bri Tran. It isn&rsquo;t affiliated with OuterSignal or any store
            it&rsquo;s run on, and the OuterSignal facts it uses come from OuterSignal&rsquo;s public pages.
          </p>
          <p>
            It reads each store&rsquo;s public homepage and product list only, the same pages any shopper sees. Tools are
            found in the homepage&rsquo;s code, so &ldquo;not found&rdquo; means not seen there, not &ldquo;not
            used&rdquo;.
          </p>
        </footer>
      </div>
    </>
  );
}
