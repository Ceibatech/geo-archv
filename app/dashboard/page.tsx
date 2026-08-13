import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { DashboardView } from "@/components/dashboard-view";
import { SessionOverview } from "@/components/session-overview";
import { SupervisorPendingInventory } from "@/components/supervisor-pending-inventory";
import { requirePageUser } from "@/lib/auth";
import { dashboardQuerySchema } from "@/lib/validation";
import { getDashboardData } from "@/services/dashboard-service";
import { getPendingInventoryReviewSummary } from "@/services/inventory-service";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await requirePageUser(["agent", "superviseur", "executif"]);
  const query = dashboardQuerySchema.parse(await searchParams);
  const [data, pendingInventory] = await Promise.all([
    getDashboardData(user, query.period),
    user.role === "superviseur"
      ? getPendingInventoryReviewSummary(user)
      : Promise.resolve({ records: [], total: 0 }),
  ]);

  return (
    <AppShell user={user} active="dashboard" title="Tableau de bord CG1020">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Pilotage de l’inventaire</p>
          <h1>{data.title}</h1>
          <p>{data.description}</p>
        </div>
        {user.role === "agent" ? (
          <Link className="button button-primary" href="/inventaire">+ Nouvelle fiche</Link>
        ) : null}
      </div>
      <SessionOverview user={user} />
      {user.role === "superviseur" ? (
        <SupervisorPendingInventory records={pendingInventory.records} total={pendingInventory.total} />
      ) : null}
      <DashboardView data={data} role={user.role} />
    </AppShell>
  );
}
