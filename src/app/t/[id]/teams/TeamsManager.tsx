"use client";

import { useTransition } from "react";
import { removeMember, removeTeam } from "@/app/actions/tournaments";
import { useUI } from "@/components/ui";
import type { TeamLite } from "@/lib/tournament";

export function TeamsManager({ teams, code, generated }: { teams: TeamLite[]; code: string; generated: boolean }) {
  const { confirm, toast } = useUI();
  const [pending, start] = useTransition();

  const dropTeam = async (tm: TeamLite) => {
    if (generated) return toast("Matches are already generated. Reset the fixtures on the Match page first.");
    if (!(await confirm(`Remove ${tm.players.join(" / ")} from the tournament?`))) return;
    start(async () => toast((await removeTeam(tm.id)).error ?? "Team removed"));
  };
  const dropMember = async (tm: TeamLite, i: number) => {
    if (tm.players.length < 2) return dropTeam(tm);
    if (!(await confirm(`Remove ${tm.players[i]}? ${tm.players[1 - i]} stays in the tournament as solo.`))) return;
    start(async () => toast((await removeMember(tm.id, i)).error ?? "Player removed"));
  };

  if (!teams.length) return <p className="empty" style={{ padding: "30px 10px" }}>No one has joined yet. Share the code <b>{code}</b> with players.</p>;
  return (
    <div className="team-grid" style={pending ? { opacity: 0.6 } : undefined}>
      {teams.map((tm, n) => (
        <div className="team-card" key={tm.id}>
          <div className="top"><span>Team {n + 1}</span><span className="badge">{tm.players.length > 1 ? "Pair" : "Solo"}</span></div>
          <div className="members">
            {tm.players.map((p, i) => (
              <span className="member" key={i}>{p}
                <button title={`Remove ${p}`} aria-label={`Remove ${p}`} onClick={() => dropMember(tm, i)} disabled={pending}>✕</button>
              </span>
            ))}
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => dropTeam(tm)} disabled={pending}>Remove team</button>
        </div>
      ))}
    </div>
  );
}
