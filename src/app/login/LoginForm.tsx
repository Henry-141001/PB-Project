"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { login, umpireLogin } from "@/app/actions/auth";
import { Logo } from "@/components/common";
import { CourtIcon, PaddlesIcon } from "@/components/icons";
import { Modal } from "@/components/ui";
import type { Role } from "@/lib/tournament";

export function LoginForm({ initialRole }: { initialRole: Role }) {
  const [role, setRole] = useState<Role>(initialRole);
  const [state, action, pending] = useActionState(login, undefined);
  const [umpireOpen, setUmpireOpen] = useState(false);

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
        {state?.error && <p className="form-error" role="alert">{state.error}</p>}
        <input className="input" name="phone" type="tel" placeholder="NUMBER PHONE" aria-label="Phone number" autoComplete="tel" defaultValue={state?.values?.phone} required />
        <input className="input" name="password" type="password" placeholder="PASSWORD" aria-label="Password" autoComplete="current-password" required />
        <div className="row" style={{ justifyContent: "center" }}>
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
