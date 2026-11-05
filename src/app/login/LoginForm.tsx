"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { demoLogin, login, umpireLogin } from "@/app/actions/auth";
import { Logo } from "@/components/common";
import { CourtIcon, PaddlesIcon } from "@/components/icons";
import { Modal } from "@/components/ui";
import type { Role } from "@/lib/tournament";

export function LoginForm({ initialRole, demo }: { initialRole: Role; demo: boolean }) {
  const [role, setRole] = useState<Role>(initialRole);
  const [state, action, pending] = useActionState(login, undefined);
  const [demoError, setDemoError] = useState("");
  const [demoPending, startDemo] = useTransition();
  const [umpireOpen, setUmpireOpen] = useState(false);

  const tryDemo = () => startDemo(async () => {
    const r = await demoLogin(role);
    if (r?.error) setDemoError(r.error);
  });

  return (
    <>
      <form className="login-card" action={action} autoComplete="on">
        <Logo size="xl" />
        <div className="seg" role="radiogroup" aria-label="Log in as">
          {(["Player", "Organizer"] as const).map((r) => (
            <button key={r} type="button" role="radio" aria-checked={role === r} className={role === r ? "active" : ""} onClick={() => setRole(r)}>
              {r === "Player" ? <PaddlesIcon /> : <CourtIcon />} {r}
            </button>
          ))}
        </div>
        <input type="hidden" name="role" value={role} />
        {(state?.error || demoError) && <p className="form-error" role="alert">{state?.error || demoError}</p>}
        <input className="input" name="phone" type="tel" placeholder="NUMBER PHONE" aria-label="Phone number" autoComplete="tel" defaultValue={state?.values?.phone} required />
        <input className="input" name="password" type="password" placeholder="PASSWORD" aria-label="Password" autoComplete="current-password" required />
        <div className="row">
          {demo ? <button type="button" className="link" onClick={tryDemo} disabled={demoPending}>{demoPending ? "Opening demo…" : "Try demo"}</button> : <span />}
          <button className="btn btn-login" type="submit" disabled={pending}>{pending ? "…" : "LOGIN"}</button>
        </div>
        <div className="row" style={{ justifyContent: "center", marginTop: 14 }}>
          <Link className="link" href="/role">No account? Register</Link>
        </div>
        <div className="row umpire-row">
          <button type="button" className="link" onClick={() => setUmpireOpen(true)}>Umpire? Enter match code</button>
        </div>
      </form>
      {umpireOpen && <UmpireModal onClose={() => setUmpireOpen(false)} />}
    </>
  );
}

function UmpireModal({ onClose }: { onClose: () => void }) {
  const [state, action, pending] = useActionState(umpireLogin, undefined);
  return (
    <Modal onClose={onClose}>
      <h3>Umpire entry</h3>
      <p className="hint" style={{ marginBottom: 12 }}>Type the match code the organizer gave you. You can only score that match. No account needed.</p>
      <form action={action}>
        <input className="input code-input" name="code" maxLength={6} placeholder="MATCH CODE" aria-label="Match code" autoFocus required />
        {state?.error && <p className="form-error" role="alert">{state.error}</p>}
        <div className="actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" disabled={pending}>{pending ? "Checking…" : "Open scoreboard"}</button>
        </div>
      </form>
    </Modal>
  );
}
