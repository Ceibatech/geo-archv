import "server-only";

import { createHash } from "node:crypto";

import { Resend } from "resend";

import { dailyReportApprovedEmail } from "@/emails/daily-report-approved";
import { generateDailyReportPdf } from "@/lib/daily-report-pdf";
import {
  getDailyReportBinary,
  recordEmailResult,
  recordPdfHash,
} from "@/services/daily-report-service";

function resendConfiguration() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey) throw new Error("RESEND_API_KEY n'est pas configurée.");
  if (!fromEmail) throw new Error("RESEND_FROM_EMAIL n'est pas configurée.");
  return {
    client: new Resend(apiKey),
    from: fromEmail.includes("<") ? fromEmail : `CEIBA Analytics - Archives CG1020 <${fromEmail}>`,
    appUrl: process.env.APP_URL?.trim() || "http://localhost:3000",
  };
}

export async function sendApprovedDailyReport(id: number, actorUserId: number, force = false) {
  const report = await getDailyReportBinary(id);
  if (report.status !== "APPROVED" || !report.supervisorSignature || !report.supervisorSignatureSha256) {
    return { sent: false as const, error: "Le rapport doit être validé et signé avant l'envoi." };
  }
  if (report.emailStatus === "SENT" && !force) {
    return { sent: true as const, alreadySent: true, resendEmailId: report.resendEmailId };
  }

  try {
    const recipients = [...new Set([report.agentEmail, report.supervisorEmail].filter(Boolean))] as string[];
    if (!report.agentEmail || !report.supervisorEmail || recipients.length < 2) {
      throw new Error("L'agent et le superviseur doivent chacun avoir une adresse e-mail.");
    }
    const { client, from, appUrl } = resendConfiguration();
    const pdfBytes = await generateDailyReportPdf(report);
    const pdfHash = createHash("sha256").update(pdfBytes).digest("hex");
    await recordPdfHash(id, pdfHash);

    const { data, error } = await client.emails.send(
      {
        from,
        to: recipients,
        subject: `[CG1020] Rapport journalier approuvé - ${report.agentName} - ${report.reportDate}`,
        html: dailyReportApprovedEmail(report, appUrl),
        attachments: [
          {
            filename: `CG1020_rapport_${report.reportDate}_${report.agentCode || report.agentUserId}.pdf`,
            content: Buffer.from(pdfBytes),
          },
        ],
      },
      {
        headers: {
          "Idempotency-Key": `cg1020-daily-${report.id}-v${report.version}-${report.supervisorSignatureSha256.slice(0, 12)}`,
        },
      },
    );
    if (error) throw new Error(error.message || "Resend a refusé l'envoi.");
    await recordEmailResult(id, actorUserId, { status: "SENT", resendEmailId: data?.id ?? null });
    return { sent: true as const, alreadySent: false, resendEmailId: data?.id ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Envoi du rapport impossible.";
    await recordEmailResult(id, actorUserId, { status: "FAILED", error: message });
    return { sent: false as const, error: message };
  }
}
