import { Suspense } from "react";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Loading, Topbar, TopbarSkeleton } from "@/components/common";
import { toTData, tournamentAccess } from "@/lib/dal";
import { MatchesView } from "./MatchesView";

export default function MatchesPage({ params }: PageProps<"/t/[id]/matches">) {
  return (
    <Suspense fallback={<><TopbarSkeleton /><Loading /></>}>
      <Matches params={params} />
    </Suspense>
  );
}

async function Matches({ params }: { params: PageProps<"/t/[id]/matches">["params"] }) {
  const { id } = await params;
  const { user, t, teams, matches, isOwner, myTeam } = await tournamentAccess(id);
  return (
    <>
      <Topbar name={user.name} role={user.role} back={`/dashboard?tab=${t.type}`} />
      <MatchesView
        isOrg={isOwner}
        myTeamId={myTeam?.id ?? null}
        // Umpire codes go to the organizer only
        data={toTData(t, teams, matches, isOwner)}
        tournament={{
          id: t.id, name: t.name, matchType: t.matchType, category: t.category, location: t.location,
          code: isOwner ? t.code : null, maxTeams: t.maxTeams, generated: t.generated, draw: t.draw, drawnAt: t.drawnAt,
        }}
      />
      <AutoRefresh seconds={4} />
    </>
  );
}
