import type { DailyReportSummary } from "@/types/domain";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function dateValue(value: string, dateOnly = false) {
  if (dateOnly) return new Date(`${value}T12:00:00Z`);
  if (value.includes("T")) return new Date(value.endsWith("Z") ? value : `${value}Z`);
  return new Date(`${value.replace(" ", "T")}Z`);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Abidjan",
    dateStyle: "long",
  }).format(dateValue(value, true));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Abidjan",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(dateValue(value));
}

function multiline(value: string) {
  return escapeHtml(value).replaceAll("\n", "<br>");
}

function metric(label: string, value: number, tone: "navy" | "green" | "gold" = "navy") {
  const accent = tone === "green" ? "#087f5b" : tone === "gold" ? "#b7791f" : "#123b67";
  const background = tone === "green" ? "#f0faf5" : tone === "gold" ? "#fffaf0" : "#f4f7fb";
  return `
    <td class="metric-cell" width="50%" style="width:50%;padding:6px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #dfe7ee;background:${background}">
        <tr>
          <td style="padding:17px 18px 15px">
            <div style="font-size:10px;line-height:1.4;letter-spacing:.9px;color:#66788a;text-transform:uppercase;font-weight:700">${label}</div>
            <div style="margin-top:7px;font-size:27px;line-height:1;color:${accent};font-weight:800">${value.toLocaleString("fr-FR")}</div>
          </td>
        </tr>
      </table>
    </td>`;
}

function identity(label: string, value: string, detail?: string) {
  return `
    <td class="identity-cell" width="50%" valign="top" style="width:50%;padding:0 12px 0 0">
      <div style="font-size:10px;line-height:1.4;letter-spacing:.8px;color:#718096;text-transform:uppercase;font-weight:700">${label}</div>
      <div style="margin-top:5px;font-size:15px;line-height:1.45;color:#102a43;font-weight:700">${escapeHtml(value)}</div>
      ${detail ? `<div style="margin-top:2px;font-size:12px;line-height:1.5;color:#66788a">${escapeHtml(detail)}</div>` : ""}
    </td>`;
}

