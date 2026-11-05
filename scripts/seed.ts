/**
 * Creates the demo accounts and sample tournaments used by "Try demo".
 * Safe to run again: it deletes the previous demo data first.
 *   npm run db:seed
 * Demo logins (for testing only): phone 0100000001 (organizer) / 0100000002 (player), password demo1234
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import bcrypt from "bcryptjs";
import { inArray, like } from "drizzle-orm";
import { db, schema } from "../src/db";
import { DEMO_PHONES } from "../src/lib/demo";
import { buildFixtures, makeCode, type MatchState, type MatchType, type Side, type TournamentType } from "../src/lib/tournament";

const DEMO_PASSWORD = "demo1234";
const FILLER_PREFIX = "01999"; // phones of the extra players who "joined" the sample tournaments

type Match = ReturnType<typeof buildFixtures>["matches"][number] & { state?: MatchState | null };

function finished(side: Side, close: boolean, bestOf: number): MatchState {
  const l: Side = side === "a" ? "b" : "a";
  const set = (w: number, x: number) => ({ [side]: w, [l]: x, done: true }) as { a: number; b: number; done: boolean };
  return { target: 11, bestOf, sets: close ? [set(11, 8), set(9, 11), set(11, 7)] : [set(11, 6), set(11, 9)], server: side, winner: side, history: [] };
}

async function main() {
  console.log(`Seeding ${process.env.DATABASE_URL ? "Neon" : "local PGlite"} database…`);

  // Remove old demo data (tournaments and teams go with their owners)
  await db.delete(schema.users).where(inArray(schema.users.phone, Object.values(DEMO_PHONES)));
  await db.delete(schema.users).where(like(schema.users.phone, `${FILLER_PREFIX}%`));

  const demoHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const fillerHash = await bcrypt.hash(crypto.randomUUID(), 10); // nobody can log in as these
  const org = { id: crypto.randomUUID(), name: "Demo Organizer", email: "organizer@demo.pbplus", phone: DEMO_PHONES.Organizer, passwordHash: demoHash, role: "Organizer" as const };
  const henry = { id: crypto.randomUUID(), name: "Henry", email: "player@demo.pbplus", phone: DEMO_PHONES.Player, passwordHash: demoHash, role: "Player" as const };
  await db.insert(schema.users).values([org, henry]);

  let filler = 0;
  const players: { id: string; name: string; email: string; phone: string; passwordHash: string; role: "Player" }[] = [];
  const team = (tournamentId: string, names: string[], owner?: string) => {
    let ownerId = owner;
    if (!ownerId) {
      filler++;
      ownerId = crypto.randomUUID();
      players.push({ id: ownerId, name: names[0], email: `player${filler}@demo.pbplus`, phone: `${FILLER_PREFIX}${String(filler).padStart(5, "0")}`, passwordHash: fillerHash, role: "Player" });
    }
    return { id: crypto.randomUUID(), tournamentId, ownerId, players: names, createdAt: new Date(Date.now() + filler * 1000) };
  };

  const base = { ownerId: org.id, organizer: "UMS Sports Club", orgPhone: "088-320000", gameTo: 11, bestOf: 3 };
  const mk = (p: { name: string; location: string; type: TournamentType; matchType: MatchType; category: string; maxTeams: number; startDate: string; startTime: string; endTime: string }) =>
    ({ ...base, ...p, id: crypto.randomUUID(), code: makeCode(), endDate: p.startDate });

  const open = mk({ name: "UMS Pickleball Open 2026", location: "Dewan Canselor, Kota Kinabalu, Sabah", type: "external", matchType: "groupko", category: "Mixed Doubles", maxTeams: 8, startDate: "2026-11-14", startTime: "08:00", endTime: "18:00" });
  const league = { ...mk({ name: "Office Friday League", location: "Sports Complex, Penampang, Sabah", type: "internal", matchType: "rr", category: "Men's Doubles", maxTeams: 4, startDate: "2026-11-13", startTime: "17:00", endTime: "20:00" }), organizer: "HR Department", bestOf: 1 };
  const cup = { ...mk({ name: "KK Corporate Cup", location: "Likas Sports Complex, Kota Kinabalu", type: "internal-plus", matchType: "ko", category: "Open", maxTeams: 8, startDate: "2026-11-21", startTime: "09:00", endTime: "17:00" }), organizer: "KK Business Club" };

  const openTeams = [
    team(open.id, ["Ali", "Siti"]), team(open.id, ["Henry", "Mei Ling"], henry.id), team(open.id, ["Raj", "Aina"]), team(open.id, ["Jason", "Farah"]),
    team(open.id, ["Danish", "Shari"]), team(open.id, ["Lezzy", "Nis"]), team(open.id, ["Ais", "As"]), team(open.id, ["Kumar", "Wei Jie"]),
  ];
  const leagueTeams = [team(league.id, ["Amir", "Zul"]), team(league.id, ["Ben", "Chong"]), team(league.id, ["Hafiz"])];
  const cupTeams = [
    team(cup.id, ["Petronas A"]), team(cup.id, ["Sabah Tea", "Lim"]), team(cup.id, ["UMS Staff", "Rosli"]),
    team(cup.id, ["Maybank", "Siew"]), team(cup.id, ["Celcom", "Arif"]), team(cup.id, ["SESB", "Nora"]),
  ];

  // Fixtures (random draw) + some results so the standings and bracket look alive
  const taken = new Set<string>();
  const openFx = buildFixtures({ matchType: "groupko", teamIds: openTeams.map((t) => t.id), startDate: open.startDate, startTime: open.startTime }, taken);
  const strength = (id: string) => openTeams.findIndex((t) => t.id === id); // earlier in the list = stronger
  let doneB = 0;
  const openMatches: Match[] = openFx.matches.map((m, i) => {
    if (m.stage !== "group" || m.sideA.t !== "team" || m.sideB.t !== "team") return m;
    const side: Side = strength(m.sideA.id) < strength(m.sideB.id) ? "a" : "b";
    if (m.groupNo === 0) return { ...m, state: finished(side, i % 2 === 0, 3) };
    if (doneB < 4) { doneB++; return { ...m, state: finished(side, i % 3 === 0, 3) }; }
    if (doneB++ === 4) return { ...m, state: { target: 11, bestOf: 3, sets: [{ a: 7, b: 5, done: false }], server: "a", winner: null, history: [] } };
    return m;
  });
  const cupFx = buildFixtures({ matchType: "ko", teamIds: cupTeams.map((t) => t.id), startDate: cup.startDate, startTime: cup.startTime }, taken);
  let cupDone = false;
  const cupMatches: Match[] = cupFx.matches.map((m) => {
    if (!cupDone && m.sideA.t === "team" && m.sideB.t === "team") { cupDone = true; return { ...m, state: finished("a", true, 3) }; }
    return m;
  });

  await db.insert(schema.users).values(players);
  await db.insert(schema.tournaments).values([
    { ...open, generated: true, groups: openFx.groups, draw: openFx.draw, drawnAt: "2026-11-06" },
    league,
    { ...cup, generated: true, draw: cupFx.draw, drawnAt: "2026-11-06" },
  ]);
  await db.insert(schema.teams).values([...openTeams, ...leagueTeams, ...cupTeams]);
  await db.insert(schema.matches).values([
    ...openMatches.map((m) => ({ ...m, tournamentId: open.id })),
    ...cupMatches.map((m) => ({ ...m, tournamentId: cup.id })),
  ]);

  console.log(`Done. Codes: ${open.name} ${open.code} · ${league.name} ${league.code} · ${cup.name} ${cup.code}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
