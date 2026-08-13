import "server-only";

import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { getPool } from "@/db/mysql";
import { dateInAppTimeZone } from "@/lib/date";
import { conflict, forbidden, notFound } from "@/lib/errors";
import { decodePngSignature } from "@/lib/signature";
import type {
  AuthUser,
  DailyReportEmailStatus,
  DailyReportPreview,
  DailyReportStatus,
  DailyReportSummary,
  InventoryDirection,
} from "@/types/domain";

type TeamContextRow = RowDataPacket & {
  teamId: number;
  teamCode: string;
  teamName: string;
  direction: InventoryDirection;
  supervisorUserId: number;
  supervisorName: string;
};

type MetricRow = RowDataPacket & {
  total: number;
  degraded: number;
};

type DifficultyRow = RowDataPacket & { note: string };
type IdRow = RowDataPacket & { id: number };

type ReportRow = RowDataPacket & {
  id: number;
  reportDate: string;
  agentUserId: number;
  agentName: string;
  agentCode: string | null;
  agentEmail: string | null;
  supervisorUserId: number;
  supervisorName: string;
  supervisorEmail: string | null;
  teamId: number;
  teamCode: string;
  teamName: string;
  direction: InventoryDirection;
  status: DailyReportStatus;
  version: number;
  cartonsCount: number;
  dossiersCount: number;
  degradedCartonsCount: number;
  degradedDossiersCount: number;
  majorDifficulties: string | null;
  agentSignatureSha256: string;
  agentSignedAt: string;
  supervisorSignatureSha256: string | null;
  supervisorSignedAt: string | null;
  supervisorComment: string | null;
  rejectionReason: string | null;
  emailStatus: DailyReportEmailStatus;
  resendEmailId: string | null;
  emailSentAt: string | null;
  emailError: string | null;
};

type ReportBinaryRow = ReportRow & {
  agentSignature: Buffer;
  supervisorSignature: Buffer | null;
};

type LockedReportRow = RowDataPacket & {
  id: number;
  status: DailyReportStatus;
  agentUserId: number;
  supervisorUserId: number;
  version: number;
};

const REPORT_SELECT = `SELECT
  r.id,
  r.report_date AS reportDate,
  r.agent_user_id AS agentUserId,
  CONCAT(agent.first_name, ' ', agent.last_name) AS agentName,
  agent.agent_code AS agentCode,
  agent.email AS agentEmail,
  r.supervisor_user_id AS supervisorUserId,
  CONCAT(supervisor.first_name, ' ', supervisor.last_name) AS supervisorName,
  supervisor.email AS supervisorEmail,
  r.team_id AS teamId,
  r.team_code AS teamCode,
  r.team_name AS teamName,
  r.direction,
  r.status,
  r.version,
  r.cartons_count AS cartonsCount,
  r.dossiers_count AS dossiersCount,
  r.degraded_cartons_count AS degradedCartonsCount,
  r.degraded_dossiers_count AS degradedDossiersCount,
  r.major_difficulties AS majorDifficulties,
  r.agent_signature_sha256 AS agentSignatureSha256,
  r.agent_signed_at AS agentSignedAt,
  r.supervisor_signature_sha256 AS supervisorSignatureSha256,
  r.supervisor_signed_at AS supervisorSignedAt,
  r.supervisor_comment AS supervisorComment,
  r.rejection_reason AS rejectionReason,
  r.email_status AS emailStatus,
  r.resend_email_id AS resendEmailId,
  r.email_sent_at AS emailSentAt,
  r.email_error AS emailError
FROM daily_reports r
INNER JOIN users agent ON agent.id = r.agent_user_id
INNER JOIN users supervisor ON supervisor.id = r.supervisor_user_id`;

const REPORT_BINARY_SELECT = REPORT_SELECT.replace(
  "r.agent_signature_sha256 AS agentSignatureSha256,",
  `r.agent_signature AS agentSignature,
  r.supervisor_signature AS supervisorSignature,
  r.agent_signature_sha256 AS agentSignatureSha256,`,
);