export function dailyReportApprovedEmail(report: DailyReportSummary, appUrl: string) {
  const baseUrl = appUrl.replace(/\/$/, "");
  const reportUrl = `${baseUrl}/rapports`;
  const logoUrl = `${baseUrl}/ceibac.jpg`;
  const reference = `CG1020-RJ-${String(report.id).padStart(6, "0")}-V${report.version}`;
  const difficulties = report.majorDifficulties || "Aucune difficulté majeure signalée pour cette journée.";
  const supervisorComment = report.supervisorComment?.trim();

  return `<!doctype html>
  <html lang="fr">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <meta name="color-scheme" content="light">
      <title>Rapport journalier approuvé</title>
      <style>
        @media only screen and (max-width:620px) {
          .email-shell { padding:18px 8px !important; }
          .email-body, .email-header, .email-footer { padding-left:20px !important; padding-right:20px !important; }
          .metric-cell, .identity-cell { display:block !important; width:100% !important; box-sizing:border-box !important; padding:6px 0 !important; }
          .brand-copy { padding-left:14px !important; }
          .status-cell { display:block !important; width:100% !important; text-align:left !important; padding-top:18px !important; }
          .attachment-copy, .attachment-action { display:block !important; width:100% !important; box-sizing:border-box !important; text-align:left !important; }
          .attachment-action { padding-top:14px !important; }
          .cta { display:block !important; text-align:center !important; }
        }
      </style>
    </head>
    <body style="margin:0;padding:0;background:#edf2f6;font-family:Arial,Helvetica,sans-serif;color:#102a43">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">
        Le rapport ${escapeHtml(reference)} de ${escapeHtml(report.agentName)} a été contrôlé, signé et approuvé.
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:#edf2f6">
        <tr>
          <td class="email-shell" align="center" style="padding:34px 16px">
            <table role="presentation" width="680" cellspacing="0" cellpadding="0" style="width:100%;max-width:680px;border:1px solid #d9e3ea;background:#ffffff">
              <tr><td style="height:6px;background:#07966f;font-size:0;line-height:0">&nbsp;</td></tr>
              <tr>
                <td class="email-header" style="padding:26px 32px;background:#071c33;color:#ffffff">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td width="118" valign="middle" style="width:118px">
                        <div style="padding:8px;background:#ffffff;text-align:center">
                          <img src="${escapeHtml(logoUrl)}" width="102" alt="CEIBA Analytics" style="display:block;width:102px;max-width:100%;height:auto;border:0">
                        </div>
                      </td>
                      <td class="brand-copy" valign="middle" style="padding-left:20px">
                        <div style="font-size:10px;line-height:1.4;letter-spacing:1.5px;color:#83d1ba;text-transform:uppercase;font-weight:700">Plateforme sécurisée des archives</div>
                        <div style="margin-top:6px;font-size:20px;line-height:1.25;color:#ffffff;font-weight:800">Programme CG1020</div>
                        <div style="margin-top:3px;font-size:11px;line-height:1.45;color:#b8c8d8">Inventaire, contrôle et traçabilité documentaire</div>
                      </td>
                      <td class="status-cell" width="145" align="right" valign="middle" style="width:145px">
                        <span style="display:inline-block;padding:9px 12px;border:1px solid #3ab58e;background:#0b654e;color:#ffffff;font-size:10px;line-height:1;letter-spacing:.8px;text-transform:uppercase;font-weight:800">Approuvé</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td class="email-body" style="padding:34px 32px 32px">
                  <div style="font-size:11px;line-height:1.4;letter-spacing:1px;color:#087f5b;text-transform:uppercase;font-weight:800">Rapport journalier certifié</div>
                  <h1 style="margin:8px 0 0;font-size:27px;line-height:1.25;color:#071c33;font-weight:800">Validation finalisée avec succès</h1>
                  <p style="margin:14px 0 0;font-size:14px;line-height:1.75;color:#486581">
                    Bonjour,<br>
                    le rapport de production du <strong style="color:#102a43">${escapeHtml(formatDate(report.reportDate))}</strong> a été contrôlé par le superviseur et officiellement validé. L’agent et le superviseur reçoivent simultanément cette confirmation ainsi que le PDF signé en pièce jointe.
                  </p>

                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:25px;border-top:1px solid #dfe7ee;border-bottom:1px solid #dfe7ee">
                    <tr>
                      <td style="padding:18px 0">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
                          ${identity("Opérateur", report.agentName, report.agentCode ? `Matricule ${report.agentCode}` : undefined)}
                          ${identity("Superviseur validateur", report.supervisorName, `Validé le ${formatDateTime(report.supervisorSignedAt ?? report.reportDate)}`)}
                        </tr></table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:0 0 18px">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
                          ${identity("Équipe", `${report.teamCode} · ${report.teamName}`)}
                          ${identity("Direction", report.direction, `Référence ${reference}`)}
                        </tr></table>
                      </td>
                    </tr>
                  </table>

                  <div style="margin-top:24px;font-size:11px;line-height:1.4;letter-spacing:.9px;color:#52677b;text-transform:uppercase;font-weight:800">Synthèse de la production</div>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:6px -6px 0;width:calc(100% + 12px)">
                    <tr>
                      ${metric("Cartons inventoriés", report.cartonsCount)}
                      ${metric("Dossiers traités", report.dossiersCount)}
                    </tr>
                    <tr>
                      ${metric("Cartons dégradés", report.degradedCartonsCount, report.degradedCartonsCount > 0 ? "gold" : "green")}
                      ${metric("Dossiers dégradés", report.degradedDossiersCount, report.degradedDossiersCount > 0 ? "gold" : "green")}
                    </tr>
                  </table>

                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:22px;border:1px solid #d8e8e2;background:#f3faf7">
                    <tr>
                      <td width="5" style="width:5px;background:#07966f;font-size:0">&nbsp;</td>
                      <td style="padding:17px 18px">
                        <div style="font-size:10px;line-height:1.4;letter-spacing:.8px;color:#087f5b;text-transform:uppercase;font-weight:800">Difficultés majeures déclarées</div>
                        <div style="margin-top:7px;font-size:13px;line-height:1.65;color:#334e68">${multiline(difficulties)}</div>
                      </td>
                    </tr>
                  </table>

                  ${supervisorComment ? `
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:12px;border:1px solid #dfe7ee;background:#f8fafc">
                    <tr><td style="padding:15px 18px">
                      <div style="font-size:10px;line-height:1.4;letter-spacing:.8px;color:#52677b;text-transform:uppercase;font-weight:800">Observation du superviseur</div>
                      <div style="margin-top:6px;font-size:13px;line-height:1.65;color:#334e68">${multiline(supervisorComment)}</div>
                    </td></tr>
                  </table>` : ""}

                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:22px;background:#071c33;color:#ffffff">
                    <tr>
                      <td style="padding:18px 20px">
                        <div style="font-size:10px;line-height:1.4;letter-spacing:.9px;color:#83d1ba;text-transform:uppercase;font-weight:800">Traçabilité numérique</div>
                        <div style="margin-top:7px;font-family:Consolas,Monaco,monospace;font-size:11px;line-height:1.7;color:#d9e5ef">
                          ${escapeHtml(reference)}<br>
                          Visa agent&nbsp;: ${escapeHtml(report.agentSignatureSha256.slice(0, 20))}…<br>
                          Visa superviseur&nbsp;: ${escapeHtml(report.supervisorSignatureSha256?.slice(0, 20) ?? "Non disponible")}…
                        </div>
                      </td>
                    </tr>
                  </table>

                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px">
                    <tr>
                      <td class="attachment-copy" valign="middle" style="padding-right:18px;font-size:12px;line-height:1.6;color:#66788a">
                        <strong style="color:#102a43">Pièce jointe :</strong> rapport PDF final, signé par les deux parties.
                      </td>
                      <td class="attachment-action" width="205" align="right" valign="middle" style="width:205px">
                        <a class="cta" href="${escapeHtml(reportUrl)}" style="display:inline-block;padding:13px 20px;background:#087f5b;color:#ffffff;text-decoration:none;font-size:12px;line-height:1.2;font-weight:800">Consulter les rapports</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td class="email-footer" style="padding:20px 32px;border-top:1px solid #dfe7ee;background:#f6f8fa;color:#718096;font-size:10px;line-height:1.65">
                  Message automatique émis par la plateforme CEIBA Analytics. Ce courriel et sa pièce jointe sont destinés à l’agent concerné et à son superviseur. Le PDF signé constitue la version de référence du rapport journalier ${escapeHtml(reference)}.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;
}
