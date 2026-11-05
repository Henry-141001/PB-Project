import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Loading, Topbar, TopbarSkeleton } from "@/components/common";
import { db, schema } from "@/db";
import { currentUser, loadTournament, toMatchLite, toTData } from "@/lib/dal";
import { initialState } from "@/lib/scoring";
import { getSession } from "@/lib/session";
import { matchInfo } from "@/lib/tournament";
import { Scoreboard } from "./Scoreboard";

export default function ScorePage({ params }: PageProps<"/t/[id]/score/[matchId]">) {
  return (
    <Suspense fallback={<><TopbarSkeleton /><Loading /></>}>
      <Score params={params} />
    </Suspense>
  );
}

async function Score({ params }: { params: PageProps<"/t/[id]/score/[matchId]">["params"] }) {
  const { id, matchId } = await params;
  const session = await getSession();
  const isUmpire = session?.kind === "umpire";
  let who: { name: string; role: string };

  if (isUmpire) {
    // An umpire code only opens its own match
    if (session.matchId !== matchId) redirect(`/t/${session.tournamentId}/score/${session.matchId}`);
    who = { name: "Umpire", role: "Umpire" };
  } else {
    const user = await currentUser();
    if (!user) redirect("/login");
    const [own] = await db.select({ id: schema.tournaments.id }).from(schema.tournaments)
      .where(and(eq(schema.tournaments.id, id), eq(schema.tournaments.ownerId, user.id)));
    if (!own) notFound();
    who = { name: user.name, role: user.role };
  }

  const data = await loadTournament(id);
  const match = data?.matches.find((m) => m.id === matchId);
  if (!data || !match) notFound();
  const info = matchInfo(toTData(data.t, data.teams, data.matches), toMatchLite(match, false));
  const back = isUmpire ? undefined : `/t/${id}/matches`;

  if (!info.A.id || !info.B.id) {
    return (
      <>
        <Topbar name={who.name} role={who.role} back={back} umpire={isUmpire} />
        <div className="score-page"><div className="frame center wait">
          <h3>This match isn&apos;t ready yet</h3>
          <p>M{match.no} · {match.label}</p>
          <p><b>{info.A.label}</b> vs <b>{info.B.label}</b></p>
          <p className="hint">Scoring opens when both teams are known.</p>
        </div></div>
      </>
    );
  }

  const players = (teamId: string) => data.teams.find((x) => x.id === teamId)?.players ?? ["Team"];
  return (
    <>
      <Topbar name={who.name} role={who.role} back={back} umpire={isUmpire} />
      <Scoreboard
        matchId={match.id}
        title={`${data.t.name} · M${match.no} ${match.label}`}
        a={players(info.A.id)}
        b={players(info.B.id)}
        initial={match.state ?? initialState(data.t.gameTo, data.t.bestOf)}
        umpireCode={isUmpire ? match.code : null}
        backHref={back ?? null}
      />
    </>
  );
}
