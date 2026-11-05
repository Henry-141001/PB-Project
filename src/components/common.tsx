import Link from "next/link";
import { logout } from "@/app/actions/auth";

/* Small server-rendered building blocks shared by many pages. */

export const Logo = ({ size = "md", plain = false }: { size?: "sm" | "md" | "lg" | "xl"; plain?: boolean }) => (
  <div className={`logo ${size} ${plain ? "plain" : ""}`}><span>PB+</span></div>
);

export function Topbar({ name, role, back, umpire = false }: { name: string; role: string; back?: string; umpire?: boolean }) {
  return (
    <header className="topbar">
      <div className="user">
        {back && <Link className="btn btn-ghost btn-sm" href={back}>← Back</Link>}
        <span className="hello">Hi, <b>{name}</b><span className="role"> · {role}</span></span>
        <form action={logout} className="logout-form">
          <button className="btn btn-ghost btn-sm">{umpire ? "Exit" : "Logout"}</button>
        </form>
      </div>
      <Logo size="sm" />
    </header>
  );
}

export const Loading = ({ text = "Loading…" }: { text?: string }) => (
  <div className="loading" aria-busy="true"><div className="spinner" /><span>{text}</span></div>
);

/** Shown while a signed-in page streams in */
export const TopbarSkeleton = () => (
  <header className="topbar"><div className="user"><span className="hello">Loading…</span></div><Logo size="sm" /></header>
);
