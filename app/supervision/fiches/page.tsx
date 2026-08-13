import { AppShell } from "@/components/app-shell";
import { InventoryReviewWorkspace } from "@/components/inventory-review-workspace";
import { requirePageUser } from "@/lib/auth";
import { listInventoryReviews } from "@/services/inventory-service";

export const dynamic = "force-dynamic";

export default async function InventoryReviewPage() {
  const user = await requirePageUser(["superviseur"]);
  const records = await listInventoryReviews(user);
  return (
    <AppShell user={user} active="fiches" title="Validation des fiches d’inventaire">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Contrôle et double visa</p>
          <h1>Fiches à valider</h1>
          <p>Chaque fiche signée par un agent attend une décision explicite de son superviseur.</p>
        </div>
      </div>
      <InventoryReviewWorkspace records={records} />
    </AppShell>
  );
}
