import { readFile } from "node:fs/promises";
import path from "node:path";

import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import type { DailyReportSummary } from "@/types/domain";

export type DailyReportPdfData = DailyReportSummary & {
  agentSignature: Buffer;
  supervisorSignature: Buffer | null;
};

let logoPromise: Promise<Buffer> | null = null;

function getLogo() {
  logoPromise ??= readFile(path.join(process.cwd(), "public", "ceibac.jpg"));
  return logoPromise;
}

function safeText(value: string) {
  return value
    .replaceAll("’", "'")
    .replaceAll("‘", "'")
    .replaceAll("–", "-")
    .replaceAll("—", "-")
    .replaceAll("…", "...")
    .replaceAll("•", "-")
    .replaceAll("\u00a0", " ")
    .replaceAll("\u202f", " ");
}

function formatDate(value: string, withTime = false) {
  const isoValue = value.includes(" ")
    ? `${value.replace(" ", "T")}Z`
    : value.includes("T")
      ? value.endsWith("Z") ? value : `${value}Z`
      : `${value}T12:00:00Z`;
  const date = new Date(isoValue);
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Abidjan",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  for (const paragraph of safeText(text).split("\n")) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let line = words.shift() ?? "";
    for (const word of words) {
      const candidate = `${line} ${word}`;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

function centeredText(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  centerX: number,
  y: number,
  color = rgb(0.04, 0.15, 0.27),
) {
  const normalized = safeText(text);
  page.drawText(normalized, {
    x: centerX - font.widthOfTextAtSize(normalized, size) / 2,
    y,
    size,
    font,
    color,
  });
}

async function drawSignature(
  pdf: PDFDocument,
  page: PDFPage,
  signature: Buffer | null,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (!signature) return false;
  const image = await pdf.embedPng(signature);
  const dimensions = image.scaleToFit(width, height);
  page.drawImage(image, {
    x: x + (width - dimensions.width) / 2,
    y: y + (height - dimensions.height) / 2,
    width: dimensions.width,
    height: dimensions.height,
  });
  return true;
}

export async function generateDailyReportPdf(report: DailyReportPdfData) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([841.89, 595.28]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const navy = rgb(0.05, 0.14, 0.36);
  const paleBlue = rgb(0.75, 0.84, 0.89);
  const paleGreen = rgb(0.93, 0.95, 0.88);
  const ink = rgb(0.08, 0.1, 0.13);
  const line = rgb(0.16, 0.2, 0.24);

  const logo = await pdf.embedJpg(await getLogo());
  page.drawImage(logo, { x: 53, y: 501, width: 95, height: 52 });

  centeredText(
    page,
    "PROJET DE MODERNISATION, DIGITALISATION ET SECURISATION DES ARCHIVES DU MULCV",
    regular,
    12.5,
    500,
    535,
    ink,
  );
  centeredText(
    page,
    "PHASE PILOTE : Inventaire des dossiers de Base et des dossiers ACD",
    regular,
    12,
    500,
    511,
    ink,
  );
  centeredText(
    page,
    "CG1020_FICHE INDIVIDUELLE DE REMONTEE DES DONNEES JOURNALIERES",
    bold,
    15.5,
    420.95,
    455,
    navy,
  );
  centeredText(
    page,
    `Equipe ${report.teamCode} : ${report.teamName} - ${report.direction}`,
    italic,
    13.5,
    420.95,
    425,
    ink,
  );

  page.drawText("NOM & PRENOMS DE L'OPERATEUR :", { x: 65, y: 376, size: 12.5, font: bold, color: ink });
  page.drawLine({ start: { x: 310, y: 373 }, end: { x: 775, y: 373 }, thickness: 0.8, color: line });
  page.drawText(safeText(report.agentName), { x: 320, y: 377, size: 12.5, font: bold, color: navy });
  if (report.agentCode) {
    page.drawText(`Code : ${safeText(report.agentCode)}`, { x: 675, y: 377, size: 8.5, font: regular, color: ink });
  }

  const tableX = 64;
  const tableTop = 333;
  const tableWidth = 713;
  const headerHeight = 29;
  const valueHeight = 72;
  const widths = [143, 143, 204, 223];
  const labels = [
    "NBRE DE CARTONS",
    "NBRE DE DOSSIERS",
    "NBRE DE CARTONS DEGRADES",
    "NBRE DE DOSSIERS DEGRADES",
  ];
  const values = [
    report.cartonsCount,
    report.dossiersCount,
    report.degradedCartonsCount,
    report.degradedDossiersCount,
  ];

  page.drawRectangle({
    x: tableX,
    y: tableTop - headerHeight - valueHeight,
    width: tableWidth,
    height: headerHeight + valueHeight,
    borderColor: line,
    borderWidth: 0.8,
  });
  let columnX = tableX;
  widths.forEach((width, index) => {
    page.drawRectangle({
      x: columnX,
      y: tableTop - headerHeight,
      width,
      height: headerHeight,
      color: paleBlue,
      borderColor: line,
      borderWidth: 0.7,
    });
    centeredText(page, labels[index], regular, 10.5, columnX + width / 2, tableTop - 19, ink);
    centeredText(page, values[index].toLocaleString("fr-FR"), bold, 23, columnX + width / 2, tableTop - 70, navy);
    if (index > 0) {
      page.drawLine({
        start: { x: columnX, y: tableTop - headerHeight - valueHeight },
        end: { x: columnX, y: tableTop },
        thickness: 0.7,
        color: line,
      });
    }
    columnX += width;
  });

  page.drawText("DIFFICULTES MAJEURES RENCONTREES", { x: 68, y: 187, size: 12.5, font: bold, color: navy });
  page.drawLine({ start: { x: 68, y: 183 }, end: { x: 318, y: 183 }, thickness: 0.9, color: navy });
  const difficultyText = report.majorDifficulties || "Aucune difficulté majeure signalée.";
  const difficultyLines = wrapText(difficultyText, regular, 9.5, 350).slice(0, 6);
  difficultyLines.forEach((text, index) => {
    page.drawText(text, { x: 68, y: 166 - index * 14, size: 9.5, font: regular, color: ink });
  });

  page.drawText(`Fait à Abidjan, le ${formatDate(report.reportDate)}`, {
    x: 505,
    y: 188,
    size: 11,
    font: italic,
    color: ink,
  });

  const signatureX = 468;
  const signatureY = 48;
  const signatureWidth = 309;
  const signatureHeight = 119;
  const half = signatureWidth / 2;
  page.drawRectangle({
    x: signatureX,
    y: signatureY,
    width: signatureWidth,
    height: signatureHeight,
    borderColor: line,
    borderWidth: 0.8,
  });
  page.drawRectangle({
    x: signatureX,
    y: signatureY + signatureHeight - 27,
    width: signatureWidth,
    height: 27,
    color: paleGreen,
    borderColor: line,
    borderWidth: 0.7,
  });
  page.drawLine({
    start: { x: signatureX + half, y: signatureY },
    end: { x: signatureX + half, y: signatureY + signatureHeight },
    thickness: 0.7,
    color: line,
  });
  centeredText(page, "VISA OPERATEUR", bold, 11, signatureX + half / 2, signatureY + 99, ink);
  centeredText(page, "VISA SUPERVISEUR", bold, 11, signatureX + half + half / 2, signatureY + 99, ink);

  await drawSignature(pdf, page, report.agentSignature, signatureX + 8, signatureY + 31, half - 16, 48);
  const hasSupervisorSignature = await drawSignature(
    pdf,
    page,
    report.supervisorSignature,
    signatureX + half + 8,
    signatureY + 31,
    half - 16,
    48,
  );
  centeredText(page, report.agentName, regular, 7.5, signatureX + half / 2, signatureY + 20, ink);
  centeredText(
    page,
    `Signé le ${formatDate(report.agentSignedAt, true)}`,
    regular,
    6.8,
    signatureX + half / 2,
    signatureY + 9,
    rgb(0.35, 0.4, 0.45),
  );
  if (hasSupervisorSignature && report.supervisorSignedAt) {
    centeredText(page, report.supervisorName, regular, 7.5, signatureX + half + half / 2, signatureY + 20, ink);
    centeredText(
      page,
      `Validé le ${formatDate(report.supervisorSignedAt, true)}`,
      regular,
      6.8,
      signatureX + half + half / 2,
      signatureY + 9,
      rgb(0.35, 0.4, 0.45),
    );
  } else {
    centeredText(
      page,
      "En attente de validation",
      italic,
      8,
      signatureX + half + half / 2,
      signatureY + 52,
      rgb(0.45, 0.5, 0.55),
    );
  }

  if (report.status !== "APPROVED") {
    page.drawText("DOCUMENT EN ATTENTE DE VALIDATION", {
      x: 205,
      y: 280,
      size: 26,
      font: bold,
      color: rgb(0.7, 0.73, 0.76),
      rotate: degrees(16),
      opacity: 0.13,
    });
  }

  const trace = `CG1020-RJ-${String(report.id).padStart(6, "0")}-V${report.version} | Empreinte agent ${report.agentSignatureSha256.slice(0, 12)}${report.supervisorSignatureSha256 ? ` | Empreinte superviseur ${report.supervisorSignatureSha256.slice(0, 12)}` : ""}`;
  page.drawText(trace, { x: 64, y: 22, size: 6.5, font: regular, color: rgb(0.42, 0.47, 0.52) });
  page.drawText("Document généré par la plateforme sécurisée CEIBA Analytics", {
    x: 560,
    y: 22,
    size: 6.5,
    font: regular,
    color: rgb(0.42, 0.47, 0.52),
  });

  pdf.setTitle(`Rapport journalier CG1020 - ${report.agentName} - ${report.reportDate}`);
  pdf.setAuthor("CEIBA Analytics");
  pdf.setSubject("Rapport journalier signé de production d'inventaire");
  pdf.setCreator("Plateforme Archives CG1020");
  pdf.setProducer("CEIBA Analytics");
  pdf.setCreationDate(new Date());

  return pdf.save({ useObjectStreams: false });
}
