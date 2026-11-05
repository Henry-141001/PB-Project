import "server-only";
import { asc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db, schema } from "@/db";
import { getSession } from "./session";
import type { MatchLite, Role, TData } from "./tournament";

/** Data Access Layer: every page and action checks access here, close to the data. */

export type CurrentUser = { id: string; role: Role; name: string };

/** The logged-in organizer or player, checked against the database (null if none). */
export async function currentUser(): Promise<CurrentUser | null> {
  const s = await getSession();
  if (s?.kind !== "user") return null;
  const [u] = await db
    .select({ id: schema.users.id, role: schema.users.role, name: schema.users.name })
    .from(schema.users)
    .where(eq(schema.users.id, s.userId));
  return u ?? null;
}

/** Like currentUser, but sends visitors to the right place when they can't be here. */
export async function requireUser(role?: Role): Promise<CurrentUser> {
  const s = await getSession();
  if (s?.kind === "umpire") redirect(`/t/${s.tournamentId}/score/${s.matchId}`); // umpires stay on their match
  const user = await currentUser();
  if (!user) redirect("/login");
  if (role && user.role !== role) redirect("/dashboard");
  return user;
}

export type MatchRow = typeof schema.matches.$inferSelect;
export type TeamRow = typeof schema.teams.$inferSelect;
export type TournamentRow = typeof schema.tournaments.$inferSelect;

export async function loadTournament(id: string) {
  const [t] = await db.select().from(schema.tournaments).where(eq(schema.tournaments.id, id));
  if (!t) return null;
  const [teams, matches] = await Promise.all([
    db.select().from(schema.teams).where(eq(schema.teams.tournamentId, id)).orderBy(asc(schema.teams.createdAt), asc(schema.teams.id)),
    db.select().from(schema.matches).where(eq(schema.matches.tournamentId, id)).orderBy(asc(schema.matches.no)),
  ]);
  return { t, teams, matches };
}

export function toMatchLite(m: MatchRow, withCode: boolean): MatchLite {
  return {
    id: m.id, no: m.no, stage: m.stage, groupNo: m.groupNo, round: m.round, slot: m.slot, label: m.label,
    sideA: m.sideA, sideB: m.sideB, date: m.date, time: m.time, state: m.state,
    ...(withCode ? { code: m.code } : {}),
  };
}

export function toTData(t: TournamentRow, teams: TeamRow[], matches: MatchRow[], withCodes = false): TData {
  return {
    matchType: t.matchType,
    groups: t.groups,
    teams: teams.map((x) => ({ id: x.id, players: x.players })),
    matches: matches.map((m) => toMatchLite(m, withCodes)),
  };
}

/** A tournament page: open to its organizer and to players who joined it. */
export async function tournamentAccess(id: string) {
  const user = await requireUser();
  const data = await loadTournament(id);
  if (!data) notFound();
  const isOwner = data.t.ownerId === user.id;
  const myTeam = data.teams.find((x) => x.ownerId === user.id) ?? null;
  if (!isOwner && !myTeam) notFound();
  return { user, ...data, isOwner, myTeam };
}
