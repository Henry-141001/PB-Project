import { Suspense } from "react";
import { desc, eq, sql } from "drizzle-orm";
import { Loading, Topbar, TopbarSkeleton } from "@/components/common";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/dal";
import { isTournamentType } from "@/lib/tournament";
import { DashboardList, type CardData } from "./DashboardList";

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <Suspense fallback={<><TopbarSkeleton /><Loading /></>}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/dashboard">["searchParams"] }) {
  const user = await requireUser();
  const { tab } = await searchParams;
  const isOrg = user.role === "Organizer";
  const T = schema.tournaments;
  const teams = schema.teams;

  // One query either way; all tabs are loaded so switching tabs needs no server trip
  let cards: CardData[];
  if (isOrg) {
    const rows = await db
      .select({ t: T, teamCount: sql<number>`(select count(*)::int from ${teams} where ${teams.tournamentId} = ${T.id})` })
      .from(T)
      .where(eq(T.ownerId, user.id))
      .orderBy(desc(T.createdAt));
    cards = rows.map(({ t, teamCount }) => ({
      id: t.id, name: t.name, type: t.type, startDate: t.startDate, endDate: t.endDate, location: t.location, category: t.category,
      matchType: t.matchType, generated: t.generated, maxTeams: t.maxTeams, code: t.code, teamCount: Number(teamCount),
    }));
  } else {
    const rows = await db
      .select({ t: T, players: teams.players })
      .from(teams)
      .innerJoin(T, eq(T.id, teams.tournamentId))
      .where(eq(teams.ownerId, user.id))
      .orderBy(desc(teams.createdAt));
    cards = rows.map(({ t, players }) => ({
      id: t.id, name: t.name, type: t.type, startDate: t.startDate, endDate: t.endDate, location: t.location, category: t.category,
      matchType: t.matchType, generated: t.generated, maxTeams: t.maxTeams, myTeam: players.join(" / "),
    }));
  }

  return (
    <>
      <Topbar name={user.name} role={user.role} />
      <DashboardList isOrg={isOrg} initialTab={isTournamentType(tab) ? tab : "external"} userName={user.name} cards={cards} />
    </>
  );
}
