import Link from "next/link";

import type { InventoryRecordReview } from "@/types/domain";

function displayDate(value: string | null) {
  if (!value) return "—";
  const date = value.includes("T") ? new Date(value) : new Date(`${value.replace(" ", "T")}Z`);
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Abidjan",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function SupervisorPendingInventory({ records, total }: { records: InventoryRecordReview[]; total: number }) {
  const remaining = Math.max(0, total - records.length);

  return (
    <section className="card supervisor-dashboard-queue" aria-labelledby="supervisor-pending-title">
      <div className="supervisor-dashboard-queue-heading">
        <div>
          <span className="eyebrow">Action requise</span>
          <h2 id="supervisor-pending-title">
            Fiches à signer <strong>{total}</strong>
          </h2>
          <p>Ces fiches ont été signées par vos agents et attendent votre approbation ou votre rejet.</p>
        </div>
        <Link className="button button-primary" href="/supervision/fiches">
          Ouvrir toutes les fiches
        </Link>
      </div>

      {records.length ? (
        <div className="table-wrap">
          <table className="data-table supervisor-dashboard-queue-table">
            <thead>
              <tr><th>Signature agent</th><th>Agent</th><th>Carton</th><th>Nature</th><th>Commune</th><th>Action</th></tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={`${record.id}:${record.reviewVersion}`}>
                  <td>{displayDate(record.agentSignedAt)}</td>
                  <td><span className="primary-cell">{record.agentName}</span><br /><span className="field-hint">{record.agentCode || "Sans code"}</span></td>
                  <td>{record.cartonUid}</td>
                  <td>{record.caseNature}</td>
                  <td>{record.commune || "—"}</td>
                  <td>
                    <Link className="button button-secondary button-compact" href={`/supervision/fiches#fiche-${record.id}`}>
                      Signer / contrôler
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="supervisor-dashboard-queue-empty">
          <span aria-hidden="true">✓</span>
          <div><strong>Aucune fiche en attente</strong><p>Toutes les fiches reçues ont été traitées.</p></div>
        </div>
      )}

      {remaining ? (
        <p className="supervisor-dashboard-queue-more">
          + {remaining} autre{remaining > 1 ? "s" : ""} fiche{remaining > 1 ? "s" : ""} à traiter dans l’espace de validation.
        </p>
      ) : null}
    </section>
  );
}
