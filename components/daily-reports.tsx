"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { SignaturePad } from "@/components/signature-pad";
import type { DailyReportPreview, DailyReportStatus, DailyReportSummary } from "@/types/domain";

const statusLabels: Record<DailyReportStatus, string> = {
  PENDING_SUPERVISOR: "En attente du superviseur",
  APPROVED: "Validé et signé",
  REJECTED: "À corriger",
};

function displayDate(value: string, withTime = false) {
  const iso = value.includes(" ")
    ? `${value.replace(" ", "T")}Z`
    : value.includes("T")
      ? value.endsWith("Z") ? value : `${value}Z`
      : `${value}T12:00:00Z`;
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Abidjan",
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
  }).format(new Date(iso));
}

function ReportMetrics({
  values,
}: {
  values: Pick<DailyReportPreview, "cartonsCount" | "dossiersCount" | "degradedCartonsCount" | "degradedDossiersCount">;
}) {
  const items = [
    ["Cartons", values.cartonsCount, "blue"],
    ["Dossiers", values.dossiersCount, "green"],
    ["Cartons dégradés", values.degradedCartonsCount, "amber"],
    ["Dossiers dégradés", values.degradedDossiersCount, "red"],
  ] as const;
  return (
    <div className="report-metrics">
      {items.map(([label, value, tone]) => (
        <div className={`report-metric report-metric-${tone}`} key={label}>
          <span>{label}</span>
          <strong>{value.toLocaleString("fr-FR")}</strong>
        </div>
      ))}
    </div>
  );
}

function WorkflowSteps({ status }: { status?: DailyReportStatus }) {
  const current = !status || status === "REJECTED" ? 1 : status === "PENDING_SUPERVISOR" ? 2 : 3;
  const steps = [
    [1, "Visa agent", "Instantané de la journée"],
    [2, "Contrôle superviseur", "Vérification et décision"],
    [3, "PDF et e-mail", "Document final transmis"],
  ] as const;
  return (
    <ol className="report-workflow" aria-label="Étapes du rapport">
      {steps.map(([number, title, subtitle]) => (
        <li className={number < current ? "workflow-step workflow-step-done" : number === current ? "workflow-step workflow-step-current" : "workflow-step"} key={number}>
          <span>{number < current ? "✓" : number}</span>
          <div><strong>{title}</strong><small>{subtitle}</small></div>
        </li>
      ))}
    </ol>
  );
}

function ReportStatus({ report }: { report: DailyReportSummary }) {
  return (
    <div className={`report-status report-status-${report.status.toLowerCase()}`}>
      <div>
        <span>État du rapport</span>
        <strong>{statusLabels[report.status]}</strong>
      </div>
      <small>Version {report.version} · signé par l’agent le {displayDate(report.agentSignedAt, true)}</small>
    </div>
  );
}

