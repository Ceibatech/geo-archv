import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { generateDailyReportPdf, type DailyReportPdfData } from "../lib/daily-report-pdf";

const signature = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const sample: DailyReportPdfData = {
  id: 1020,
  reportDate: "2026-08-12",
  agentUserId: 2,
  agentName: "Idriss Bado",
  agentCode: "AG-001",
  agentEmail: "idrissbado@gmail.com",
  supervisorUserId: 3,
  supervisorName: "Superviseur Démonstration",
  supervisorEmail: "superviseur@ceiba-analytics.com",
  teamId: 1,
  teamCode: "EQ-01",
  teamName: "Marcory - Koumassi - Port-Bouët",
  direction: "DDU",
  status: "APPROVED",
  version: 1,
  cartonsCount: 25,
  dossiersCount: 1234,
  degradedCartonsCount: 1,
  degradedDossiersCount: 2,
  majorDifficulties: "- Classement physique incomplet sur deux cartons.\n- Une référence DDU illisible.",
  agentSignature: signature,
  agentSignatureSha256: "a".repeat(64),
  agentSignedAt: "2026-08-12 16:12:00",
  supervisorSignature: signature,
  supervisorSignatureSha256: "b".repeat(64),
  supervisorSignedAt: "2026-08-12 17:03:00",
  supervisorComment: "Rapport contrôlé.",
  rejectionReason: null,
  emailStatus: "SENT",
  resendEmailId: "email_demo",
  emailSentAt: "2026-08-12 17:04:00",
  emailError: null,
};

describe("rapport journalier PDF", () => {
  it("génère un PDF paysage lisible sur une seule page", async () => {
    const bytes = await generateDailyReportPdf(sample);
    expect(Buffer.from(bytes).subarray(0, 5).toString("ascii")).toBe("%PDF-");
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBe(1);
    const { width, height } = document.getPage(0).getSize();
    expect(width).toBeGreaterThan(height);
    expect(document.getTitle()).toContain("Idriss Bado");

    if (process.env.WRITE_REPORT_PREVIEW === "1") {
      const directory = path.join(process.cwd(), "output", "pdf");
      await mkdir(directory, { recursive: true });
      await writeFile(path.join(directory, "CG1020_rapport_journalier_exemple.pdf"), bytes);
    }
  });
});