function mapReport(row: ReportRow): DailyReportSummary {
  return {
    ...row,
    id: Number(row.id),
    agentUserId: Number(row.agentUserId),
    supervisorUserId: Number(row.supervisorUserId),
    teamId: Number(row.teamId),
    version: Number(row.version),
    cartonsCount: Number(row.cartonsCount),
    dossiersCount: Number(row.dossiersCount),
    degradedCartonsCount: Number(row.degradedCartonsCount),
    degradedDossiersCount: Number(row.degradedDossiersCount),
  };
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function assertFreshDailySignature(
  connection: PoolConnection,
  userId: number,
  role: "agent" | "supervisor",
  hash: string,
) {
  const userColumn = role === "agent" ? "agent_user_id" : "supervisor_user_id";
  const hashColumn = role === "agent" ? "agent_signature_sha256" : "supervisor_signature_sha256";
  const [rows] = await connection.execute<IdRow[]>(
    `SELECT id FROM daily_reports WHERE ${userColumn} = ? AND ${hashColumn} = ?
     UNION ALL
     SELECT id FROM daily_report_events
     WHERE actor_user_id = ? AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.signatureHash')) = ?
     LIMIT 1`,
    [userId, hash, userId, hash],
  );
  if (rows[0]) {
    throw conflict("Cette signature a déjà été utilisée. Tracez une nouvelle signature pour cette fiche.");
  }
}

async function getAgentTeamContext(connection: PoolConnection, userId: number, lock = false) {
  const [rows] = await connection.execute<TeamContextRow[]>(
    `SELECT
       t.id AS teamId,
       t.code AS teamCode,
       t.name AS teamName,
       t.direction,
       t.supervisor_user_id AS supervisorUserId,
       CONCAT(supervisor.first_name, ' ', supervisor.last_name) AS supervisorName
     FROM inventory_team_members tm
     INNER JOIN inventory_teams t ON t.id = tm.team_id
     INNER JOIN users supervisor ON supervisor.id = t.supervisor_user_id
     WHERE tm.user_id = ? AND supervisor.is_active = TRUE
     LIMIT 1${lock ? " FOR UPDATE" : ""}`,
    [userId],
  );
  const row = rows[0];
  return row ? {
    ...row,
    teamId: Number(row.teamId),
    supervisorUserId: Number(row.supervisorUserId),
  } : null;
}

async function readSnapshot(connection: PoolConnection, agentUserId: number, reportDate: string) {
  const nextDate = shiftDate(reportDate, 1);
  const [cartonResult, dossierResult, difficultyResult] = await Promise.all([
    connection.execute<MetricRow[]>(
      `SELECT COUNT(*) AS total, COALESCE(SUM(carton_damaged = TRUE), 0) AS degraded
       FROM cartons
       WHERE created_by = ? AND created_at >= ? AND created_at < ?`,
      [agentUserId, `${reportDate} 00:00:00`, `${nextDate} 00:00:00`],
    ),
    connection.execute<MetricRow[]>(
      `SELECT COUNT(*) AS total, COALESCE(SUM(dossier_damaged = TRUE), 0) AS degraded
       FROM inventory_records
       WHERE created_by = ? AND inventory_date = ?`,
      [agentUserId, reportDate],
    ),
    connection.execute<DifficultyRow[]>(
      `SELECT DISTINCT TRIM(difficulty_note) AS note
       FROM inventory_records
       WHERE created_by = ? AND inventory_date = ?
         AND has_difficulty = TRUE AND difficulty_note IS NOT NULL AND TRIM(difficulty_note) <> ''
       ORDER BY note`,
      [agentUserId, reportDate],
    ),
  ]);
  const cartons = cartonResult[0][0];
  const dossiers = dossierResult[0][0];
  const difficulties = difficultyResult[0].map((row) => row.note.trim()).filter(Boolean);
  return {
    cartonsCount: Number(cartons?.total ?? 0),
    dossiersCount: Number(dossiers?.total ?? 0),
    degradedCartonsCount: Number(cartons?.degraded ?? 0),
    degradedDossiersCount: Number(dossiers?.degraded ?? 0),
    majorDifficulties: difficulties.length ? difficulties.map((note) => `• ${note}`).join("\n") : null,
  };
}

async function addEvent(
  connection: PoolConnection,
  reportId: number,
  actorUserId: number,
  eventType: string,
  metadata?: Record<string, unknown>,
) {
  await connection.execute(
    "INSERT INTO daily_report_events (report_id, actor_user_id, event_type, metadata) VALUES (?, ?, ?, ?)",
    [reportId, actorUserId, eventType, metadata ? JSON.stringify(metadata) : null],
  );
}

function assertReportAccess(report: ReportRow, user: AuthUser) {
  const allowed =
    user.role === "executif" ||
    (user.role === "agent" && Number(report.agentUserId) === user.id) ||
    (user.role === "superviseur" && Number(report.supervisorUserId) === user.id);
  if (!allowed) throw forbidden("Ce rapport ne fait pas partie de votre périmètre.");
}

async function getReportRow(id: number, binary: false): Promise<ReportRow>;
async function getReportRow(id: number, binary: true): Promise<ReportBinaryRow>;
async function getReportRow(id: number, binary: boolean) {
  const [rows] = await getPool().execute<(ReportRow | ReportBinaryRow)[]>(
    `${binary ? REPORT_BINARY_SELECT : REPORT_SELECT} WHERE r.id = ? LIMIT 1`,
    [id],
  );
  const report = rows[0];
  if (!report) throw notFound("Rapport journalier introuvable.");
  return report;
}

export async function getAgentDailyReportPreview(user: AuthUser): Promise<DailyReportPreview | null> {
  if (user.role !== "agent") throw forbidden();
  const connection = await getPool().getConnection();
  try {
    const reportDate = dateInAppTimeZone();
    const team = await getAgentTeamContext(connection, user.id);
    if (!team) return null;
    const snapshot = await readSnapshot(connection, user.id, reportDate);
    return { reportDate, ...team, ...snapshot };
  } finally {
    connection.release();
  }
}

export async function listDailyReports(user: AuthUser) {
  let where = "";
  const values: number[] = [];
  if (user.role === "agent") {
    where = "WHERE r.agent_user_id = ?";
    values.push(user.id);
  } else if (user.role === "superviseur") {
    where = "WHERE r.supervisor_user_id = ?";
    values.push(user.id);
  } else if (user.role !== "executif") {
    throw forbidden();
  }
  const [rows] = await getPool().execute<ReportRow[]>(
    `${REPORT_SELECT} ${where}
     ORDER BY FIELD(r.status, 'PENDING_SUPERVISOR', 'REJECTED', 'APPROVED'), r.report_date DESC, r.id DESC
     LIMIT 180`,
    values,
  );
  return rows.map(mapReport);
}

export async function getDailyReportForUser(id: number, user: AuthUser) {
  const report = await getReportRow(id, false);
  assertReportAccess(report, user);
  return mapReport(report);
}

export async function getDailyReportBinaryForUser(id: number, user: AuthUser) {
  const report = await getReportRow(id, true);
  assertReportAccess(report, user);
  return { ...mapReport(report), agentSignature: report.agentSignature, supervisorSignature: report.supervisorSignature };
}

export async function getDailyReportBinary(id: number) {
  const report = await getReportRow(id, true);
  return { ...mapReport(report), agentSignature: report.agentSignature, supervisorSignature: report.supervisorSignature };
}

export async function signAgentDailyReport(
  user: AuthUser,
  input: { signatureDataUrl: string; consent: boolean; comment?: string },
) {
  if (user.role !== "agent") throw forbidden();
  const { signature, hash } = decodePngSignature(input.signatureDataUrl);
  const reportDate = dateInAppTimeZone();
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    await assertFreshDailySignature(connection, user.id, "agent", hash);
    const team = await getAgentTeamContext(connection, user.id, true);
    if (!team) throw conflict("Votre compte doit être affecté à une équipe avant de signer le rapport.");
    const snapshot = await readSnapshot(connection, user.id, reportDate);
    const [existingRows] = await connection.execute<LockedReportRow[]>(
      `SELECT id, status, agent_user_id AS agentUserId, supervisor_user_id AS supervisorUserId, version
       FROM daily_reports WHERE agent_user_id = ? AND report_date = ? FOR UPDATE`,
      [user.id, reportDate],
    );
    const existing = existingRows[0];
    let reportId: number;
    if (existing && existing.status !== "REJECTED") {
      throw conflict(existing.status === "APPROVED"
        ? "Le rapport du jour est déjà validé."
        : "Le rapport du jour attend déjà la validation du superviseur.");
    }

    if (existing) {
      reportId = Number(existing.id);
      await connection.execute(
        `UPDATE daily_reports SET
           supervisor_user_id = ?, team_id = ?, team_code = ?, team_name = ?, direction = ?,
           status = 'PENDING_SUPERVISOR', version = version + 1,
           cartons_count = ?, dossiers_count = ?, degraded_cartons_count = ?, degraded_dossiers_count = ?,
           major_difficulties = ?, agent_signature = ?, agent_signature_sha256 = ?, agent_signed_at = CURRENT_TIMESTAMP,
           supervisor_signature = NULL, supervisor_signature_sha256 = NULL, supervisor_signed_at = NULL,
           supervisor_comment = NULL, rejection_reason = NULL, rejected_at = NULL,
           approved_pdf_sha256 = NULL, email_status = 'NOT_SENT', resend_email_id = NULL,
           email_sent_at = NULL, email_error = NULL
         WHERE id = ?`,
        [
          team.supervisorUserId, team.teamId, team.teamCode, team.teamName, team.direction,
          snapshot.cartonsCount, snapshot.dossiersCount, snapshot.degradedCartonsCount,
          snapshot.degradedDossiersCount, snapshot.majorDifficulties, signature, hash,
          reportId,
        ],
      );
      await addEvent(connection, reportId, user.id, "AGENT_RESUBMITTED", { signatureHash: hash });
    } else {
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO daily_reports (
           report_date, agent_user_id, supervisor_user_id, team_id, team_code, team_name, direction,
           status, cartons_count, dossiers_count, degraded_cartons_count, degraded_dossiers_count,
           major_difficulties, agent_signature, agent_signature_sha256, agent_signed_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING_SUPERVISOR', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          reportDate, user.id, team.supervisorUserId, team.teamId, team.teamCode, team.teamName, team.direction,
          snapshot.cartonsCount, snapshot.dossiersCount, snapshot.degradedCartonsCount,
          snapshot.degradedDossiersCount, snapshot.majorDifficulties, signature, hash,
        ],
      );
      reportId = result.insertId;
      await addEvent(connection, reportId, user.id, "AGENT_SIGNED", { signatureHash: hash });
    }
    await connection.commit();
    return await getDailyReportForUser(reportId, user);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function approveDailyReport(
  id: number,
  user: AuthUser,
  input: { signatureDataUrl: string; consent: boolean; comment?: string },
) {
  if (user.role !== "superviseur") throw forbidden();
  const { signature, hash } = decodePngSignature(input.signatureDataUrl);
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    await assertFreshDailySignature(connection, user.id, "supervisor", hash);
    const [rows] = await connection.execute<LockedReportRow[]>(
      `SELECT id, status, agent_user_id AS agentUserId, supervisor_user_id AS supervisorUserId, version
       FROM daily_reports WHERE id = ? FOR UPDATE`,
      [id],
    );
    const report = rows[0];
    if (!report) throw notFound("Rapport journalier introuvable.");
    if (Number(report.supervisorUserId) !== user.id) throw forbidden("Ce rapport appartient à une autre équipe.");
    if (report.status !== "PENDING_SUPERVISOR") {
      throw conflict(report.status === "APPROVED" ? "Ce rapport est déjà validé." : "Ce rapport a été renvoyé à l’agent.");
    }
    await connection.execute(
      `UPDATE daily_reports SET
         status = 'APPROVED', supervisor_signature = ?, supervisor_signature_sha256 = ?,
         supervisor_signed_at = CURRENT_TIMESTAMP, supervisor_comment = ?, rejection_reason = NULL,
         rejected_at = NULL, email_status = 'NOT_SENT', email_error = NULL
       WHERE id = ?`,
      [signature, hash, input.comment ?? null, id],
    );
    await addEvent(connection, id, user.id, "SUPERVISOR_APPROVED", { signatureHash: hash });
    await connection.commit();
    return await getDailyReportForUser(id, user);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function rejectDailyReport(id: number, user: AuthUser, reason: string) {
  if (user.role !== "superviseur") throw forbidden();
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<LockedReportRow[]>(
      `SELECT id, status, agent_user_id AS agentUserId, supervisor_user_id AS supervisorUserId, version
       FROM daily_reports WHERE id = ? FOR UPDATE`,
      [id],
    );
    const report = rows[0];
    if (!report) throw notFound("Rapport journalier introuvable.");
    if (Number(report.supervisorUserId) !== user.id) throw forbidden("Ce rapport appartient à une autre équipe.");
    if (report.status !== "PENDING_SUPERVISOR") throw conflict("Seul un rapport en attente peut être retourné.");
    await connection.execute(
      `UPDATE daily_reports SET status = 'REJECTED', rejection_reason = ?, rejected_at = CURRENT_TIMESTAMP,
       supervisor_signature = NULL, supervisor_signature_sha256 = NULL, supervisor_signed_at = NULL,
       email_status = 'NOT_SENT', email_error = NULL WHERE id = ?`,
      [reason, id],
    );
    await addEvent(connection, id, user.id, "SUPERVISOR_REJECTED", { reason });
    await connection.commit();
    return await getDailyReportForUser(id, user);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function recordPdfHash(id: number, hash: string) {
  await getPool().execute(
    "UPDATE daily_reports SET approved_pdf_sha256 = ? WHERE id = ? AND status = 'APPROVED'",
    [hash, id],
  );
}

export async function recordEmailResult(
  id: number,
  actorUserId: number,
  result: { status: "SENT"; resendEmailId: string | null } | { status: "FAILED"; error: string },
) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    if (result.status === "SENT") {
      await connection.execute(
        `UPDATE daily_reports SET email_status = 'SENT', resend_email_id = ?, email_sent_at = CURRENT_TIMESTAMP,
         email_error = NULL WHERE id = ?`,
        [result.resendEmailId, id],
      );
      await addEvent(connection, id, actorUserId, "EMAIL_SENT", { resendEmailId: result.resendEmailId });
    } else {
      await connection.execute(
        "UPDATE daily_reports SET email_status = 'FAILED', email_error = ? WHERE id = ?",
        [result.error.slice(0, 1000), id],
      );
      await addEvent(connection, id, actorUserId, "EMAIL_FAILED", { error: result.error.slice(0, 500) });
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
