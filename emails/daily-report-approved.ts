import type { DailyReportSummary } from "@/types/domain";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Abidjan",
    dateStyle: "long",
  }).format(new Date(`${value}T12:00:00Z`));
}

export function dailyReportApprovedEmail(report: DailyReportSummary, appUrl: string) {
  const reportUrl = `${appUrl.replace(/\/$/, "")}/rapports`;
  const metric = (label: string, value: number) => `
    <td style="width:25%;padding:18px 10px;border:1px solid #dce5ec;text-align:center;background:#f8fafc">
      <div style="font-size:10px;line-height:1.4;color:#64748b;text-transform:uppercase;font-weight:700">${label}</div>
      <div style="margin-top:8px;font-size:28px;line-height:1;color:#0a2542;font-weight:800">${value.toLocaleString("fr-FR")}</div>
    </td>`;

  return `<!doctype html>
  <html lang="fr">
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
    <body style="margin:0;padding:0;background:#edf2f6;font-family:Arial,sans-serif;color:#142335">
      <div style="display:none;max-height:0;overflow:hidden">Le rapport journalier de ${escapeHtml(report.agentName)} a été validé et signé.</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#edf2f6">
        <tr><td align="center" style="padding:32px 16px">
          <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="max-width:620px;width:100%;overflow:hidden;border:1px solid #dce5ec;border-radius:18px;background:#ffffff">
            <tr><td style="padding:28px 32px;background:#061525;color:#ffffff">
              <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#83c6e2">Archives CG1020</div>
              <h1 style="margin:10px 0 0;font-size:25px;line-height:1.25">Rapport journalier validé</h1>
              <p style="margin:8px 0 0;color:#b9c8d6;font-size:13px">${escapeHtml(formatDate(report.reportDate))} · ${escapeHtml(report.teamCode)} · ${escapeHtml(report.direction)}</p>
            </td></tr>
            <tr><td style="padding:30px 32px">
              <p style="margin:0 0 18px;font-size:15px;line-height:1.7">Bonjour,</p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.7">
                Le rapport de production de <strong>${escapeHtml(report.agentName)}</strong> a été contrôlé et signé par
                <strong>${escapeHtml(report.supervisorName)}</strong>. Le PDF final signé est joint à cet e-mail.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
                ${metric("Cartons", report.cartonsCount)}
                ${metric("Dossiers", report.dossiersCount)}
                ${metric("Cartons dégradés", report.degradedCartonsCount)}
                ${metric("Dossiers dégradés", report.degradedDossiersCount)}
              </tr></table>
              <div style="margin:24px 0;padding:16px;border-left:4px solid #14989c;background:#f1f8f8;font-size:13px;line-height:1.6">
                <strong>Traçabilité :</strong> rapport CG1020-RJ-${String(report.id).padStart(6, "0")}-V${report.version}<br>
                Visa agent : ${escapeHtml(report.agentSignatureSha256.slice(0, 16))}…<br>
                Visa superviseur : ${escapeHtml(report.supervisorSignatureSha256?.slice(0, 16) ?? "-")}…
              </div>
              <p style="margin:0;text-align:center">
                <a href="${escapeHtml(reportUrl)}" style="display:inline-block;padding:13px 22px;border-radius:10px;background:#0a2542;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700">Consulter les rapports</a>
              </p>
            </td></tr>
            <tr><td style="padding:18px 32px;border-top:1px solid #e5ebf0;background:#f8fafc;color:#718096;font-size:11px;line-height:1.6">
              Message automatique de la plateforme CEIBA Analytics. Le document joint constitue le rapport interne validé du workflow CG1020.
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
  </html>`;
}
