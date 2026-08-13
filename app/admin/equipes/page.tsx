import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { TeamAdmin } from "@/components/team-admin";
import { requirePageUser } from "@/lib/auth";
import { listTeams } from "@/services/team-service";
import { listUsers } from "@/services/user-service";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const user = await requirePageUser(["admin"]);
  const [teams, users] = await Promise.all([listTeams(), listUsers()]);
  const supervisors = users.filter((item) => item.role === "superviseur" && item.isActive);
  const agents = users.filter((item) => item.role === "agent" && item.isActive);

  return (
    <AppShell user={user} active="equipes" title="Administration des équipes">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Organisation des accès</p>
          <h1>Équipes et superviseurs</h1>
          <p>Définissez le code équipe, la direction d’inventaire, le superviseur responsable et les agents affectés.</p>
        </div>
        <Link className="button button-secondary" href="/admin/utilisateurs">+ Créer un compte</Link>
      </div>
      <TeamAdmin initialTeams={teams} supervisors={supervisors} agents={agents} />
    </AppShell>
  );
}
