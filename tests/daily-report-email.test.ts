import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { dailyReportApprovedEmail } from "../emails/daily-report-approved";
import type { DailyReportSummary } from "../types/domain";

const sample: DailyReportSummary = {
  id: 1020,
  reportDate: "2026-08-12",
  agentUserId: 2,
  agentName: "Awa Koné",
  agentCode: "AG-001",
  agentEmail: "awa@ceiba-analytics.com",
  supervisorUserId: 3,
  supervisorName: "Mariam Yao",
  supervisorEmail: "mariam@ceiba-analytics.com",
  teamId: 1,
  teamCode: "EQ-01",
  teamName: "Marcory - Koumassi - Port-Bouët",
  direction: "DDU",
  status: "APPROVED",
  version: 2,
  cartonsCount: 25,
  dossiersCount: 1234,
  degradedCartonsCount: 1,
  degradedDossiersCount: 2,
  majorDifficulties: "Classement physique incomplet sur deux cartons.\nUne référence DDU est illisible.",
  agentSignatureSha256: "a".repeat(64),
  agentSignedAt: "2026-08-12 16:12:00",
  supervisorSignatureSha256: "b".repeat(64),
  supervisorSignedAt: "2026-08-12 17:03:00",
  supervisorComment: "Rapport contrôlé. Les anomalies ont été consignées.",
  rejectionReason: null,
  emailStatus: "SENT",
  resendEmailId: "email_demo",
  emailSentAt: "2026-08-12 17:04:00",
  emailError: null,
};

describe("e-mail de rapport journalier approuvé", () => {
  it("présente les deux parties, la référence et la pièce jointe", async () => {
    const html = dailyReportApprovedEmail(sample, "https://archives.ceiba-analytics.com/");

    expect(html).toContain("Awa Koné");
    expect(html).toContain("Mariam Yao");
    expect(html).toContain("CG1020-RJ-001020-V2");
    expect(html).toContain("Pièce jointe");
    expect(html).toContain("https://archives.ceiba-analytics.com/rapports");
    expect(html).toContain("https://archives.ceiba-analytics.com/ceibac.jpg");

    if (process.env.WRITE_EMAIL_PREVIEW === "1") {
      const directory = path.join(process.cwd(), "output", "email");
      await mkdir(directory, { recursive: true });
      await writeFile(path.join(directory, "CG1020_rapport_approuve_exemple.html"), html, "utf8");
    }
  });

  it("neutralise les contenus HTML saisis dans le rapport", () => {
    const html = dailyReportApprovedEmail({
      ...sample,
      majorDifficulties: "<script>alert('x')</script>",
      supervisorComment: "Contrôle <b>renforcé</b>",
    }, "https://archives.ceiba-analytics.com");

    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<b>renforcé</b>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Contrôle &lt;b&gt;renforcé&lt;/b&gt;");
  });
});
