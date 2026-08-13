import { AppShell } from "@/components/app-shell";
import { UserAdmin } from "@/components/user-admin";
import { requirePageUser } from "@/lib/auth";
import { listTeams } from "@/services/team-service";
import { listUsers } from "@/services/user-service";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const user = await requirePageUser(["admin"]);
  const [users, teams] = await Promise.all([listUsers(), listTeams()]);
  const teamAssignments = teams.flatMap((team) => [
    {
      userId: team.supervisorUserId,
      teamCode: team.code,
      teamName: team.name,
      direction: team.direction,
      relation: "superviseur" as const,
    },
    ...team.members.map((member) => ({
      userId: member.userId,
      teamCode: team.code,
      teamName: team.name,
      direction: team.direction,
      relation: "agent" as const,
    })),
  ]);

  return (
    <AppShell user={user} active="utilisateurs" title="Administration des utilisateurs">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>Utilisateurs et rôles</h1>
          <p>Créez les comptes, attribuez les rôles puis rattachez agents et superviseurs à leur direction.</p>
        </div>
      </div>
      <UserAdmin
        initialUsers={users.map((account) => ({
          id: account.id,
          firstName: account.firstName,
          lastName: account.lastName,
          email: account.email,
          login: account.login,
          agentCode: account.agentCode,
          role: account.role,
          isActive: account.isActive,
        }))}
        teamAssignments={teamAssignments}
      />
    </AppShell>
  );
}
