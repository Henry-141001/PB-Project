"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { generateFixtures, resetFixtures } from "@/app/actions/tournaments";
import { Ball, Cal, Clock, Shield, Trophy, Users } from "@/components/icons";
import { CopyButton, useUI } from "@/components/ui";
import {
  fmtDate, groupDone, LETTERS, MATCH_TYPES, matchInfo, standings, tabOf, teamName,
  type MatchLite, type MatchType, type Resolved, type StandingRow, type TData,
} from "@/lib/tournament";

type TournamentInfo = {
  id: string; name: string; matchType: MatchType; category: string; location: string; code: string | null;
  maxTeams: number; generated: boolean; draw: string[] | null; drawnAt: string | null;
};

export function MatchesView({ tournament: t, data, isOrg, myTeamId }: { tournament: TournamentInfo; data: TData; isOrg: boolean; myTeamId: string | null }) {
  const { confirm, toast } = useUI();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const scrollToDetails = useRef(false);

  useEffect(() => {
    if (scrollToDetails.current) {
      detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      scrollToDetails.current = false;
    }
  }, [sel]);

  const defaultTab = () => {
    if (data.matchType !== "groupko" || !data.groups) return data.matchType;
    const groups = data.groups;
    if (groups.every((_, g) => groupDone(data, g))) return "ko";
    const mine = groups.findIndex((g) => myTeamId && g.includes(myTeamId));
    if (mine >= 0) return `g${mine}`;
    return `g${Math.max(0, groups.findIndex((_, g) => !groupDone(data, g)))}`;
  };
  const curTab = t.generated ? (tab ?? defaultTab()) : null;
  const inTab = curTab ? data.matches.filter((m) => tabOf(m) === curTab) : [];
  const pick = inTab.find((m) => ["ready", "live"].includes(matchInfo(data, m).status)) ?? inTab.find((m) => !matchInfo(data, m).bye);
  const selected = inTab.find((m) => m.id === sel) ?? pick ?? null;

  const select = (m: MatchLite) => { scrollToDetails.current = true; setTab(tabOf(m)); setSel(m.id); };

  const generate = async () => {
    if (!(await confirm(`Do the random draw and generate the matches for ${data.teams.length} teams? Registration closes and players can no longer join.`))) return;
    start(async () => {
      const r = await generateFixtures(t.id);
      setTab(null); setSel(null);
      toast(r.error ?? "Random draw done. Fixtures generated.");
    });
  };
  const reset = async () => {
    if (!(await confirm("Reset the fixtures? All matches and scores are deleted and players can join again."))) return;
    start(async () => {
      const r = await resetFixtures(t.id);
      setTab(null); setSel(null);
      toast(r.error ?? "Fixtures reset");
    });
  };

  return (
    <section className="mpage" style={pending ? { opacity: 0.6 } : undefined}>
      <div className="m-title">
        <h1>{t.name}</h1>
        <p>{MATCH_TYPES[t.matchType].name} · {t.category} · {t.location}</p>
      </div>

      {!t.generated ? (
        <NotGenerated t={t} data={data} isOrg={isOrg} myTeamId={myTeamId} onGenerate={generate} pending={pending} />
      ) : (
        <>
          {myTeamId && <NextMatch data={data} myTeamId={myTeamId} onView={select} />}
          {data.matchType === "groupko" && data.groups && (
            <div className="stage-pills">
              {data.groups.map((_, g) => (
                <button key={g} className={curTab === `g${g}` ? "active" : ""} onClick={() => { setTab(`g${g}`); setSel(null); }}>Group {LETTERS[g]}</button>
              ))}
              <button className={curTab === "ko" ? "active" : ""} onClick={() => { setTab("ko"); setSel(null); }}>Knockout</button>
            </div>
          )}

          {curTab === "rr" && (
            <>
              <SecHead icon={<Users />} title="Round Robin" sub="Standings & Matches" />
              <div className="frame">
                <StandingsTable data={data} rows={standings(t.draw ?? data.teams.map((x) => x.id), inTab)} qualify={0} myTeamId={myTeamId} />
                <div className="mlist-title"><Trophy /> All Matches</div>
                <MatchList data={data} matches={inTab} selId={selected?.id} myTeamId={myTeamId} onSelect={select} />
              </div>
            </>
          )}
          {curTab?.startsWith("g") && data.groups && (() => {
            const g = Number(curTab.slice(1));
            return (
              <>
                <SecHead icon={<Users />} title="Group Stage" sub={`Group ${LETTERS[g]} Standings & Matches · top 2 go to the knockout`} />
                <div className="frame">
                  <StandingsTable data={data} rows={standings(data.groups[g], inTab)} qualify={2} myTeamId={myTeamId} />
                  <div className="mlist-title"><Trophy /> Group {LETTERS[g]} Matches</div>
                  <MatchList data={data} matches={inTab} selId={selected?.id} myTeamId={myTeamId} onSelect={select} />
                </div>
              </>
            );
          })()}
          {curTab === "ko" && (
            <>
              <SecHead icon={<Trophy />} title="Knockout Tournament" sub="Road to the Championship" />
              <div className="frame"><Bracket data={data} selId={selected?.id} myTeamId={myTeamId} onSelect={select} /></div>
            </>
          )}

          {selected && <Details ref={detailsRef} t={t} data={data} m={selected} isOrg={isOrg} myTeamId={myTeamId} />}
          {t.draw && <DrawPanel t={t} data={data} myTeamId={myTeamId} />}
          {isOrg && (
            <div className="reset-row">
              <button className="btn btn-outline btn-sm" onClick={reset} disabled={pending}>Reset fixtures</button>
              <span className="hint">Deletes all matches and scores, and reopens registration. Generating again makes a new random draw.</span>
            </div>
          )}
          <p className="sync-note">Scores update automatically every few seconds.</p>
        </>
      )}
    </section>
  );
}

