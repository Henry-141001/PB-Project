"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteTournament, joinTournament, leaveTournament, previewJoin, type JoinPreview } from "@/app/actions/tournaments";
import { Logo } from "@/components/common";
import { CopyButton, Modal, useUI } from "@/components/ui";
import { cleanCode, fmtDate, MATCH_TYPES, TYPES, type MatchType, type TournamentType } from "@/lib/tournament";

export type CardData = {
  id: string; name: string; type: TournamentType; startDate: string; endDate: string; location: string; category: string;
  matchType: MatchType; generated: boolean; maxTeams: number;
  code?: string; teamCount?: number; // organizer only
  myTeam?: string; // player only
};

export function DashboardList({ isOrg, tab, cards, userName }: { isOrg: boolean; tab: TournamentType; cards: CardData[]; userName: string }) {
  const [q, setQ] = useState("");
  const shown = cards.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <section className="panel">
      <div className="toolbar">
        <input className="input search" placeholder="Search Tournament Name" aria-label="Search tournament name" value={q} onChange={(e) => setQ(e.target.value)} />
        {isOrg ? <Link className="btn btn-red" href={`/create?type=${tab}`}>CREATE TOURNAMENT</Link> : <JoinBar userName={userName} />}
      </div>
      {shown.length ? shown.map((c) => <Card key={c.id} c={c} isOrg={isOrg} />) : (
        <div className="empty">
          <div className="big">🏓</div>
          <p>{q ? "No tournament matches your search." : isOrg ? `No ${TYPES[tab]} yet.` : `You haven't joined any ${TYPES[tab]} yet.`}</p>
          {!q && <p>{isOrg ? <>Click <b>Create Tournament</b> to add one.</> : "Ask the organizer for the 6-character tournament code and type it in the box above."}</p>}
        </div>
      )}
    </section>
  );
}

function Card({ c, isOrg }: { c: CardData; isOrg: boolean }) {
  const { confirm, toast } = useUI();
  const [pending, start] = useTransition();
  const dates = `${fmtDate(c.startDate)}${c.endDate && c.endDate !== c.startDate ? " → " + fmtDate(c.endDate) : ""}`;

  const remove = async () => {
    if (!(await confirm(isOrg ? "Delete this tournament with all its teams and matches?" : "Leave this tournament? Your team will be removed."))) return;
    start(async () => {
      const r = isOrg ? await deleteTournament(c.id) : await leaveTournament(c.id);
      toast(r.error ?? (isOrg ? "Tournament deleted" : `You left ${c.name}`));
    });
  };

  return (
    <article className="t-card" style={pending ? { opacity: 0.5 } : undefined}>
      <div className="logo-box"><Logo plain /></div>
      <div className="t-info">
        <div className="chip name" title={c.name}>{c.name}</div>
        <div className="chip">📅 {dates}</div>
        <div className="chip" title={c.location}>📍 {c.location}</div>
        <div className="chip">🏷 {c.category}</div>
        <div className="chip">{MATCH_TYPES[c.matchType].name}</div>
        {isOrg ? (
          <>
            <CopyButton text={c.code ?? ""} label={`Code ${c.code}`} className="chip code" />
            <div className="chip">{c.teamCount}/{c.maxTeams} teams · {c.generated ? "Fixtures ready" : "Open"}</div>
          </>
        ) : (
          <>
            <div className="chip">{c.generated ? "Fixtures ready" : "Waiting for fixtures"}</div>
            <div className="chip mine" title={c.myTeam}>Your team: {c.myTeam}</div>
          </>
        )}
        <div className="t-actions">
          {isOrg ? (
            <>
              <Link className="btn btn-primary btn-sm" href={`/t/${c.id}/matches`}>Match</Link>
              <Link className="btn btn-primary btn-sm" href={`/t/${c.id}/teams`}>Pair</Link>
              <button className="btn btn-red btn-sm" onClick={remove} disabled={pending}>Delete</button>
            </>
          ) : (
            <>
              <Link className="btn btn-primary btn-sm" href={`/t/${c.id}/matches`}>Matches</Link>
              {!c.generated && <button className="btn btn-red btn-sm" onClick={remove} disabled={pending}>Leave</button>}
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function JoinBar({ userName }: { userName: string }) {
  const router = useRouter();
  const { toast } = useUI();
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<JoinPreview["tournament"] | null>(null);
  const [error, setError] = useState("");
  const [partner, setPartner] = useState("");
  const [pending, start] = useTransition();

  const check = (e: React.FormEvent) => {
    e.preventDefault();
    const c = cleanCode(code);
    if (c.length !== 6) return toast("A tournament code has 6 letters or numbers");
    start(async () => {
      const r = await previewJoin(c);
      if (r.error) return toast(r.error);
      setError(""); setPartner(""); setPreview(r.tournament ?? null);
    });
  };

  const join = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await joinTournament(cleanCode(code), partner);
      if (r.error) return setError(r.error);
      setPreview(null); setCode("");
      toast(`Joined ${r.name}! The organizer can see your team now.`);
      router.push(`/dashboard?tab=${r.type}`);
    });
  };

  const singles = preview ? /singles/i.test(preview.category) : false;
  return (
    <>
      <form className="join" onSubmit={check}>
        <input className="input code-input" maxLength={6} placeholder="TOURNAMENT CODE" aria-label="Tournament code" value={code} onChange={(e) => setCode(e.target.value)} />
        <button className="btn btn-red" type="submit" disabled={pending}>JOIN TOURNAMENT</button>
      </form>
      {preview && (
        <Modal onClose={() => setPreview(null)}>
          <h3>Join tournament</h3>
          <div className="join-sum">
            <b>{preview.name}</b>
            <span>{preview.location}</span>
            <span>{fmtDate(preview.startDate)} · {MATCH_TYPES[preview.matchType].name} · {preview.category}</span>
            <span>Organizer: {preview.organizer} · {preview.teams}/{preview.maxTeams} teams joined</span>
          </div>
          <form onSubmit={join}>
            <div className="field"><label>Member 1 (you)</label><input className="input" value={userName} readOnly /></div>
            {singles
              ? <p className="hint">Singles category: you join solo.</p>
              : <div className="field"><label htmlFor="partner">Member 2 (partner, optional)</label><input className="input" id="partner" value={partner} maxLength={60} onChange={(e) => setPartner(e.target.value)} placeholder="Leave empty to join solo" autoFocus /></div>}
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="actions">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setPreview(null)}>Cancel</button>
              <button className="btn btn-primary btn-sm" disabled={pending}>{pending ? "Joining…" : "Join"}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
