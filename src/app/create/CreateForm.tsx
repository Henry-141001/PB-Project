"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { createTournament } from "@/app/actions/tournaments";
import { Logo } from "@/components/common";
import { CopyButton, Modal } from "@/components/ui";
import { CATEGORIES, MATCH_TYPES, TYPES, type MatchType, type TournamentType } from "@/lib/tournament";

export function CreateForm({ type, organizerName }: { type: TournamentType; organizerName: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createTournament, undefined);
  const [matchType, setMatchType] = useState<MatchType>("rr");
  const [closed, setClosed] = useState<string | null>(null);
  const v = state?.values ?? {};
  const done = () => router.push(`/dashboard?tab=${type}`);

  return (
    <>
      <form className="create" action={action} autoComplete="off">
        <div className="create-head"><h2>Create Your Tournament</h2><Logo size="lg" plain /></div>
        <p className="listed">Listed under <span className="stage-chip">{TYPES[type]}</span> · A join code is created automatically</p>
        <input type="hidden" name="type" value={type} />
        {state?.error && <p className="form-error" role="alert">{state.error}</p>}
        <div className="grid-2">
          <div className="box">
            <h3>Event Details</h3>
            <div className="field"><label htmlFor="name">Tournament name</label><input className="input" id="name" name="name" placeholder="NAME" maxLength={80} defaultValue={v.name} required /></div>
            <div className="field"><label htmlFor="location">Location</label><input className="input" id="location" name="location" placeholder="DEWAN, DAERAH, NEGERI" defaultValue={v.location} required /></div>
          </div>
          <div className="box">
            <h3>Tournament Organizer</h3>
            <div className="field"><label htmlFor="organizer">Main organizer</label><input className="input" id="organizer" name="organizer" placeholder="NAME" defaultValue={v.organizer ?? organizerName} required /></div>
            <div className="field"><label htmlFor="orgPhone">Number phone</label><input className="input" id="orgPhone" name="orgPhone" type="tel" placeholder="01X-XXXXXXX" defaultValue={v.orgPhone} required /></div>
          </div>
        </div>
        <div className="box">
          <h3>Competition Category</h3>
          <div className="comp-grid">
            <div>
              <div className="field">
                <label htmlFor="matchType">Match type</label>
                <select className="input" id="matchType" name="matchType" value={matchType} onChange={(e) => setMatchType(e.target.value as MatchType)}>
                  {Object.entries(MATCH_TYPES).map(([k, m]) => <option key={k} value={k}>{m.name}</option>)}
                </select>
                <p className="hint">{MATCH_TYPES[matchType].hint}</p>
              </div>
              <div className="field">
                <label htmlFor="category">Category</label>
                <select className="input" id="category" name="category" defaultValue={v.category ?? CATEGORIES[0]}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="date-grid">
                <div className="field"><label htmlFor="maxTeams">Total team (max)</label><input className="input" id="maxTeams" name="maxTeams" type="number" min={MATCH_TYPES[matchType].min} max={64} defaultValue={v.maxTeams ?? 8} required /></div>
                <div className="field"><label htmlFor="gameTo">Points per game</label>
                  <select className="input" id="gameTo" name="gameTo" defaultValue={v.gameTo ?? "11"}><option>11</option><option>15</option><option>21</option></select></div>
                <div className="field"><label htmlFor="bestOf">Match format</label>
                  <select className="input" id="bestOf" name="bestOf" defaultValue={v.bestOf ?? "3"}><option value="1">Best of 1</option><option value="3">Best of 3</option><option value="5">Best of 5</option></select></div>
              </div>
            </div>
            <div>
              <div className="date-grid">
                <div className="field"><label htmlFor="startDate">Start date</label><input className="input" id="startDate" name="startDate" type="date" defaultValue={v.startDate} required /></div>
                <div className="field"><label htmlFor="endDate">End date</label><input className="input" id="endDate" name="endDate" type="date" defaultValue={v.endDate} required /></div>
                <div className="field"><label htmlFor="startTime">Start time</label><input className="input" id="startTime" name="startTime" type="time" defaultValue={v.startTime} required /></div>
                <div className="field"><label htmlFor="endTime">End time</label><input className="input" id="endTime" name="endTime" type="time" defaultValue={v.endTime} required /></div>
              </div>
              <div className="submit"><button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Creating…" : "Create tournament"}</button></div>
            </div>
          </div>
        </div>
      </form>

      {state?.code && closed !== state.code && (
        <Modal onClose={() => { setClosed(state.code!); done(); }}>
          <h3>Tournament created!</h3>
          <p style={{ fontSize: 14 }}>Share this code with players. They type it in <b>Join Tournament</b> on their page.</p>
          <div className="big-code">{state.code}</div>
          <div className="actions">
            <CopyButton text={state.code} label="Copy code" />
            <button className="btn btn-primary btn-sm" onClick={() => { setClosed(state.code!); done(); }}>Done</button>
          </div>
        </Modal>
      )}
    </>
  );
}
