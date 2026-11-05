import Link from "next/link";
import { Suspense } from "react";
import { count, desc, eq, inArray } from "drizzle-orm";
import { Loading, Topbar, TopbarSkeleton } from "@/components/common";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/dal";
import { isTournamentType, TYPES, type TournamentType } from "@/lib/tournament";
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
  const { tab: rawTab } = await searchParams;
  const tab: TournamentType = isTournamentType(rawTab) ? rawTab : "external";
  const isOrg = user.role === "Organizer";
  const T = schema.tournaments;

  let cards: CardData[];
  if (isOrg) {
    // Organizers see the tournaments they created
    const rows = await db.select().from(T).where(eq(T.ownerId, user.id)).orderBy(desc(T.createdAt));
    const counts = rows.length
      ? await db.select({ id: schema.teams.tournamentId, n: count() }).from(schema.teams).where(inArray(schema.teams.tournamentId, rows.map((r) => r.id))).groupBy(schema.teams.tournamentId)
      : [];
    cards = rows.map((t) => ({
      id: t.id, name: t.name, type: t.type, startDate: t.startDate, endDate: t.endDate, location: t.location, category: t.category,
      matchType: t.matchType, generated: t.generated, maxTeams: t.maxTeams, code: t.code,
      teamCount: counts.find((c) => c.id === t.id)?.n ?? 0,
    }));
  } else {
    // Players see the tournaments they joined
    const rows = await db
      .select({ t: T, players: schema.teams.players })
      .from(schema.teams)
      .innerJoin(T, eq(T.id, schema.teams.tournamentId))
      .where(eq(schema.teams.ownerId, user.id))
      .orderBy(desc(schema.teams.createdAt));
    cards = rows.map(({ t, players }) => ({
      id: t.id, name: t.name, type: t.type, startDate: t.startDate, endDate: t.endDate, location: t.location, category: t.category,
      matchType: t.matchType, generated: t.generated, maxTeams: t.maxTeams, myTeam: players.join(" / "),
    }));
  }

  return (
    <>
      <Topbar name={user.name} role={user.role} />
      <nav className="tabs" aria-label="Tournament type">
        {Object.entries(TYPES).map(([k, v]) => (
          <Link key={k} href={`/dashboard?tab=${k}`} className={k === tab ? "active" : ""} aria-current={k === tab ? "page" : undefined}>{v}</Link>
        ))}
      </nav>
      <DashboardList isOrg={isOrg} tab={tab} userName={user.name} cards={cards.filter((c) => c.type === tab)} />
    </>
  );
}
