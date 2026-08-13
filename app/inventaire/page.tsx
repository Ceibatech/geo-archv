import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { InventoryForm } from "@/components/inventory-form";
import { requirePageUser } from "@/lib/auth";
import { getCurrentCarton } from "@/services/carton-service";
import { listInventoryRecords } from "@/services/inventory-service";
import { getAgentInventoryTeam } from "@/services/team-service";

export const dynamic = "force-dynamic";

function displayDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00Z`));
}

export default async function InventoryHomePage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const user = await requirePageUser(["agent"]);
  const [currentCarton, recentRecords, inventoryTeam, query] = await Promise.all([
    getCurrentCarton(user.id),
    listInventoryRecords({ page: 1, pageSize: 5 }, user),
    getAgentInventoryTeam(user.id),
    searchParams,
  ]);

  const successMessage =
    query.success === "carton-termine"
      ? "Le carton a été terminé avec succès."
      : query.success === "dossier"
        ? "Le dossier a été enregistré avec succès."
        : "";
  const formCarton = currentCarton
    ? {
        id: currentCarton.id,
        cartonUid: currentCarton.cartonUid,
        libelle: currentCarton.libelle,
        barcode: currentCarton.barcode,
        dossierCount: currentCarton.dossierCount,
      }
    : null;

  return (
    <AppShell user={user} active="inventaire" title="Inventaire CG1020">
      <div className="page-heading inventory-page-heading">
        <div>
          <p className="eyebrow">Questionnaire d’inventaire</p>
          <h1>Nouvelle fiche</h1>
          <p>Répondez étape par étape. Le carton, l’opérateur et le stockage sont gérés automatiquement.</p>
        </div>
      </div>

      {successMessage && <p className="message message-success" style={{ marginBottom: 20 }}>{successMessage}</p>}

      {inventoryTeam ? (
        <section className="inventory-team-context" aria-label="Affectation de l’inventaire">
          <div><span>Code équipe</span><strong>{inventoryTeam.code}</strong></div>
          <div><span>Direction</span><strong>{inventoryTeam.direction}</strong></div>
          <div><span>Superviseur</span><strong>{inventoryTeam.supervisorName}</strong></div>
        </section>
      ) : (
        <p className="message message-warning inventory-team-warning">
          Aucune équipe n’est encore affectée à ce compte. L’administrateur doit définir le code équipe et la direction dans « Équipes et accès ».
        </p>
      )}

      {user.agentCode ? (
        <InventoryForm key={formCarton?.id ?? "nouveau-carton"} carton={formCarton} operator={user} />
      ) : (
        <p className="message message-error">Un code agent doit être attribué à votre compte avant la saisie.</p>
      )}

      <section className="card recent-records-card">
        <div className="card-header">
          <h2>Mes dernières fiches</h2>
          <Link className="button button-secondary" href="/inventaire/mes-fiches">Voir toutes les fiches</Link>
        </div>
        {recentRecords.data.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Carton</th><th>Nature</th><th>Personne</th><th>Commune</th><th>État</th></tr></thead>
              <tbody>
                {recentRecords.data.map((record) => (
                  <tr key={record.id}>
                    <td>{displayDate(record.inventoryDate)}</td>
                    <td className="primary-cell">{record.cartonUid}</td>
                    <td>{record.caseNature}</td>
                    <td>{[record.lastName, record.firstNames].filter(Boolean).join(" ") || "—"}</td>
                    <td>{record.commune || "—"}</td>
                    <td><span className={`badge ${record.dossierDamaged ? "badge-warning" : "badge-active"}`}>{record.dossierDamaged ? "Dégradé" : "Bon état"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state"><div><strong>Aucune fiche enregistrée</strong><p>Les dossiers saisis apparaîtront ici.</p></div></div>
        )}
      </section>
    </AppShell>
  );
}
