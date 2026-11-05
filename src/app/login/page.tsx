import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Loading } from "@/components/common";
import { currentUser } from "@/lib/dal";
import { LoginForm } from "./LoginForm";

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <>
      <Link className="btn btn-outline btn-sm back" href="/">← Home</Link>
      <div className="auth-wrap">
        <Suspense fallback={<Loading />}>
          <Login searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}

async function Login({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  if (await currentUser()) redirect("/dashboard"); // already logged in
  const { role } = await searchParams;
  return <LoginForm initialRole={role === "Organizer" ? "Organizer" : "Player"} />;
}
