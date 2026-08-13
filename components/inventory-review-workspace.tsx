"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { SignaturePad } from "@/components/signature-pad";
import type { InventoryRecordReview, InventoryReviewStatus } from "@/types/domain";

const statusLabels: Record<InventoryReviewStatus, string> = {
  PENDING_SUPERVISOR: "En attente du superviseur",
  APPROVED: "Validée et signée",
  REJECTED: "Rejetée - correction demandée",
};

function displayDate(value: string | null, withTime = false) {
  if (!value) return "-";
  const date = value.includes("T") ? new Date(value) : new Date(`${value.replace(" ", "T")}Z`);
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Abidjan",
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
  }).format(date);
}

function ReviewCard({ record }: { record: InventoryRecordReview }) {
  const router = useRouter();
  const [signature, setSignature] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [comment, setComment] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function approve() {
    if (!signature || !consent || pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/inventory/${record.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureDataUrl: signature, consent, comment }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Approbation impossible.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Approbation impossible.");
      setPending(false);
    }
  }

  async function reject() {
    if (reason.trim().length < 5 || pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/inventory/${record.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Rejet impossible.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Rejet impossible.");
      setPending(false);
    }
  }

  return (
    <article className="card supervisor-report-card inventory-review-card" id={`fiche-${record.id}`}>
      <div className="supervisor-report-heading">
        <div>
          <span>Fiche #{record.id} · {displayDate(record.agentSignedAt, true)}</span>
          <h2>{record.agentName}</h2>
          <p>{record.agentCode || "Sans code"} · {record.cartonUid} · Version {record.reviewVersion}</p>
        </div>
        <span className="report-status-badge">Signature agent vérifiée</span>
      </div>
      <div className="supervisor-report-content">
        <div className="inventory-review-summary">
          <dl>
            <div><dt>Nature</dt><dd>{record.caseNature}</dd></div>
            <div><dt>Référence</dt><dd>{[record.guichetNumber, record.dduNumber, record.classificationReference].filter(Boolean).join(" / ") || "-"}</dd></div>
            <div><dt>Personne</dt><dd>{[record.lastName, record.firstNames].filter(Boolean).join(" ") || "-"}</dd></div>
            <div><dt>Commune</dt><dd>{record.commune || "-"}</dd></div>
            <div><dt>État du dossier</dt><dd>{record.dossierDamaged ? "Dégradé" : "Bon état"}</dd></div>
          </dl>
          {record.dossierDamageNote ? <div className="report-difficulties compact"><span>Dégradation</span><p>{record.dossierDamageNote}</p></div> : null}
          {record.hasDifficulty ? <div className="report-difficulties compact"><span>Difficulté signalée</span><p>{record.difficultyNote}</p></div> : null}
          <div className="agent-visa-proof">
            <span>Visa agent unique</span>
            <strong>{displayDate(record.agentSignedAt, true)}</strong>
            <small>Empreinte {record.agentSignatureSha256?.slice(0, 18)}…</small>
          </div>
        </div>
        <div className="supervisor-signature-column">
          <SignaturePad label="Nouvelle signature du superviseur" onChange={setSignature} />
          <div className="field">
            <label htmlFor={`inventory-comment-${record.id}`}>Observation facultative</label>
            <textarea id={`inventory-comment-${record.id}`} value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} />
          </div>
          <label className="signature-consent">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            <span>J’ai contrôlé cette fiche et j’appose un nouveau visa électronique pour l’approuver.</span>
          </label>
          {error ? <p className="message message-error" role="alert">{error}</p> : null}
          <button className="button button-primary button-block" type="button" onClick={approve} disabled={!signature || !consent || pending}>
            {pending ? "Traitement…" : "Signer et approuver la fiche"}
          </button>
          <details className="report-reject-panel">
            <summary>Rejeter et demander une correction</summary>
            <div className="field">
              <label htmlFor={`inventory-reason-${record.id}`}>Motif transmis à l’agent</label>
              <textarea id={`inventory-reason-${record.id}`} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} required />
            </div>
            <button className="button button-danger button-block" type="button" onClick={reject} disabled={reason.trim().length < 5 || pending}>Rejeter la fiche</button>
          </details>
        </div>
      </div>
    </article>
  );
}

export function InventoryReviewWorkspace({ records }: { records: InventoryRecordReview[] }) {
  const pending = records.filter((record) => record.reviewStatus === "PENDING_SUPERVISOR");
  const history = records.filter((record) => record.reviewStatus !== "PENDING_SUPERVISOR");
  return (
    <>
      <div className="report-queue-summary">
        <div><span>Fiches à contrôler</span><strong>{pending.length}</strong></div>
        <p>Chaque fiche possède son propre visa agent. Le superviseur doit signer pour approuver ou indiquer un motif de rejet.</p>
      </div>
      <div className="supervisor-report-list">
        {pending.length
          ? pending.map((record) => <ReviewCard record={record} key={`${record.id}:${record.reviewVersion}`} />)
          : <div className="card empty-state"><div><strong>Aucune fiche en attente</strong><p>Les nouvelles fiches signées apparaîtront ici.</p></div></div>}
      </div>
      <section className="card report-history-card">
        <div className="card-header"><h2>Historique des décisions</h2></div>
        {history.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Agent</th><th>Carton</th><th>Nature</th><th>Version</th><th>Décision</th></tr></thead>
              <tbody>{history.map((record) => (
                <tr key={record.id}>
                  <td>{displayDate(record.inventoryDate)}</td><td>{record.agentName}</td><td>{record.cartonUid}</td>
                  <td>{record.caseNature}</td><td>V{record.reviewVersion}</td>
                  <td><span className={`report-status-badge report-status-badge-${record.reviewStatus === "APPROVED" ? "approved" : "rejected"}`}>{statusLabels[record.reviewStatus]}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <div className="empty-state"><div><strong>Aucune décision enregistrée</strong></div></div>}
      </section>
    </>
  );
}
