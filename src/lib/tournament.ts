/**
 * Pure tournament logic shared by the server and the browser:
 * random draw, fixture generation, match resolution and standings.
 * No database or framework code here, so it can run anywhere.
 */

export type Role = "Organizer" | "Player";
export type TournamentType = "external" | "internal-plus" | "internal";
export type MatchType = "rr" | "ko" | "groupko";
export type Stage = "rr" | "group" | "ko";

// A match side: a team, a bye, the winner of another match, or a group place (e.g. 1A)
export type Src =
  | { t: "team"; id: string }
  | { t: "bye" }
  | { t: "win"; m: string }
  | { t: "grp"; g: number; r: number };

export type SetScore = { a: number; b: number; done: boolean };
export type Side = "a" | "b";
export type MatchState = {
  target: number;
  bestOf: number;
  sets: SetScore[];
  server: Side;
  winner: Side | null;
  history: string[];
};

export type TeamLite = { id: string; players: string[] };
export type MatchLite = {
  id: string;
  no: number;
  stage: Stage;
  groupNo: number | null;
  round: number;
  slot: number | null;
  label: string;
  sideA: Src;
  sideB: Src;
  date: string | null;
  time: string | null;
  state: MatchState | null;
  code?: string; // umpire code, only sent to the organizer
};
export type TData = { matchType: MatchType; teams: TeamLite[]; matches: MatchLite[]; groups: string[][] | null };

export const TYPES: Record<TournamentType, string> = {
  external: "External Tournament",
  "internal-plus": "Internal + Tournament",
  internal: "Internal Tournament",
};

export const MATCH_TYPES: Record<MatchType, { name: string; hint: string; min: number }> = {
  rr: { name: "Round Robin", hint: "Every team plays every other team once. The best record wins.", min: 2 },
  ko: { name: "Knockout", hint: "Single elimination: lose once and the team is out. Byes are added when the team count is not 2, 4, 8 or 16.", min: 2 },
  groupko: { name: "Group Stage + Knockout", hint: "Teams play round robin in groups, then the top 2 of each group go to a knockout bracket. Needs at least 4 teams.", min: 4 },
};

export const CATEGORIES = ["Men's Doubles", "Women's Doubles", "Mixed Doubles", "Men's Singles", "Women's Singles", "Open"];
export const LETTERS = "ABCDEFGH";
export const isTournamentType = (v: unknown): v is TournamentType => typeof v === "string" && v in TYPES;
export const isMatchType = (v: unknown): v is MatchType => typeof v === "string" && v in MATCH_TYPES;

// ---------- small helpers ----------
export const pad = (n: number) => String(n).padStart(2, "0");
export const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
};
export const nextPow2 = (n: number) => {
  let p = 1;
  while (p < n) p *= 2;
  return p;
};

// Fisher–Yates shuffle: every order is equally likely
export function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I mix-ups
export function makeCode(taken: Set<string> = new Set()): string {
  let c: string;
  do {
    c = Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
  } while (taken.has(c));
  taken.add(c);
  return c;
}
export const cleanCode = (v: unknown) => String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

// ---------- reading results ----------
export const teamName = (t: TData, id: string) => t.teams.find((x) => x.id === id)?.players.join(" / ") ?? "Removed team";
export const groupMatches = (t: TData, g: number) => t.matches.filter((m) => m.stage === "group" && m.groupNo === g);
export const groupDone = (t: TData, g: number) => groupMatches(t, g).every((m) => m.state?.winner);
export function gamesWon(st: MatchState | null) {
  const g = { a: 0, b: 0 };
  (st?.sets ?? []).forEach((s) => {
    if (!s.done) return;
    if (s.a > s.b) g.a++;
    else g.b++;
  });
  return g;
}

export type Resolved = { id: string | null; bye?: boolean; label: string };
export type MatchStatus = "bye" | "walkover" | "done" | "tbd" | "live" | "ready";
export type MatchInfo = { A: Resolved; B: Resolved; winner: string | null; status: MatchStatus; bye: boolean; games: { a: number; b: number } };

