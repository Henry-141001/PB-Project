"use server";

import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { loadTournament, toMatchLite, toTData } from "@/lib/dal";
import { applyScore, initialState, isScoreAction, type ScoreResult } from "@/lib/scoring";
import { getSession } from "@/lib/session";
import { matchInfo } from "@/lib/tournament";

/**
 * Applies one scoreboard action on the server and saves it.
 * Allowed for the tournament's organizer, or an umpire holding this match's code.
 */
export async function scoreMatch(matchId: string, action: unknown): Promise<Partial<ScoreResult> & { error?: string }> {
  if (!isScoreAction(action)) return { error: "Unknown scoreboard action." };
  const s = await getSession();
  if (!s) return { error: "Your session ended. Please log in again." };

  const [m] = await db.select().from(schema.matches).where(eq(schema.matches.id, matchId));
  if (!m) return { error: "This match no longer exists." };
  if (s.kind === "umpire") {
    if (s.matchId !== matchId) return { error: "This umpire code is for a different match." };
  } else {
    const [own] = await db
      .select({ id: schema.tournaments.id })
      .from(schema.tournaments)
      .where(and(eq(schema.tournaments.id, m.tournamentId), eq(schema.tournaments.ownerId, s.userId)));
    if (!own) return { error: "Only the organizer or the umpire can score this match." };
  }

  const data = await loadTournament(m.tournamentId);
  if (!data) return { error: "Tournament not found." };
  const info = matchInfo(toTData(data.t, data.teams, data.matches), toMatchLite(m, false));
  if (!info.A.id || !info.B.id) return { error: "This match isn't ready yet." };

  const result = applyScore(m.state ?? initialState(data.t.gameTo, data.t.bestOf), action);
  if (result.error || result.needsConfirm) return result;
  await db.update(schema.matches).set({ state: result.state, updatedAt: new Date() }).where(eq(schema.matches.id, matchId));
  return result;
}
