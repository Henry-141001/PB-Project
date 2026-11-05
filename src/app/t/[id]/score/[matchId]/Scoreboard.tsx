"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { scoreMatch } from "@/app/actions/score";
import { useUI } from "@/components/ui";
import { applyScore, BEST_OF, hasStarted, setsWon, TARGETS, type ScoreAction, type ScoreResult } from "@/lib/scoring";
import type { MatchState, Side } from "@/lib/tournament";

type Props = { tournamentId: string; matchId: string; title: string; a: string[]; b: string[]; initial: MatchState; umpireCode: string | null; backHref: string | null };

export function Scoreboard({ tournamentId, matchId, title, a, b, initial, umpireCode, backHref }: Props) {
  const { toast, confirm } = useUI();
  const [st, setSt] = useState<MatchState>(initial);
  const [bumped, setBumped] = useState<Side | null>(null);
  const queue = useRef(Promise.resolve());
  const pendingCount = useRef(0);
  const nameA = a.join(" / ");
  const nameB = b.join(" / ");

  const announce = useCallback((r: Partial<ScoreResult>) => {
    if (!r.event) return;
    const who = r.event.side === "a" ? nameA : nameB;
    toast(r.event.kind === "match" ? `🏆 ${who} win the match!` : `Set ${r.event.set} to ${who}`);
  }, [nameA, nameB, toast]);

  // Apply locally right away, then save on the server in order; the server's answer is the truth.
  const run = useCallback(async (requested: ScoreAction) => {
    let action = requested;
    let local = applyScore(st, action);
    if (local.needsConfirm) {
      if (!(await confirm(local.needsConfirm))) return;
      action = { type: "newSet", force: true };
      local = applyScore(st, action);
    }
    if (local.error) return toast(local.error);
    setSt(local.state);
    if (action.type === "point") setBumped(action.side);
    announce(local);
    pendingCount.current++;
    queue.current = queue.current.then(async () => {
      try {
        const r = await scoreMatch(tournamentId, matchId, action);
        // Only take the server's state once every queued tap is saved, so fast tapping never flickers back
        if (--pendingCount.current === 0 && r.state) setSt(r.state);
        if (r.error) toast(r.error);
      } catch {
        pendingCount.current--;
        toast("Couldn't save. Check your connection; the last point may not be saved.");
      }
    });
  }, [st, tournamentId, matchId, confirm, toast, announce]);

  // Keyboard shortcuts: A / L add points, U undo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "SELECT" || tag === "INPUT" || e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === "a") run({ type: "point", side: "a" });
      else if (k === "l") run({ type: "point", side: "b" });
      else if (k === "u") run({ type: "undo" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run]);

  useEffect(() => {
    if (!bumped) return;
    const id = setTimeout(() => setBumped(null), 320);
    return () => clearTimeout(id);
  }, [bumped, st]);

  const s = st.sets[st.sets.length - 1];
  // Even score -> server stands on the right (top cell for A, bottom for B, facing the net)
  const rightSide = s[st.server] % 2 === 0;
  const serving = (side: Side, idx: number) => st.server === side && (idx === 0) === rightSide && !st.winner;
  const locked = hasStarted(st);

  const cells = (players: string[], side: Side, col: number) => {
    const cls = `player ${side === "b" ? "b" : ""}`;
    if (players.length < 2) {
      return (
        <div className="cell" style={{ gridColumn: col, gridRow: "1 / span 2" }}>
          <div className={`${cls} ${st.server === side && !st.winner ? "serving" : ""}`}>{players[0]}</div>
        </div>
      );
    }
    const [top, bottom] = side === "a" ? [0, 1] : [1, 0];
    return (
      <>
        <div className="cell" style={{ gridColumn: col, gridRow: 1 }}><div className={`${cls} ${serving(side, top) ? "serving" : ""}`}>{players[0]}</div></div>
        <div className="cell" style={{ gridColumn: col, gridRow: 2 }}><div className={`${cls} ${serving(side, bottom) ? "serving" : ""}`}>{players[1]}</div></div>
      </>
    );
  };

  return (
    <div className="score-page">
      <div className="board">
        <div className="board-left">
          <div className="match-title">{title} · Set {st.sets.length}</div>
          <div className="court">
            {cells(a, "a", 1)}
            <div className="cell kitchen k1" />
            <div className="cell kitchen k2" />
            {cells(b, "b", 4)}
            <div className="net" />
          </div>

          <div className="scoreline">
            <div><div className="team" title={nameA}>{nameA}</div><div className={`num ${bumped === "a" ? "bump" : ""}`}>{s.a}</div></div>
            <div className="dash">–</div>
            <div><div className="team" title={nameB}>{nameB}</div><div className={`num ${bumped === "b" ? "bump" : ""}`}>{s.b}</div></div>
            <div className="call">
              {st.winner ? <b>Match over</b> : <>Serving: <b>{st.server === "a" ? nameA : nameB}</b> · Sets {setsWon(st, "a")} – {setsWon(st, "b")}</>}
            </div>
          </div>

          <div className="ctrl-row">
            <button className="btn" onClick={() => run({ type: "point", side: "a" })}>Add point</button>
            <button className="btn" onClick={() => run({ type: "point", side: "b" })}>Add point</button>
          </div>
          <button className="btn btn-set btn-wide" onClick={() => run({ type: "newSet" })}>Add New Set</button>
          <button className="btn btn-undo btn-wide" onClick={() => run({ type: "undo" })}>UNDO</button>
        </div>

        <aside className="board-right">
          <h4>Sets</h4>
          {Array.from({ length: st.bestOf }, (_, i) => {
            const x = st.sets[i];
            if (!x) return <div key={i} className="set-pill"><span>Set {i + 1}</span><span style={{ color: "#bbb" }}>—</span></div>;
            const w = x.done ? (x.a > x.b ? "a" : "b") : null;
            return (
              <div key={i} className={`set-pill ${!x.done ? "current" : ""}`}>
                <span>Set {i + 1}</span>
                <span><span className={w === "a" ? "w" : ""}>{x.a}</span> – <span className={w === "b" ? "w" : ""}>{x.b}</span></span>
              </div>
            );
          })}
          {st.winner && <div className="winner-banner">🏆 {(st.winner === "a" ? a : b).join(" & ")} WIN!</div>}
          <div className="spacer" />
          <div className="settings">
            <label>Points per game{" "}
              <select value={st.target} disabled={locked} onChange={(e) => run({ type: "settings", target: Number(e.target.value) })}>
                {TARGETS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label>Match format{" "}
              <select value={st.bestOf} disabled={locked} onChange={(e) => run({ type: "settings", bestOf: Number(e.target.value) })}>
                {BEST_OF.map((n) => <option key={n} value={n}>Best of {n}</option>)}
              </select>
            </label>
          </div>
          {umpireCode ? <p className="ump-note">Umpire mode · match code {umpireCode}</p>
            : backHref && <Link className="btn btn-ghost btn-sm" href={backHref}>← Back to matches</Link>}
        </aside>
      </div>
    </div>
  );
}