export function resolveSrc(t: TData, src: Src): Resolved {
  if (src.t === "team") return { id: src.id, label: teamName(t, src.id) };
  if (src.t === "bye") return { id: null, bye: true, label: "BYE" };
  if (src.t === "win") {
    const m = t.matches.find((x) => x.id === src.m);
    const r = m ? matchInfo(t, m) : null;
    if (r?.winner) return { id: r.winner, label: teamName(t, r.winner) };
    if (r?.bye) return { id: null, bye: true, label: "BYE" };
    return { id: null, label: `Winner M${m ? m.no : "?"}` };
  }
  const tag = `${src.r}${LETTERS[src.g]}`;
  if (!t.groups || !groupDone(t, src.g)) return { id: null, label: tag };
  const row = standings(t.groups[src.g], groupMatches(t, src.g))[src.r - 1];
  return row ? { id: row.id, label: teamName(t, row.id) } : { id: null, bye: true, label: "BYE" };
}

export function matchInfo(t: TData, m: MatchLite): MatchInfo {
  const A = resolveSrc(t, m.sideA);
  const B = resolveSrc(t, m.sideB);
  const st = m.state;
  let winner: string | null = null;
  let status: MatchStatus;
  if (A.bye && B.bye) status = "bye";
  else if (A.bye && B.id) { winner = B.id; status = "walkover"; }
  else if (B.bye && A.id) { winner = A.id; status = "walkover"; }
  else if (st?.winner && A.id && B.id) { winner = st.winner === "a" ? A.id : B.id; status = "done"; }
  else if (!A.id || !B.id) status = "tbd";
  else if (st && (st.sets.length > 1 || st.sets[0].a || st.sets[0].b)) status = "live";
  else status = "ready";
  return { A, B, winner, status, bye: status === "bye", games: gamesWon(st) };
}

export type StandingRow = { id: string; p: number; w: number; l: number; gw: number; gl: number; pf: number; pa: number };
export function standings(ids: string[], matches: MatchLite[]): StandingRow[] {
  const rows: Record<string, StandingRow> = Object.fromEntries(ids.map((id) => [id, { id, p: 0, w: 0, l: 0, gw: 0, gl: 0, pf: 0, pa: 0 }]));
  matches.forEach((m) => {
    const st = m.state;
    if (!st?.winner || m.sideA.t !== "team" || m.sideB.t !== "team") return;
    const ra = rows[m.sideA.id];
    const rb = rows[m.sideB.id];
    if (!ra || !rb) return;
    const g = gamesWon(st);
    ra.p++; rb.p++;
    if (st.winner === "a") { ra.w++; rb.l++; } else { rb.w++; ra.l++; }
    ra.gw += g.a; ra.gl += g.b; rb.gw += g.b; rb.gl += g.a;
    st.sets.forEach((s) => { ra.pf += s.a; ra.pa += s.b; rb.pf += s.b; rb.pa += s.a; });
  });
  return Object.values(rows).sort((x, y) => y.w - x.w || (y.gw - y.gl) - (x.gw - x.gl) || (y.pf - y.pa) - (x.pf - x.pa));
}

// ---------- fixture generation ----------
const SLOT_MIN = 20; // minutes between scheduled matches (one court)
export const KO_NAMES: Record<number, string> = { 1: "Final", 2: "Semi-final", 4: "Quarter-final", 8: "Round of 16", 16: "Round of 32", 32: "Round of 64" };

function slotter(startDate: string, startTime: string) {
  let k = 0;
  return () => {
    const d = new Date(`${startDate}T${startTime || "08:00"}`);
    if (isNaN(d.getTime())) return { date: startDate, time: startTime };
    d.setMinutes(d.getMinutes() + SLOT_MIN * k++);
    return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
  };
}

// Circle method: returns rounds of [teamA, teamB] pairs
export function roundRobin(ids: string[]): [string, string][][] {
  const list: (string | null)[] = [...ids];
  if (list.length % 2) list.push(null);
  const rounds: [string, string][][] = [];
  for (let r = 0; r < list.length - 1; r++) {
    const games: [string, string][] = [];
    for (let i = 0; i < list.length / 2; i++) {
      const a = list[i];
      const b = list[list.length - 1 - i];
      if (a && b) games.push([a, b]);
    }
    rounds.push(games);
    list.splice(1, 0, list.pop() ?? null);
  }
  return rounds;
}

