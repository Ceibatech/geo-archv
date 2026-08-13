import { AppShell } from "@/components/app-shell";
import {
  AgentReportsWorkspace,
  ExecutiveReportsWorkspace,
  SupervisorReportsWorkspace,
} from "@/components/daily-reports";
import { requirePageUser } from "@/lib/auth";
import { getAgentDailyReportPreview, listDailyReports } from "@/services/daily-report-service";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const user = await requirePageUser(["agent", "superviseur", "executif"]);
  const [reports, preview] = await Promise.all([
    listDailyReports(user),
    user.role === "agent" ? getAgentDailyReportPreview(user) : Promise.resolve(null),
  ]);

  return (
    <AppShell user={user} active="rapports" title="Rapports journaliers CG1020">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Visa et traçabilité</p>
          <h1>{user.role === "agent" ? "Mon rapport journalier" : user.role === "superviseur" ? "Validation des rapports" : "Rapports signés"}</h1>
          <p>
            {user.role === "agent"
              ? "Vérifiez votre production calculée automatiquement, signez puis transmettez-la à votre superviseur."
              : user.role === "superviseur"
                ? "Contrôlez les rapports de votre équipe. Après votre visa, le PDF final est envoyé automatiquement par e-mail."
                : "Consultez les rapports journaliers et les visas des équipes d’inventaire."}
          </p>
        </div>
      </div>

      {user.role === "agent" ? (
        <AgentReportsWorkspace preview={preview} reports={reports} agentName={`${user.firstName} ${user.lastName}`} />
      ) : user.role === "superviseur" ? (
        <SupervisorReportsWorkspace reports={reports} />
      ) : (
        <ExecutiveReportsWorkspace reports={reports} />
      )}
    </AppShell>
  );
}
