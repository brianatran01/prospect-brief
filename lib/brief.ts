import type { Brief, PersonaGuess } from "./types";
import { HttpError } from "./http";

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const strings = (v: unknown, max: number): string[] =>
  (Array.isArray(v) ? v : []).map(str).filter(Boolean).slice(0, max);

/** Copy the model's reply into the Brief shape, defensively, even though the schema already constrains it. */
export function toBrief(raw: unknown): Brief {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const guesses: PersonaGuess[] = (Array.isArray(r.persona_guesses) ? r.persona_guesses : [])
    .map((g) => {
      const o = (g && typeof g === "object" ? g : {}) as Record<string, unknown>;
      return { name: str(o.name), why: str(o.why) };
    })
    .filter((g) => g.name)
    .slice(0, 3);

  const brief: Brief = {
    snapshot: str(r.snapshot),
    angle: str(r.angle),
    talking_points: strings(r.talking_points, 3),
    persona_guesses: guesses,
    questions: strings(r.questions, 3),
    opener: str(r.opener),
  };
  if (!brief.snapshot || !brief.angle) {
    throw new HttpError(502, "Claude's brief came back incomplete. Try again.");
  }
  return brief;
}
