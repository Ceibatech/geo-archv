import Link from "next/link";

import { AdminDashboard } from "@/components/admin-dashboard";
import { AppShell } from "@/components/app-shell";
import { SessionOverview } from "@/components/session-overview";
import { requirePageUser } from "@/lib/auth";
import { getAdminDashboardData } from "@/services/admin-dashboard-service";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const user = await requirePageUser(["admin"]);
  const data = await getAdminDashboardData();

  return (
    <AppShell user={user} active="dashboard" title="Centre d’administration CG1020">
      <div className="page-heading admin-page-heading">
        <div>
          <p className="eyebrow">Centre de contrôle</p>
          <h1>Tableau de bord administrateur</h1>
          <p>Supervisez les comptes, les affectations et la disponibilité des envois Resend depuis un seul écran.</p>
        </div>
        <Link className="button button-primary" href="/admin/utilisateurs">+ Nouveau compte</Link>
      </div>
      <SessionOverview user={user} />
      <AdminDashboard data={data} />
    </AppShell>
  );
}
