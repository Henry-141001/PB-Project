import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/common";
import { SignupForm } from "./SignupForm";

export default function SignupPage({ searchParams }: PageProps<"/signup">) {
  return (
    <>
      <Link className="btn btn-outline btn-sm back" href="/role">← Back</Link>
      <div className="auth-wrap">
        <div className="signup">
          <div className="brand-card">
            <Logo size="xl" />
            <p>Play the game .<br />Create the <i>Throne</i></p>
          </div>
          <Suspense fallback={<div />}>
            <RoleForm searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </>
  );
}

async function RoleForm({ searchParams }: { searchParams: PageProps<"/signup">["searchParams"] }) {
  const { role } = await searchParams;
  return <SignupForm role={role === "Organizer" ? "Organizer" : "Player"} />;
}
