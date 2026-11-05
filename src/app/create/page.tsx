import { Suspense } from "react";
import { Loading, Topbar, TopbarSkeleton } from "@/components/common";
import { requireUser } from "@/lib/dal";
import { isTournamentType } from "@/lib/tournament";
import { CreateForm } from "./CreateForm";

export default function CreatePage({ searchParams }: PageProps<"/create">) {
  return (
    <Suspense fallback={<><TopbarSkeleton /><Loading /></>}>
      <Create searchParams={searchParams} />
    </Suspense>
  );
}

async function Create({ searchParams }: { searchParams: PageProps<"/create">["searchParams"] }) {
  const user = await requireUser("Organizer");
  const { type } = await searchParams;
  const t = isTournamentType(type) ? type : "external";
  return (
    <>
      <Topbar name={user.name} role={user.role} back={`/dashboard?tab=${t}`} />
      <CreateForm type={t} organizerName={user.name} />
    </>
  );
}
