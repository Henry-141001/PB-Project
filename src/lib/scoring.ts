/**
 * Pickleball scoring as a pure function, used by the scoreboard (instant feedback)
 * and by the server (the saved, trusted result).
 * Rally scoring: every rally wins a point, game to N (win by 2).
 * Serving team = last rally winner; server side follows score parity.
 */
import type { MatchState, Side } from "./tournament";

export type ScoreAction =
  | { type: "point"; side: Side }
  | { type: "newSet"; force?: boolean }
  | { type: "undo" }
  | { type: "settings"; target?: number; bestOf?: number };

export type ScoreResult = {
  state: MatchState;
  error?: string;
  needsConfirm?: string;
  event?: { kind: "set" | "match"; side: Side; set: number };
};

export const TARGETS = [11, 15, 21];
export const BEST_OF = [1, 3, 5];

export const initialState = (target: number, bestOf: number): MatchState => ({
  target, bestOf, sets: [{ a: 0, b: 0, done: false }], server: "a", winner: null, history: [],
});

export const setsWon = (st: MatchState, side: Side) =>
  st.sets.filter((s) => s.done && s[side] > s[side === "a" ? "b" : "a"]).length;

export const hasStarted = (st: MatchState) => st.sets.length > 1 || st.sets[0].a > 0 || st.sets[0].b > 0;

export function isScoreAction(v: unknown): v is ScoreAction {
  if (!v || typeof v !== "object") return false;
  const a = v as Record<string, unknown>;
  if (a.type === "point") return a.side === "a" || a.side === "b";
  if (a.type === "newSet") return a.force === undefined || typeof a.force === "boolean";
  if (a.type === "undo") return true;
  if (a.type === "settings") {
    return (a.target === undefined || TARGETS.includes(a.target as number))
      && (a.bestOf === undefined || BEST_OF.includes(a.bestOf as number));
  }
  return false;
}

export function applyScore(prev: MatchState, action: ScoreAction): ScoreResult {
  const st: MatchState = structuredClone(prev);
  const cur = () => st.sets[st.sets.length - 1];
  const snapshot = () => {
    const { history, ...rest } = st;
    st.history = [...history, JSON.stringify(rest)].slice(-200);
  };
  const fail = (error: string): ScoreResult => ({ state: prev, error });

  switch (action.type) {
    case "point": {
      const side = action.side;
      if (st.winner) return fail("Match finished. Press Undo to correct it.");
      if (cur().done) return fail("Set finished. Press Add New Set.");
      snapshot();
      const s = cur();
      s[side]++;
      st.server = side;
      const other: Side = side === "a" ? "b" : "a";
      if (s[side] >= st.target && s[side] - s[other] >= 2) {
        s.done = true;
        if (setsWon(st, side) >= Math.ceil(st.bestOf / 2)) {
          st.winner = side;
          return { state: st, event: { kind: "match", side, set: st.sets.length } };
        }
        return { state: st, event: { kind: "set", side, set: st.sets.length } };
      }
      return { state: st };
    }
    case "newSet": {
      if (st.winner) return fail("Match already finished");
      const s = cur();
      if (!s.done && (s.a || s.b)) {
        if (!action.force) return { state: prev, needsConfirm: "Current set is not finished. Close it and start a new set?" };
        snapshot();
        cur().done = true;
        st.sets.push({ a: 0, b: 0, done: false });
        return { state: st };
      }
      if (!s.done) return fail("Current set has not started yet");
      if (st.sets.length >= st.bestOf) return fail(`Best of ${st.bestOf}: no more sets`);
      snapshot();
      st.sets.push({ a: 0, b: 0, done: false });
      return { state: st };
    }
    case "undo": {
      if (!st.history.length) return fail("Nothing to undo");
      const history = st.history.slice(0, -1);
      return { state: { ...(JSON.parse(st.history[st.history.length - 1]) as Omit<MatchState, "history">), history } };
    }
    case "settings": {
      if (hasStarted(st)) return fail("Settings are locked once the match starts");
      if (action.target) st.target = action.target;
      if (action.bestOf) st.bestOf = action.bestOf;
      return { state: st };
    }
  }
}
