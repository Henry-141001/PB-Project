import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Loading, Topbar, TopbarSkeleton } from "@/components/common";
import { CopyButton } from "@/components/ui";
import { tournamentAccess } from "@/lib/dal";
import { MATCH_TYPES } from "@/lib/tournament";
import { TeamsManager } from "./TeamsManager";

export default function TeamsPage({ params }: PageProps<"/t/[id]/teams">) {
  return (
    <Suspense fallback={<><TopbarSkeleton /><Loading /></>}>
      <Teams params={params} />
    </Suspense>
  );
}

async function Teams({ params }: { params: PageProps<"/t/[id]/teams">["params"] }) {
  const { id } = await params;
  const { user, t, teams, isOwner } = await tournamentAccess(id);
  if (!isOwner) notFound(); // the Pair page is for the organizer
  return (
    <>
      <Topbar name={user.name} role={user.role} back={`/dashboard?tab=${t.type}`} />
      <section className="pairs">
        <div className="create-head"><h2>{t.name}</h2></div>
        <p className="subline">{MATCH_TYPES[t.matchType].name} · {t.category} · {teams.length}/{t.maxTeams} teams joined</p>
        <div className="code-box">
          <div>
            <small>Tournament code</small>
            <div className="code">{t.code}</div>
            <small>{t.generated ? "Registration is closed because the matches are generated." : "Players type this code in Join Tournament. Each player can add one partner."}</small>
          </div>
          <CopyButton text={t.code} label="Copy code" className="btn" />
        </div>
        <div className="box">
          <h3>Players who joined</h3>
          <TeamsManager code={t.code} generated={t.generated} teams={teams.map((x) => ({ id: x.id, players: x.players }))} />
        </div>
      </section>
    </>
  );
}
