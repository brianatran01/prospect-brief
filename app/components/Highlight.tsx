import { Fragment } from "react";
import type { Mark } from "@/lib/types";

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Renders copy with proof marks: terms the fact check verified get a green
 * highlight, terms it couldn't verify get a red one. Hover shows why.
 */
export function Highlight({ text, marks }: { text: string; marks: Mark[] }) {
  const terms = marks.filter((m) => m.term.trim()).sort((a, b) => b.term.length - a.term.length);
  if (!text || !terms.length) return <>{text}</>;

  const pattern = new RegExp(`(${terms.map((m) => escapeRegExp(m.term)).join("|")})`, "gi");
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, i) => {
        const mark = i % 2 === 1 ? terms.find((m) => m.term.toLowerCase() === part.toLowerCase()) : undefined;
        if (!mark) return <Fragment key={i}>{part}</Fragment>;
        return (
          <mark key={i} className={mark.ok ? "proof proof-ok" : "proof proof-flag"} title={mark.note}>
            {part}
          </mark>
        );
      })}
    </>
  );
}
