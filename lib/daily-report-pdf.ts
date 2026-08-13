import { readFile } from "node:fs/promises";
import path from "node:path";

import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import type { DailyReportSummary } from "@/types/domain";

export type DailyReportPdfData = DailyReportSummary & {
  agentSignature: Buffer;
  supervisorSignature: Buffer | null;
};

const COLORS = {
  white: rgb(1, 1, 1),
  navy: rgb(0.027, 0.11, 0.2),
  blue: rgb(0.07, 0.23, 0.4),
  green: rgb(0.03, 0.59, 0.43),
  greenDark: rgb(0.02, 0.4, 0.3),
  ink: rgb(0.06, 0.14, 0.22),
  slate: rgb(0.28, 0.38, 0.47),
  muted: rgb(0.43, 0.5, 0.57),
  border: rgb(0.84, 0.89, 0.92),
  paleBlue: rgb(0.95, 0.97, 0.985),
  paleGreen: rgb(0.94, 0.98, 0.96),
  paleGold: rgb(0.99, 0.97, 0.91),
  gold: rgb(0.73, 0.53, 0.13),
};

let logoPromise: Promise<Buffer> | null = null;

function getLogo() {
  logoPromise ??= readFile(path.join(process.cwd(), "public", "ceibac.jpg"));
  return logoPromise;
}

function safeText(value: string) {
  return value
    .replaceAll("â€™", "'")
    .replaceAll("â€˜", "'")
    .replaceAll("â€“", "-")
    .replaceAll("â€”", "-")
    .replaceAll("â€¦", "...")
    .replaceAll("â€¢", "-")
    .replaceAll("’", "'")
    .replaceAll("‘", "'")
    .replaceAll("–", "-")
    .replaceAll("—", "-")
    .replaceAll("…", "...")
    .replaceAll("•", "-")
    .replaceAll("\u00a0", " ")
    .replaceAll("\u202f", " ");
}

function dateValue(value: string, dateOnly = false) {
  if (dateOnly) return new Date(`${value}T12:00:00Z`);
  if (value.includes("T")) return new Date(value.endsWith("Z") ? value : `${value}Z`);
  return new Date(`${value.replace(" ", "T")}Z`);
}

function formatDate(value: string, withTime = false) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Abidjan",
    day: "2-digit",
    month: "long",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(dateValue(value, !withTime));
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