// Bracket order so top seeds meet late and byes go to top seeds, e.g. 8 -> 1,8,4,5,2,7,3,6
export function seedOrder(size: number): number[] {
  let o = [1];
  while (o.length < size) {
    const n = o.length * 2;
    o = o.flatMap((s) => [s, n + 1 - s]);
  }
  return o;
}

export type NewMatch = Omit<MatchLite, "state" | "code"> & { code: string };

/**
 * Random draw + fixtures. The drawn order is the seeding for knockouts and the
 * dealing order for groups, so joining early gives no advantage.
 */
export function buildFixtures(
  input: { matchType: MatchType; teamIds: string[]; startDate: string; startTime: string },
  taken: Set<string> = new Set(),
): { matches: NewMatch[]; groups: string[][] | null; draw: string[] } {
  const next = slotter(input.startDate, input.startTime);
  const ids = shuffle(input.teamIds);
  const out: NewMatch[] = [];
  let groups: string[][] | null = null;
  const team = (id: string): Src => ({ t: "team", id });
  const add = (m: Omit<NewMatch, "id" | "code" | "no" | "date" | "time">, timed = true) => {
    const match: NewMatch = { id: crypto.randomUUID(), code: makeCode(taken), no: out.length + 1, ...(timed ? next() : { date: null, time: null }), ...m };
    out.push(match);
    return match;
  };
  const buildKO = (slots: Src[]) => {
    let prev: NewMatch[] = [];
    for (let i = 0; i < slots.length; i += 2) {
      const hasBye = slots[i].t === "bye" || slots[i + 1].t === "bye";
      prev.push(add({ stage: "ko", groupNo: null, round: 0, slot: i / 2, label: KO_NAMES[slots.length / 2], sideA: slots[i], sideB: slots[i + 1] }, !hasBye));
    }
    for (let r = 1; prev.length > 1; r++) {
      const cur: NewMatch[] = [];
      for (let i = 0; i < prev.length; i += 2) {
        cur.push(add({ stage: "ko", groupNo: null, round: r, slot: i / 2, label: KO_NAMES[prev.length / 2], sideA: { t: "win", m: prev[i].id }, sideB: { t: "win", m: prev[i + 1].id } }));
      }
      prev = cur;
    }
  };

  if (input.matchType === "rr") {
    roundRobin(ids).forEach((games, r) =>
      games.forEach(([a, b]) => add({ stage: "rr", groupNo: null, round: r + 1, slot: null, label: `Round ${r + 1}`, sideA: team(a), sideB: team(b) })));
  } else if (input.matchType === "ko") {
    const size = nextPow2(Math.max(2, ids.length));
    buildKO(seedOrder(size).map((s): Src => (s <= ids.length ? team(ids[s - 1]) : { t: "bye" })));
  } else {
    let g = 1;
    while (g * 2 * 3 <= ids.length && g * 2 <= 8) g *= 2; // at least 3 teams per group
    const gs: string[][] = Array.from({ length: g }, () => []);
    ids.forEach((id, i) => gs[i % g].push(id));
    groups = gs;
    const rounds = gs.map(roundRobin);
    const maxR = Math.max(...rounds.map((r) => r.length));
    for (let r = 0; r < maxR; r++) {
      rounds.forEach((gr, gi) => (gr[r] ?? []).forEach(([a, b]) =>
        add({ stage: "group", groupNo: gi, round: r + 1, slot: null, label: `Group ${LETTERS[gi]}`, sideA: team(a), sideB: team(b) })));
    }
    // 1A v 2B on the left half, 1B v 2A on the right half, so group winners meet late
    const slots: Src[] = [];
    if (g === 1) slots.push({ t: "grp", g: 0, r: 1 }, { t: "grp", g: 0, r: 2 });
    else {
      const left: Src[] = [];
      const right: Src[] = [];
      for (let k = 0; k < g; k += 2) {
        left.push({ t: "grp", g: k, r: 1 }, { t: "grp", g: k + 1, r: 2 });
        right.push({ t: "grp", g: k + 1, r: 1 }, { t: "grp", g: k, r: 2 });
      }
      slots.push(...left, ...right);
    }
    buildKO(slots);
  }
  return { matches: out, groups, draw: ids };
}

export const tabOf = (m: MatchLite) => (m.stage === "group" ? `g${m.groupNo}` : m.stage);
export const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