function ReportsTable({ reports, showAgent = false }: { reports: DailyReportSummary[]; showAgent?: boolean }) {
  if (!reports.length) return null;
  return (
    <section className="card report-history-card">
      <div className="card-header"><div><h2>Historique des rapports</h2><span className="field-hint">Documents horodatés et conservés dans la plateforme.</span></div></div>
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Date</th>{showAgent ? <th>Agent</th> : null}<th>Équipe</th><th>Dossiers</th><th>État</th><th>E-mail</th><th>Document</th></tr></thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report.id}>
                <td className="primary-cell">{displayDate(report.reportDate)}</td>
                {showAgent ? <td><span className="primary-cell">{report.agentName}</span><br /><span className="field-hint">{report.agentCode || "Sans code"}</span></td> : null}
                <td>{report.teamCode} · {report.direction}</td>
                <td className="primary-cell">{report.dossiersCount}</td>
                <td><span className={`report-status-badge report-status-badge-${report.status.toLowerCase()}`}>{statusLabels[report.status]}</span></td>
                <td>{report.emailStatus === "SENT" ? "Envoyé" : report.emailStatus === "FAILED" ? "Échec" : "—"}</td>
                <td><a className="button button-secondary button-compact" href={`/api/reports/daily/${report.id}/pdf`}>PDF</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function AgentReportsWorkspace({
  preview,
  reports,
  agentName,
}: {
  preview: DailyReportPreview | null;
  reports: DailyReportSummary[];
  agentName: string;
}) {
  const router = useRouter();
  const [signature, setSignature] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const current = preview ? reports.find((report) => report.reportDate === preview.reportDate) : undefined;
  const canSign = preview && (!current || current.status === "REJECTED");

  async function signReport() {
    if (!signature || !consent || pending) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/reports/daily/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureDataUrl: signature, consent }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Signature impossible.");
      setMessage("Rapport signé. Il est maintenant transmis à votre superviseur.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Signature impossible.");
      setPending(false);
    }
  }

  if (!preview) {
    return <p className="message message-warning">Votre compte doit être affecté à une équipe avec un superviseur avant de créer le rapport journalier.</p>;
  }

  return (
    <>
      <WorkflowSteps status={current?.status} />
      {current ? <ReportStatus report={current} /> : null}
      {current?.status === "REJECTED" ? <p className="message message-error report-alert"><strong>Correction demandée :</strong> {current.rejectionReason}</p> : null}
      {message ? <p className="message message-success report-alert" role="status">{message}</p> : null}
      {error ? <p className="message message-error report-alert" role="alert">{error}</p> : null}

      <section className="card report-sheet-card">
        <div className="report-sheet-header">
          <div><span>Fiche individuelle journalière</span><h2>{displayDate(preview.reportDate)}</h2></div>
          <div><span>Équipe et direction</span><strong>{preview.teamCode} · {preview.direction}</strong><small>{preview.teamName}</small></div>
        </div>
        <div className="report-operator"><span>Opérateur</span><strong>{agentName}</strong><small>Superviseur : {preview.supervisorName}</small></div>
        <ReportMetrics values={preview} />
        <div className="report-difficulties">
          <span>Difficultés majeures rencontrées</span>
          <p>{preview.majorDifficulties || "Aucune difficulté majeure signalée aujourd’hui."}</p>
        </div>
      </section>

      {canSign ? (
        <section className="card report-sign-card">
          <div className="card-header"><div><h2>Visa électronique de l’agent</h2><span className="field-hint">Votre compte, la date, l’heure et l’empreinte de la signature seront conservés.</span></div></div>
          <div className="card-body report-sign-body">
            <SignaturePad label="Signature de l’opérateur" onChange={setSignature} />
            <label className="signature-consent">
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
              <span>Je confirme que les chiffres ci-dessus correspondent à ma production de la journée et j’appose mon visa électronique interne.</span>
            </label>
            <button className="button button-primary button-block" type="button" onClick={signReport} disabled={!signature || !consent || pending}>
              {pending ? "Transmission…" : current?.status === "REJECTED" ? "Signer et renvoyer au superviseur" : "Signer et transmettre au superviseur"}
            </button>
          </div>
        </section>
      ) : current ? (
        <div className="report-locked-actions">
          <p>{current.status === "APPROVED" ? "Le rapport final est disponible et ne peut plus être modifié." : "Le rapport est verrouillé pendant le contrôle du superviseur."}</p>
          <a className="button button-secondary" href={`/api/reports/daily/${current.id}/pdf`}>Télécharger le PDF {current.status === "APPROVED" ? "final" : "provisoire"}</a>
        </div>
      ) : null}

      <ReportsTable reports={reports} />
    </>
  );
}