function truncateText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const normalized = safeText(text);
  if (font.widthOfTextAtSize(normalized, size) <= maxWidth) return normalized;
  const suffix = "...";
  let result = normalized;
  while (result.length && font.widthOfTextAtSize(`${result}${suffix}`, size) > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result.trimEnd()}${suffix}`;
}

function fittedSize(text: string, font: PDFFont, preferred: number, minimum: number, maxWidth: number) {
  let size = preferred;
  const normalized = safeText(text);
  while (size > minimum && font.widthOfTextAtSize(normalized, size) > maxWidth) size -= 0.25;
  return size;
}

function centeredText(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  centerX: number,
  y: number,
  color = COLORS.ink,
  maxWidth?: number,
) {
  const normalized = maxWidth ? truncateText(text, font, size, maxWidth) : safeText(text);
  page.drawText(normalized, {
    x: centerX - font.widthOfTextAtSize(normalized, size) / 2,
    y,
    size,
    font,
    color,
  });
}

function sectionHeading(page: PDFPage, text: string, x: number, y: number, font: PDFFont, accent = COLORS.green) {
  page.drawRectangle({ x, y: y - 1, width: 4, height: 15, color: accent });
  page.drawText(safeText(text.toUpperCase()), { x: x + 12, y: y + 2, size: 9.2, font, color: COLORS.ink });
}

function identityCard(
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  options: { x: number; y: number; width: number; label: string; value: string; detail: string },
) {
  const { x, y, width, label, value, detail } = options;
  page.drawRectangle({
    x,
    y,
    width,
    height: 58,
    color: COLORS.paleBlue,
    borderColor: COLORS.border,
    borderWidth: 0.7,
  });
  page.drawRectangle({ x, y, width: 4, height: 58, color: COLORS.green });
  page.drawText(safeText(label.toUpperCase()), { x: x + 15, y: y + 39, size: 7.4, font: fonts.bold, color: COLORS.muted });
  const valueSize = fittedSize(value, fonts.bold, 12.4, 9.2, width - 30);
  page.drawText(truncateText(value, fonts.bold, valueSize, width - 30), {
    x: x + 15,
    y: y + 21,
    size: valueSize,
    font: fonts.bold,
    color: COLORS.ink,
  });
  page.drawText(truncateText(detail, fonts.regular, 7.8, width - 30), {
    x: x + 15,
    y: y + 8,
    size: 7.8,
    font: fonts.regular,
    color: COLORS.slate,
  });
}

function metricCard(
  page: PDFPage,
  fonts: { regular: PDFFont; bold: PDFFont },
  options: { x: number; y: number; width: number; label: string; value: number; degraded?: boolean },
) {
  const { x, y, width, label, value, degraded = false } = options;
  const background = degraded ? (value > 0 ? COLORS.paleGold : COLORS.paleGreen) : COLORS.paleBlue;
  const accent = degraded ? (value > 0 ? COLORS.gold : COLORS.greenDark) : COLORS.blue;
  page.drawRectangle({
    x,
    y,
    width,
    height: 72,
    color: background,
    borderColor: COLORS.border,
    borderWidth: 0.7,
  });
  page.drawRectangle({ x, y: y + 69, width, height: 3, color: accent });
  page.drawText(safeText(label.toUpperCase()), {
    x: x + 13,
    y: y + 49,
    size: 7.3,
    font: fonts.bold,
    color: COLORS.muted,
  });
  page.drawText(safeText(value.toLocaleString("fr-FR")), {
    x: x + 13,
    y: y + 16,
    size: 25,
    font: fonts.bold,
    color: accent,
  });
  const note = degraded ? (value > 0 ? "Controle physique requis" : "Aucune anomalie") : "Production declaree";
  const noteWidth = fonts.regular.widthOfTextAtSize(note, 6.9);
  page.drawText(note, {
    x: x + width - noteWidth - 12,
    y: y + 18,
    size: 6.9,
    font: fonts.regular,
    color: COLORS.slate,
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

function drawTextBlock(
  page: PDFPage,
  text: string,
  font: PDFFont,
  options: { x: number; y: number; width: number; size: number; lineHeight: number; maxLines: number; color?: ReturnType<typeof rgb> },
) {
  const lines = wrapText(text, font, options.size, options.width);
  const visible = lines.slice(0, options.maxLines);
  if (lines.length > options.maxLines && visible.length) {
    visible[visible.length - 1] = truncateText(`${visible[visible.length - 1]}...`, font, options.size, options.width);
  }
  visible.forEach((line, index) => {
    page.drawText(line, {
      x: options.x,
      y: options.y - index * options.lineHeight,
      size: options.size,
      font,
      color: options.color ?? COLORS.slate,
    });
  });
}

export async function generateDailyReportPdf(report: DailyReportPdfData) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([841.89, 595.28]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const fonts = { regular, bold };
  const reference = `CG1020-RJ-${String(report.id).padStart(6, "0")}-V${report.version}`;

  page.drawRectangle({ x: 0, y: 0, width: 841.89, height: 595.28, color: COLORS.white });
  page.drawRectangle({ x: 0, y: 500, width: 841.89, height: 95.28, color: COLORS.navy });
  page.drawRectangle({ x: 0, y: 500, width: 7, height: 95.28, color: COLORS.green });

  page.drawRectangle({ x: 40, y: 518, width: 112, height: 60, color: COLORS.white });
  const logo = await pdf.embedJpg(await getLogo());
  const logoSize = logo.scaleToFit(98, 47);
  page.drawImage(logo, {
    x: 47 + (98 - logoSize.width) / 2,
    y: 524 + (47 - logoSize.height) / 2,
    width: logoSize.width,
    height: logoSize.height,
  });

  page.drawText("MINISTERE DE LA CONSTRUCTION, DU LOGEMENT ET DE L'URBANISME", {
    x: 174,
    y: 563,
    size: 7.4,
    font: bold,
    color: rgb(0.7, 0.79, 0.86),
  });
  page.drawText("PROGRAMME DE MODERNISATION DES ARCHIVES", {
    x: 174,
    y: 540,
    size: 14.4,
    font: bold,
    color: COLORS.white,
  });
  page.drawText("Phase pilote - Inventaire des dossiers de base et des dossiers ACD", {
    x: 174,
    y: 521,
    size: 8.8,
    font: regular,
    color: rgb(0.74, 0.82, 0.88),
  });

  page.drawRectangle({
    x: 678,
    y: 538,
    width: 123,
    height: 28,
    color: COLORS.greenDark,
    borderColor: rgb(0.18, 0.72, 0.55),
    borderWidth: 0.8,
  });
  page.drawCircle({ x: 692, y: 552, size: 3.4, color: rgb(0.52, 0.94, 0.76) });
  page.drawText(report.status === "APPROVED" ? "APPROUVE ET SIGNE" : "EN COURS DE VISA", {
    x: 703,
    y: 548.5,
    size: 7.3,
    font: bold,
    color: COLORS.white,
  });
  centeredText(page, reference, regular, 6.7, 739.5, 522, rgb(0.72, 0.8, 0.86), 120);

  page.drawText("RAPPORT JOURNALIER CERTIFIE", { x: 40, y: 474, size: 8.2, font: bold, color: COLORS.greenDark });
  page.drawText("Fiche individuelle de remontée des données", { x: 40, y: 448, size: 20, font: bold, color: COLORS.navy });
  page.drawText("Production d'inventaire - contrôle et traçabilité des visas", { x: 40, y: 431, size: 8.8, font: regular, color: COLORS.slate });

  page.drawText("JOURNEE DE PRODUCTION", { x: 665, y: 468, size: 7.2, font: bold, color: COLORS.muted });
  const reportDate = safeText(formatDate(report.reportDate));
  const reportDateSize = fittedSize(reportDate, bold, 11.5, 9, 137);
  page.drawText(reportDate, { x: 665, y: 449, size: reportDateSize, font: bold, color: COLORS.ink });
  page.drawLine({ start: { x: 40, y: 418 }, end: { x: 802, y: 418 }, thickness: 0.7, color: COLORS.border });

  identityCard(page, fonts, {
    x: 40,
    y: 346,
    width: 370,
    label: "Opérateur responsable",
    value: report.agentName,
    detail: report.agentCode ? `Matricule ${report.agentCode} - Visa agent le ${formatDate(report.agentSignedAt, true)}` : `Visa agent le ${formatDate(report.agentSignedAt, true)}`,
  });
  identityCard(page, fonts, {
    x: 422,
    y: 346,
    width: 380,
    label: "Équipe et périmètre",
    value: `${report.teamCode} - ${report.teamName}`,
    detail: `Direction ${report.direction} - Superviseur : ${report.supervisorName}`,
  });

  sectionHeading(page, "Synthèse de la production", 40, 322, bold);
  const metricWidth = 183;
  metricCard(page, fonts, { x: 40, y: 239, width: metricWidth, label: "Cartons inventoriés", value: report.cartonsCount });
  metricCard(page, fonts, { x: 233, y: 239, width: metricWidth, label: "Dossiers traités", value: report.dossiersCount });
  metricCard(page, fonts, { x: 426, y: 239, width: metricWidth, label: "Cartons dégradés", value: report.degradedCartonsCount, degraded: true });
  metricCard(page, fonts, { x: 619, y: 239, width: metricWidth, label: "Dossiers dégradés", value: report.degradedDossiersCount, degraded: true });

  page.drawRectangle({ x: 40, y: 82, width: 372, height: 136, color: COLORS.white, borderColor: COLORS.border, borderWidth: 0.8 });
  page.drawRectangle({ x: 40, y: 188, width: 372, height: 30, color: COLORS.paleBlue });
  sectionHeading(page, "Faits marquants et difficultés", 53, 196, bold);
  const difficultyText = report.majorDifficulties || "Aucune difficulté majeure signalée pour cette journée.";
  drawTextBlock(page, difficultyText, regular, {
    x: 54,
    y: 171,
    width: 344,
    size: 8.5,
    lineHeight: 11.5,
    maxLines: report.supervisorComment ? 4 : 7,
    color: COLORS.slate,
  });
  if (report.supervisorComment) {
    page.drawRectangle({ x: 53, y: 93, width: 346, height: 37, color: COLORS.paleGreen });
    page.drawText("OBSERVATION DU SUPERVISEUR", { x: 62, y: 117, size: 6.6, font: bold, color: COLORS.greenDark });
    drawTextBlock(page, report.supervisorComment, italic, {
      x: 62,
      y: 104,
      width: 327,
      size: 7.3,
      lineHeight: 9,
      maxLines: 2,
      color: COLORS.slate,
    });
  }

  page.drawRectangle({ x: 424, y: 82, width: 378, height: 136, color: COLORS.white, borderColor: COLORS.border, borderWidth: 0.8 });
  page.drawRectangle({ x: 424, y: 188, width: 378, height: 30, color: COLORS.paleGreen });
  sectionHeading(page, "Chaîne de validation", 437, 196, bold);
  page.drawLine({ start: { x: 613, y: 92 }, end: { x: 613, y: 188 }, thickness: 0.7, color: COLORS.border });
  centeredText(page, "VISA DE L'OPERATEUR", bold, 7.3, 518.5, 175, COLORS.muted, 164);
  centeredText(page, "VISA DU SUPERVISEUR", bold, 7.3, 707.5, 175, COLORS.muted, 164);

  await drawSignature(pdf, page, report.agentSignature, 441, 126, 155, 42);
  const hasSupervisorSignature = await drawSignature(pdf, page, report.supervisorSignature, 630, 126, 155, 42);
  centeredText(page, report.agentName, bold, 7.5, 518.5, 115, COLORS.ink, 160);
  centeredText(page, `Signé le ${formatDate(report.agentSignedAt, true)}`, regular, 6.4, 518.5, 102, COLORS.slate, 160);
  centeredText(page, `Empreinte ${report.agentSignatureSha256.slice(0, 12)}`, regular, 5.9, 518.5, 90, COLORS.muted, 160);

  if (hasSupervisorSignature && report.supervisorSignedAt) {
    centeredText(page, report.supervisorName, bold, 7.5, 707.5, 115, COLORS.ink, 160);
    centeredText(page, `Validé le ${formatDate(report.supervisorSignedAt, true)}`, regular, 6.4, 707.5, 102, COLORS.slate, 160);
    centeredText(page, `Empreinte ${report.supervisorSignatureSha256?.slice(0, 12) ?? "-"}`, regular, 5.9, 707.5, 90, COLORS.muted, 160);
  } else {
    centeredText(page, "En attente de validation", italic, 8, 707.5, 139, COLORS.muted, 160);
  }

  if (report.status !== "APPROVED") {
    page.drawText("DOCUMENT EN ATTENTE DE VALIDATION", {
      x: 188,
      y: 275,
      size: 28,
      font: bold,
      color: COLORS.muted,
      rotate: degrees(15),
      opacity: 0.12,
    });
  }

  page.drawLine({ start: { x: 40, y: 64 }, end: { x: 802, y: 64 }, thickness: 0.7, color: COLORS.border });
  const trace = `${reference} | Agent ${report.agentSignatureSha256.slice(0, 12)} | Superviseur ${report.supervisorSignatureSha256?.slice(0, 12) ?? "en attente"}`;
  page.drawText(trace, { x: 40, y: 47, size: 6.4, font: regular, color: COLORS.slate });
  const generatedBy = "Document sécurisé généré par CEIBA Analytics";
  page.drawText(generatedBy, {
    x: 802 - regular.widthOfTextAtSize(generatedBy, 6.4),
    y: 47,
    size: 6.4,
    font: regular,
    color: COLORS.slate,
  });
  page.drawText("Ce document constitue la version de référence du rapport journalier après validation des deux parties.", {
    x: 40,
    y: 29,
    size: 6.1,
    font: italic,
    color: COLORS.muted,
  });
  page.drawText("Page 1 / 1", {
    x: 756,
    y: 29,
    size: 6.1,
    font: regular,
    color: COLORS.muted,
  });

  pdf.setTitle(`Rapport journalier CG1020 - ${report.agentName} - ${report.reportDate}`);
  pdf.setAuthor("CEIBA Analytics");
  pdf.setSubject("Rapport journalier signé de production d'inventaire");
  pdf.setKeywords(["CG1020", "archives", "inventaire", "rapport journalier", "signature"]);
  pdf.setCreator("Plateforme Archives CG1020");
  pdf.setProducer("CEIBA Analytics");
  pdf.setCreationDate(new Date());

  return pdf.save({ useObjectStreams: false });
}
