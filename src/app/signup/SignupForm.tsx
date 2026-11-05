"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup } from "@/app/actions/auth";
import type { Role } from "@/lib/tournament";

export function SignupForm({ role }: { role: Role }) {
  const [state, action, pending] = useActionState(signup, undefined);
  const v = state?.values ?? {};
  return (
    <form action={action} autoComplete="on">
      <h2>Register as {role}</h2>
      <input type="hidden" name="role" value={role} />
      {state?.error && <p className="form-error" role="alert">{state.error}</p>}
      <div className="field"><label htmlFor="name">Full name</label><input className="input" id="name" name="name" autoComplete="name" defaultValue={v.name} required /></div>
      <div className="field"><label htmlFor="email">Email address</label><input className="input" id="email" name="email" type="email" autoComplete="email" defaultValue={v.email} required /></div>
      <div className="field"><label htmlFor="phone">Mobile number</label><input className="input" id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={v.phone} required /></div>
      <div className="field"><label htmlFor="password">Password</label><input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={6} required /></div>
      <button className="btn btn-primary btn-block" type="submit" disabled={pending}>{pending ? "Creating account…" : "Create account"}</button>
      <p className="note">Your password must be at least 6 characters. Already registered? <Link className="link" href={`/login?role=${role}`}>Login</Link></p>
    </form>
  );
}