function SupervisorApprovalCard({ report }: { report: DailyReportSummary }) {
  const router = useRouter();
  const [signature, setSignature] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [comment, setComment] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function approve() {
    if (!signature || !consent || pending) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/reports/daily/${report.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureDataUrl: signature, consent, comment }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Validation impossible.");
      setMessage(payload.email?.sent
        ? "Rapport validé. Le PDF signé a été envoyé à l’agent et au superviseur."
        : `Rapport validé, mais l’e-mail n’a pas pu partir : ${payload.email?.error || "configuration Resend incomplète"}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Validation impossible.");
      setPending(false);
    }
  }

  async function reject() {
    if (reason.trim().length < 5 || pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/reports/daily/${report.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Retour impossible.");
      setMessage("Le rapport a été retourné à l’agent avec votre motif.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Retour impossible.");
      setPending(false);
    }
  }

  return (
    <article className="card supervisor-report-card">
      <div className="supervisor-report-heading">
        <div><span>À contrôler · {displayDate(report.reportDate)}</span><h2>{report.agentName}</h2><p>{report.agentCode || "Sans code"} · {report.teamCode} · {report.direction}</p></div>
        <a className="button button-secondary" href={`/api/reports/daily/${report.id}/pdf`}>Voir le PDF provisoire</a>
      </div>
      <div className="supervisor-report-content">
        <div>
          <ReportMetrics values={report} />
          <div className="report-difficulties compact"><span>Difficultés signalées</span><p>{report.majorDifficulties || "Aucune difficulté majeure."}</p></div>
          <div className="agent-visa-proof"><span>Visa agent vérifié</span><strong>{displayDate(report.agentSignedAt, true)}</strong><small>Empreinte {report.agentSignatureSha256.slice(0, 16)}…</small></div>
        </div>
        <div className="supervisor-signature-column">
          <SignaturePad label="Visa du superviseur" onChange={setSignature} />
          <div className="field"><label htmlFor={`comment-${report.id}`}>Observation facultative</label><textarea id={`comment-${report.id}`} value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} /></div>
          <label className="signature-consent">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            <span>J’ai contrôlé ces données et je valide ce rapport par mon visa électronique interne.</span>
          </label>
          {message ? <p className="message message-success" role="status">{message}</p> : null}
          {error ? <p className="message message-error" role="alert">{error}</p> : null}
          <button className="button button-primary button-block" type="button" onClick={approve} disabled={!signature || !consent || pending}>
            {pending ? "Traitement…" : "Valider, signer et envoyer le PDF"}
          </button>
          <details className="report-reject-panel">
            <summary>Demander une correction</summary>
            <div className="field"><label htmlFor={`reason-${report.id}`}>Motif à transmettre à l’agent</label><textarea id={`reason-${report.id}`} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} required /></div>
            <button className="button button-danger button-block" type="button" onClick={reject} disabled={reason.trim().length < 5 || pending}>Retourner à l’agent</button>
          </details>
        </div>
      </div>
    </article>
  );
}

function EmailRetryButton({ reportId }: { reportId: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function retry() {
    setPending(true);
    setError("");
    const response = await fetch(`/api/reports/daily/${reportId}/email`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error?.message || payload.data?.error || "Envoi impossible.");
      setPending(false);
      return;
    }
    router.refresh();
  }
  return <div>{error ? <p className="field-hint report-email-error">{error}</p> : null}<button className="button button-secondary button-compact" type="button" onClick={retry} disabled={pending}>{pending ? "Envoi…" : "Renvoyer l’e-mail"}</button></div>;
}

export function SupervisorReportsWorkspace({ reports }: { reports: DailyReportSummary[] }) {
  const pendingReports = reports.filter((report) => report.status === "PENDING_SUPERVISOR");
  const completedReports = reports.filter((report) => report.status !== "PENDING_SUPERVISOR");
  const failedEmails = completedReports.filter((report) => report.status === "APPROVED" && report.emailStatus === "FAILED");
  return (
    <>
      <WorkflowSteps status={pendingReports.length ? "PENDING_SUPERVISOR" : "APPROVED"} />
      <div className="report-queue-summary"><div><span>Rapports à contrôler</span><strong>{pendingReports.length}</strong></div><p>Vérifiez les indicateurs, signez, puis le PDF final sera envoyé automatiquement aux deux comptes.</p></div>
      {failedEmails.map((report) => (
        <div className="message message-warning report-email-retry" key={report.id}>
          <div><strong>E-mail non envoyé pour {report.agentName}</strong><p>{report.emailError || "Vérifiez la configuration Resend."}</p></div>
          <EmailRetryButton reportId={report.id} />
        </div>
      ))}
      <div className="supervisor-report-list">
        {pendingReports.length ? pendingReports.map((report) => <SupervisorApprovalCard report={report} key={report.id} />) : <div className="card empty-state"><div><strong>Aucun rapport en attente</strong><p>Les rapports signés par vos agents apparaîtront ici.</p></div></div>}
      </div>
      <ReportsTable reports={completedReports} showAgent />
    </>
  );
}

export function ExecutiveReportsWorkspace({ reports }: { reports: DailyReportSummary[] }) {
  return (
    <>
      <div className="report-queue-summary"><div><span>Rapports validés</span><strong>{reports.filter((report) => report.status === "APPROVED").length}</strong></div><p>Vue en lecture seule sur les rapports journaliers de toutes les directions.</p></div>
      <ReportsTable reports={reports} showAgent />
    </>
  );
}
