"use server";

import { and, asc, count, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db, schema } from "@/db";
import { getSession } from "@/lib/session";
import {
  buildFixtures, CATEGORIES, cleanCode, isMatchType, isTournamentType, localDate, makeCode, MATCH_TYPES,
  type MatchType, type TournamentType,
} from "@/lib/tournament";

type Result = { error?: string };
const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

async function sessionUser(role: "Organizer" | "Player") {
  const s = await getSession();
  return s?.kind === "user" && s.role === role ? s : null;
}

async function ownedTournament(id: string) {
  const s = await sessionUser("Organizer");
  if (!s) return null;
  const [t] = await db.select().from(schema.tournaments).where(and(eq(schema.tournaments.id, id), eq(schema.tournaments.ownerId, s.userId)));
  return t ?? null;
}

// ---------- organizer: create ----------
export type CreateState = { error?: string; code?: string; type?: TournamentType; values?: Record<string, string> } | undefined;

export async function createTournament(_: CreateState, fd: FormData): Promise<CreateState> {
  const s = await sessionUser("Organizer");
  if (!s) return { error: "Please log in as an organizer." };
  const keys = ["name", "location", "organizer", "orgPhone", "type", "matchType", "category", "maxTeams", "gameTo", "bestOf", "startDate", "endDate", "startTime", "endTime"];
  const values = Object.fromEntries(keys.map((k) => [k, text(fd, k)]));
  const fail = (error: string): CreateState => ({ error, values });

  if (!values.name || values.name.length > 80) return fail("Please enter a tournament name (up to 80 characters).");
  if (!values.location || !values.organizer || !values.orgPhone) return fail("Please fill in the location and organizer details.");
  if (!isTournamentType(values.type)) return fail("Unknown tournament type.");
  if (!isMatchType(values.matchType)) return fail("Please choose a match type.");
  if (!CATEGORIES.includes(values.category)) return fail("Please choose a category.");
  const maxTeams = Number(values.maxTeams);
  const min = MATCH_TYPES[values.matchType as MatchType].min;
  if (!Number.isInteger(maxTeams) || maxTeams < min || maxTeams > 64) return fail(`Total team must be between ${min} and 64 for ${MATCH_TYPES[values.matchType as MatchType].name}.`);
  const gameTo = Number(values.gameTo);
  const bestOf = Number(values.bestOf);
  if (![11, 15, 21].includes(gameTo) || ![1, 3, 5].includes(bestOf)) return fail("Please choose the game format.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(values.endDate)) return fail("Please choose the start and end dates.");
  if (values.endDate < values.startDate) return fail("End date must be on or after the start date.");
  if (!/^\d{2}:\d{2}$/.test(values.startTime) || !/^\d{2}:\d{2}$/.test(values.endTime)) return fail("Please choose the start and end times.");

  // Join code, retried in the very unlikely case it already exists
  let code = makeCode();
  for (let i = 0; i < 5; i++) {
    const [hit] = await db.select({ id: schema.tournaments.id }).from(schema.tournaments).where(eq(schema.tournaments.code, code));
    if (!hit) break;
    code = makeCode();
  }

  await db.insert(schema.tournaments).values({
    id: crypto.randomUUID(), code, ownerId: s.userId,
    name: values.name, location: values.location, organizer: values.organizer, orgPhone: values.orgPhone,
    type: values.type as TournamentType, matchType: values.matchType as MatchType, category: values.category,
    maxTeams, gameTo, bestOf,
    startDate: values.startDate, endDate: values.endDate, startTime: values.startTime, endTime: values.endTime,
  });
  return { code, type: values.type as TournamentType };
}

export async function deleteTournament(id: string): Promise<Result> {
  const t = await ownedTournament(id);
  if (!t) return { error: "Tournament not found." };
  await db.delete(schema.tournaments).where(eq(schema.tournaments.id, t.id));
  refresh();
  return {};
}

// ---------- player: join / leave ----------
export type JoinPreview = {
  error?: string;
  tournament?: { name: string; location: string; startDate: string; matchType: MatchType; category: string; organizer: string; teams: number; maxTeams: number };
};

async function findJoinable(rawCode: string, userId: string) {
  const code = cleanCode(rawCode);
  if (code.length !== 6) return { error: "A tournament code has 6 letters or numbers." };
  const [t] = await db.select().from(schema.tournaments).where(eq(schema.tournaments.code, code));
  if (!t) return { error: `No tournament found with code ${code}.` };
  const [mine] = await db.select({ id: schema.teams.id }).from(schema.teams).where(and(eq(schema.teams.tournamentId, t.id), eq(schema.teams.ownerId, userId)));
  if (mine) return { error: `You already joined ${t.name}.` };
  if (t.generated) return { error: "Registration is closed. The matches are already generated." };
  const [{ n }] = await db.select({ n: count() }).from(schema.teams).where(eq(schema.teams.tournamentId, t.id));
  if (n >= t.maxTeams) return { error: "This tournament is full." };
  return { t, teams: n };
}

export async function previewJoin(code: string): Promise<JoinPreview> {
  const s = await sessionUser("Player");
  if (!s) return { error: "Please log in as a player." };
  const r = await findJoinable(code, s.userId);
  if (!r.t) return { error: r.error };
  const { t } = r;
  return { tournament: { name: t.name, location: t.location, startDate: t.startDate, matchType: t.matchType, category: t.category, organizer: t.organizer, teams: r.teams, maxTeams: t.maxTeams } };
}

export async function joinTournament(code: string, partner: string): Promise<{ error?: string; type?: TournamentType; name?: string }> {
  const s = await sessionUser("Player");
  if (!s) return { error: "Please log in as a player." };
  const r = await findJoinable(code, s.userId);
  if (!r.t) return { error: r.error };
  const mate = String(partner ?? "").trim().slice(0, 60);
  const singles = /singles/i.test(r.t.category);
  try {
    await db.insert(schema.teams).values({
      id: crypto.randomUUID(), tournamentId: r.t.id, ownerId: s.userId,
      players: mate && !singles ? [s.name, mate] : [s.name],
    });
  } catch {
    return { error: `You already joined ${r.t.name}.` }; // unique index: one team per player
  }
  refresh();
  return { type: r.t.type, name: r.t.name };
}

export async function leaveTournament(id: string): Promise<Result> {
  const s = await sessionUser("Player");
  if (!s) return { error: "Please log in as a player." };
  const [t] = await db.select().from(schema.tournaments).where(eq(schema.tournaments.id, id));
  if (!t) return { error: "Tournament not found." };
  if (t.generated) return { error: "The matches are already generated, so you can't leave now. Ask the organizer." };
  await db.delete(schema.teams).where(and(eq(schema.teams.tournamentId, id), eq(schema.teams.ownerId, s.userId)));
  refresh();
  return {};
}

// ---------- organizer: manage teams ----------
async function ownedTeam(teamId: string) {
  const [team] = await db.select().from(schema.teams).where(eq(schema.teams.id, teamId));
  if (!team) return null;
  const t = await ownedTournament(team.tournamentId);
  return t ? { team, t } : null;
}

export async function removeTeam(teamId: string): Promise<Result> {
  const found = await ownedTeam(teamId);
  if (!found) return { error: "Team not found." };
  if (found.t.generated) return { error: "Matches are already generated. Reset the fixtures on the Match page first." };
  await db.delete(schema.teams).where(eq(schema.teams.id, teamId));
  refresh();
  return {};
}

export async function removeMember(teamId: string, index: number): Promise<Result> {
  const found = await ownedTeam(teamId);
  if (!found) return { error: "Team not found." };
  const { team } = found;
  if (team.players.length < 2) return removeTeam(teamId); // removing the only player removes the team
  if (index !== 0 && index !== 1) return { error: "Player not found." };
  await db.update(schema.teams).set({ players: team.players.filter((_, i) => i !== index) }).where(eq(schema.teams.id, teamId));
  refresh();
  return {};
}

// ---------- organizer: fixtures ----------
export async function generateFixtures(id: string): Promise<Result> {
  const t = await ownedTournament(id);
  if (!t) return { error: "Tournament not found." };
  const teams = await db.select({ id: schema.teams.id }).from(schema.teams).where(eq(schema.teams.tournamentId, id)).orderBy(asc(schema.teams.createdAt));
  const min = MATCH_TYPES[t.matchType].min;
  if (teams.length < min) return { error: `${MATCH_TYPES[t.matchType].name} needs at least ${min} teams.` };

  // Claim the tournament first so two clicks can't generate twice
  const claimed = await db
    .update(schema.tournaments)
    .set({ generated: true })
    .where(and(eq(schema.tournaments.id, id), eq(schema.tournaments.generated, false)))
    .returning({ id: schema.tournaments.id });
  if (!claimed.length) return { error: "The fixtures are already generated." };

  const built = buildFixtures({ matchType: t.matchType, teamIds: teams.map((x) => x.id), startDate: t.startDate, startTime: t.startTime });
  try {
    await db.insert(schema.matches).values(built.matches.map((m) => ({ ...m, tournamentId: id })));
    await db.update(schema.tournaments).set({ groups: built.groups, draw: built.draw, drawnAt: localDate() }).where(eq(schema.tournaments.id, id));
  } catch {
    await db.delete(schema.matches).where(eq(schema.matches.tournamentId, id));
    await db.update(schema.tournaments).set({ generated: false }).where(eq(schema.tournaments.id, id));
    return { error: "Something went wrong while generating. Please try again." };
  }
  refresh();
  return {};
}

export async function resetFixtures(id: string): Promise<Result> {
  const t = await ownedTournament(id);
  if (!t) return { error: "Tournament not found." };
  await db.delete(schema.matches).where(eq(schema.matches.tournamentId, id));
  await db.update(schema.tournaments).set({ generated: false, groups: null, draw: null, drawnAt: null }).where(eq(schema.tournaments.id, id));
  refresh();
  return {};
}
