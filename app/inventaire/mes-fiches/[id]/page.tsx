import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { InventoryCorrectionForm } from "@/components/inventory-correction-form";
import { requirePageUser } from "@/lib/auth";
import { getInventoryRecordById } from "@/services/inventory-service";
import { getAgentInventoryTeam } from "@/services/team-service";

export const dynamic = "force-dynamic";

export default async function CorrectInventoryRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser(["agent"]);
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) redirect("/inventaire/mes-fiches");
  const [record, team] = await Promise.all([
    getInventoryRecordById(id, user),
    getAgentInventoryTeam(user.id),
  ]);
  if (record.reviewStatus !== "REJECTED") redirect("/inventaire/mes-fiches");
  return (
    <AppShell user={user} active="fiches" title="Correction d’une fiche rejetée">
      <div className="page-heading"><div><p className="eyebrow">Correction et nouveau visa</p><h1>Corriger la fiche #{record.id}</h1><p>Appliquez le motif du superviseur, puis tracez une nouvelle signature pour renvoyer la fiche.</p></div></div>
      <InventoryCorrectionForm record={record} direction={team?.direction ?? null} />
    </AppShell>
  );
}