const SecHead = ({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) => (
  <div className="sec-head"><h2>{icon}{title}</h2><p>{sub}</p></div>
);

function NotGenerated({ t, data, isOrg, myTeamId, onGenerate, pending }: { t: TournamentInfo; data: TData; isOrg: boolean; myTeamId: string | null; onGenerate: () => void; pending: boolean }) {
  const min = MATCH_TYPES[t.matchType].min;
  const enough = data.teams.length >= min;
  const list = data.teams.length > 0 && (
    <div className="mini-teams">
      {data.teams.map((tm) => <span key={tm.id} className={tm.id === myTeamId ? "me" : ""}><Shield />{tm.players.join(" / ")}</span>)}
    </div>
  );
  return isOrg ? (
    <div className="frame center">
      <h3>The matches aren&apos;t generated yet</h3>
      <p><b>{data.teams.length}/{t.maxTeams}</b> teams have joined with code <b>{t.code}</b>.</p>
      {list}
      <button className="btn btn-primary" onClick={onGenerate} disabled={!enough || pending}>🎲 Random draw &amp; generate fixtures</button>
      <p className="hint">{enough
        ? "The app shuffles the teams like names pulled from a hat, so joining early gives no advantage. Then it builds the schedule and closes registration."
        : `${MATCH_TYPES[t.matchType].name} needs at least ${min} teams.`}</p>
    </div>
  ) : (
    <div className="frame center">
      <h3>Waiting for the organizer</h3>
      <p>The matches appear here once the organizer generates the fixtures. <b>{data.teams.length}/{t.maxTeams}</b> teams have joined.</p>
      {list}
    </div>
  );
}

function NextMatch({ data, myTeamId, onView }: { data: TData; myTeamId: string; onView: (m: MatchLite) => void }) {
  const mine = data.matches.map((m) => ({ m, i: matchInfo(data, m) })).filter(({ i }) => i.A.id === myTeamId || i.B.id === myTeamId);
  const next = mine.find(({ i }) => i.status === "ready" || i.status === "live");
  if (next) {
    const opp = next.i.A.id === myTeamId ? next.i.B.label : next.i.A.label;
    return (
      <div className="next-banner">
        <span>{next.i.status === "live" ? <><span className="live-dot" />Your match is live</> : "Your next match"}:{" "}
          <b>vs {opp}</b> · M{next.m.no} {next.m.label} · {fmtDate(next.m.date)} {next.m.time}</span>
        <button className="btn btn-sm" onClick={() => onView(next.m)}>View</button>
      </div>
    );
  }
  const waiting = data.matches.some((m) => m.stage === "ko" && matchInfo(data, m).status === "tbd");
  const out = mine.length > 0 && mine.every(({ i }) => i.winner) && mine.some(({ i }) => i.winner !== myTeamId);
  return (
    <div className="next-banner"><span>{out ? "Your team's matches are finished. Thanks for playing!" : waiting ? "Your next opponent is decided by earlier results." : "No upcoming match for your team."}</span></div>
  );
}

const HEADERS: [string, string][] = [["PLAYED", "P"], ["WON", "W"], ["LOST", "L"], ["SETS", "SETS"], ["POINTS", "PTS"]];

function StandingsTable({ data, rows, qualify, myTeamId }: { data: TData; rows: StandingRow[]; qualify: number; myTeamId: string | null }) {
  return (
    <div className="table-wrap">
      <table className="stand">
        <thead>
          <tr><th>#</th><th className="l">TEAM</th>{HEADERS.map(([full, short]) => <th key={full}><span className="full">{full}</span><span className="short">{short}</span></th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const diff = r.pf - r.pa;
            return (
              <tr key={r.id} className={`${i < qualify ? "q" : ""} ${r.id === myTeamId ? "mine" : ""}`}>
                <td>{i + 1}</td>
                <td className="l"><span className="tname"><Shield />{teamName(data, r.id)}</span></td>
                <td>{r.p}</td><td>{r.w}</td><td>{r.l}</td><td>{r.gw}-{r.gl}</td>
                <td><span className="pts">{diff > 0 ? "+" : ""}{diff}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MatchList({ data, matches, selId, myTeamId, onSelect }: { data: TData; matches: MatchLite[]; selId?: string; myTeamId: string | null; onSelect: (m: MatchLite) => void }) {
  return (
    <div className="mlist">
      {matches.map((m) => {
        const info = matchInfo(data, m);
        const cls = (S: Resolved) => `${S.id && info.winner === S.id ? "win" : ""} ${S.id && S.id === myTeamId ? "me" : ""}`;
        let score = <span className="mscore muted">vs</span>;
        if (info.status === "done") score = <span className="mscore">{info.games.a} - {info.games.b}</span>;
        if (info.status === "live" && m.state) {
          const c = m.state.sets[m.state.sets.length - 1];
          score = <span className="mscore"><span className="live-dot" />{c.a}-{c.b}</span>;
        }
        return (
          <button key={m.id} className={`mrow ${selId === m.id ? "sel" : ""}`} onClick={() => onSelect(m)}>
            <span className={`mteam ${cls(info.A)}`}>{info.A.label}</span>{score}<span className={`mteam ${cls(info.B)}`}>{info.B.label}</span>
            <span className="mmeta"><Cal />{fmtDate(m.date)} <Clock />{m.time ?? "—"}<span className="stage-chip">M{m.no} · {m.stage === "group" ? "Group Stage" : m.label}</span></span>
          </button>
        );
      })}
    </div>
  );
}

// Two-sided bracket: first half of each round on the left, second half on the right, final in the middle.
function Bracket({ data, selId, myTeamId, onSelect }: { data: TData; selId?: string; myTeamId: string | null; onSelect: (m: MatchLite) => void }) {
  const rounds: MatchLite[][] = [];
  data.matches.filter((m) => m.stage === "ko").forEach((m) => (rounds[m.round] = rounds[m.round] ?? []).push(m));
  rounds.forEach((r) => r.sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0)));
  if (!rounds.length) return null;
  const final = rounds[rounds.length - 1][0];
  const sides = rounds.slice(0, -1);
  const card = (m: MatchLite) => <BracketCard key={m.id} data={data} m={m} sel={selId === m.id} myTeamId={myTeamId} onSelect={onSelect} />;
  const col = (ms: MatchLite[], side: "left" | "right", label: string, i: number) => (
    <div key={`${side}${i}`} className={`bcol ${side} ${ms.length > 1 ? "pair2" : ""} ${i > 0 ? "in" : ""}`}>
      <div className="bhead">{label}</div>
      <div className="bmatches">{ms.map((m, k) => <div key={m.id} className={`bm ${k % 2 ? "bot" : "top"}`}>{card(m)}</div>)}</div>
    </div>
  );
  const champ = matchInfo(data, final).winner;
  return (
    <>
      <div className="bracket-scroll">
        <div className="bracket">
          {sides.map((r, i) => col(r.slice(0, r.length / 2), "left", r[0].label, i))}
          <div className={`bcol final ${sides.length ? "" : "solo"}`}>
            <div className="bhead"><Trophy /> Final</div>
            <div className="bmatches"><div className="bm">{card(final)}</div></div>
            {champ && <div className="champ">🏆 {teamName(data, champ)}</div>}
          </div>
          {sides.map((r, i) => col(r.slice(r.length / 2), "right", r[0].label, i)).reverse()}
        </div>
      </div>
      <p className="hint center-text">Tap a match to see its details. On a phone, swipe sideways to see the whole bracket.
        {data.matchType === "groupko" && " Group places (1A, 2B…) fill in when each group finishes."}</p>
    </>
  );
}

function BracketCard({ data, m, sel, myTeamId, onSelect }: { data: TData; m: MatchLite; sel: boolean; myTeamId: string | null; onSelect: (m: MatchLite) => void }) {
  const info = matchInfo(data, m);
  const row = (S: Resolved, key: "a" | "b") => {
    const cls = !S.id ? "tbd" : info.winner ? (info.winner === S.id ? "win" : "lose") : "";
    return <div className={`bteam ${cls}`}><Shield /><span title={S.label}>{S.label}</span><b>{info.status === "done" ? info.games[key] : ""}</b></div>;
  };
  const mine = myTeamId && (info.A.id === myTeamId || info.B.id === myTeamId);
  const when = m.date ? `${fmtDate(m.date)} · ${m.time}` : info.status === "walkover" ? "Bye" : "";
  return (
    <button className={`bcard ${sel ? "sel" : ""} ${mine ? "mine" : ""} ${info.status === "walkover" || info.bye ? "bye" : ""}`} onClick={() => onSelect(m)}>
      {row(info.A, "a")}{row(info.B, "b")}
      <div className="bmeta"><span>{info.status === "live" && <span className="live-dot" />}M{m.no}</span><span>{when}</span></div>
    </button>
  );
}

function Details({ ref, t, data, m, isOrg, myTeamId }: { ref: React.Ref<HTMLDivElement>; t: TournamentInfo; data: TData; m: MatchLite; isOrg: boolean; myTeamId: string | null }) {
  const info = matchInfo(data, m);
  const sets = (m.state?.sets ?? []).filter((x) => x.done || x.a || x.b).map((x) => `${x.a}-${x.b}`).join(", ");
  const status = {
    done: `Finished · ${info.games.a} – ${info.games.b}${sets ? ` (${sets})` : ""}`,
    live: `Live · ${sets}`,
    ready: "Not started yet",
    tbd: "Waiting for earlier results",
    walkover: `${info.winner ? teamName(data, info.winner) : ""} goes through with a bye`,
    bye: "No match",
  }[info.status];
  const playable = info.A.id && info.B.id;
  const side = (S: Resolved) => (
    <div className={`det-team ${S.id && S.id === info.winner ? "win" : ""} ${S.id && S.id === myTeamId ? "me" : ""}`}><Shield /><span>{S.label}</span></div>
  );
  return (
    <div className="frame details" ref={ref}>
      <h3 className="det-title"><Ball /> Match Details</h3>
      <div className="det-row">
        {side(info.A)}<span className="vs">VS</span>{side(info.B)}
        <div className="det-meta"><Cal />{fmtDate(m.date)} <Clock />{m.time ?? "—"} <span className="stage-chip">{m.label}</span></div>
      </div>
      <p className="det-status">M{m.no} · {info.status === "live" && <span className="live-dot" />}{status}</p>
      {isOrg && playable && m.code && (
        <>
          <div className="det-actions">
            <Link className="btn btn-primary" href={`/t/${t.id}/score/${m.id}`}>{info.status === "done" ? "View scoreboard" : "Open scoreboard"}</Link>
            <div className="umpire-code"><span>Umpire code</span><b>{m.code}</b><CopyButton text={m.code} /></div>
          </div>
          <p className="hint center-text">Give this code to the umpire. They tap “Umpire? Enter match code” on the login page and can only score this match.</p>
        </>
      )}
    </div>
  );
}

function DrawPanel({ t, data, myTeamId }: { t: TournamentInfo; data: TData; myTeamId: string | null }) {
  const what = {
    rr: "Order used to build the rounds.",
    ko: "The drawn order is the seeding: 1st drawn is seed 1.",
    groupko: "Teams were dealt into groups in this order: 1st → Group A, 2nd → Group B, and so on.",
  }[t.matchType];
  return (
    <div className="frame">
      <details className="draw">
        <summary>🎲 Random draw{t.drawnAt ? ` · ${fmtDate(t.drawnAt)}` : ""} <span className="hint">Tap to see the drawn order</span></summary>
        <p className="hint">{what}</p>
        <ol className="draw-list">
          {(t.draw ?? []).map((id) => <li key={id} className={id === myTeamId ? "me" : ""}>{teamName(data, id)}</li>)}
        </ol>
      </details>
    </div>
  );
}
