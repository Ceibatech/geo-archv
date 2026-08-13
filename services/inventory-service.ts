import "server-only";

import { randomUUID } from "node:crypto";

import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { z } from "zod";

import { getPool } from "@/db/mysql";
import { dateInAppTimeZone, formatCartonUid } from "@/lib/date";
import { conflict, forbidden, notFound } from "@/lib/errors";
import { isCaseNatureAllowedForDirection } from "@/lib/inventory-case-natures";
import { decodePngSignature } from "@/lib/signature";
import type {
  AuthUser,
  CartonStatus,
  InventoryRecordListItem,
  InventoryRecordReview,
  InventoryReviewStatus,
} from "@/types/domain";
import type { inventoryResubmissionSchema, inventorySubmissionSchema, updateInventorySchema } from "@/lib/validation";
import { getAgentInventoryTeam } from "@/services/team-service";

export type CreateInventoryInput = z.infer<typeof inventorySubmissionSchema>;
export type UpdateInventoryInput = z.infer<typeof updateInventorySchema>;
export type ResubmitInventoryInput = z.infer<typeof inventoryResubmissionSchema>;

type CartonLockRow = RowDataPacket & {
  createdBy: number;
  status: CartonStatus;
};

type LockedUserRow = RowDataPacket & { agentCode: string | null; isActive: number };
type IdRow = RowDataPacket & { id: number };
type TeamReviewRow = RowDataPacket & { teamId: number; supervisorUserId: number };
type ReviewLockRow = RowDataPacket & {
  id: number;
  createdBy: number;
  supervisorUserId: number | null;
  reviewStatus: InventoryReviewStatus;
};

type InventoryListRow = RowDataPacket & Omit<InventoryRecordListItem, "dossierDamaged"> & {
  dossierDamaged: number;
};

type InventoryReviewRow = RowDataPacket & Omit<InventoryRecordReview, "dossierDamaged" | "hasDifficulty"> & {
  dossierDamaged: number;
  hasDifficulty: number;
};

type CountRow = RowDataPacket & { total: number };
type InventoryDetailRow = RowDataPacket & {
  id: number;
  cartonId: number;
  cartonUid: string;
  guichetNumber: string | null;
  dduNumber: string | null;
  classificationReference: string | null;
  ilotNumber: string | null;
  lotNumber: string | null;
  surfaceArea: number | null;
  landTitleNumber: string | null;
  housingEstate: string | null;
  commune: string | null;
  caseNature: string;
  lastName: string | null;
  firstNames: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  contactPerson: string | null;
  contactMobile: string | null;
  dossierDamaged: number;
  dossierDamageNote: string | null;
  hasDifficulty: number;
  difficultyNote: string | null;
  inventoryDate: string;
  createdBy: number;
  agentCode: string | null;
  agentName: string;
  createdAt: string;
  updatedAt: string;
  supervisorUserId: number | null;
  supervisorName: string | null;
  reviewStatus: InventoryReviewStatus;
  reviewVersion: number;
  agentSignatureSha256: string | null;
  agentSignedAt: string | null;
  supervisorSignatureSha256: string | null;
  supervisorSignedAt: string | null;
  supervisorComment: string | null;
  rejectionReason: string | null;
};

const SELECT_DETAIL = `SELECT
  ir.id,
  ir.carton_id AS cartonId,
  c.carton_uid AS cartonUid,
  ir.guichet_number AS guichetNumber,
  ir.ddu_number AS dduNumber,
  ir.classification_reference AS classificationReference,
  ir.ilot_number AS ilotNumber,
  ir.lot_number AS lotNumber,
  ir.surface_area AS surfaceArea,
  ir.land_title_number AS landTitleNumber,
  ir.housing_estate AS housingEstate,
  ir.commune,
  ir.case_nature AS caseNature,
  ir.last_name AS lastName,
  ir.first_names AS firstNames,
  ir.address,
  ir.phone,
  ir.email,
  ir.contact_person AS contactPerson,
  ir.contact_mobile AS contactMobile,
  ir.dossier_damaged AS dossierDamaged,
  ir.dossier_damage_note AS dossierDamageNote,
  ir.has_difficulty AS hasDifficulty,
  ir.difficulty_note AS difficultyNote,
  ir.inventory_date AS inventoryDate,
  ir.created_by AS createdBy,
  u.agent_code AS agentCode,
  CONCAT(u.first_name, ' ', u.last_name) AS agentName,
  ir.supervisor_user_id AS supervisorUserId,
  CASE WHEN supervisor.id IS NULL THEN NULL ELSE CONCAT(supervisor.first_name, ' ', supervisor.last_name) END AS supervisorName,
  ir.review_status AS reviewStatus,
  ir.review_version AS reviewVersion,
  ir.agent_signature_sha256 AS agentSignatureSha256,
  ir.agent_signed_at AS agentSignedAt,
  ir.supervisor_signature_sha256 AS supervisorSignatureSha256,
  ir.supervisor_signed_at AS supervisorSignedAt,
  ir.supervisor_comment AS supervisorComment,
  ir.rejection_reason AS rejectionReason,
  ir.created_at AS createdAt,
  ir.updated_at AS updatedAt
FROM inventory_records ir
INNER JOIN cartons c ON c.id = ir.carton_id
INNER JOIN users u ON u.id = ir.created_by
LEFT JOIN users supervisor ON supervisor.id = ir.supervisor_user_id`;

function mapDetail(row: InventoryDetailRow) {
  return {
    ...row,
    id: Number(row.id),
    cartonId: Number(row.cartonId),
    createdBy: Number(row.createdBy),
    supervisorUserId: row.supervisorUserId === null ? null : Number(row.supervisorUserId),
    reviewVersion: Number(row.reviewVersion),
    dossierDamaged: Boolean(row.dossierDamaged),
    hasDifficulty: Boolean(row.hasDifficulty),
  };
}

async function getReviewTeam(connection: PoolConnection, userId: number) {
  const [rows] = await connection.execute<TeamReviewRow[]>(
    `SELECT t.id AS teamId, t.supervisor_user_id AS supervisorUserId
     FROM inventory_team_members tm
     INNER JOIN inventory_teams t ON t.id = tm.team_id
     INNER JOIN users supervisor ON supervisor.id = t.supervisor_user_id
     WHERE tm.user_id = ? AND supervisor.is_active = TRUE
     LIMIT 1 FOR UPDATE`,
    [userId],
  );
  const row = rows[0];
  if (!row) throw conflict("Votre compte doit être affecté à une équipe avec un superviseur avant de signer cette fiche.");
  return { teamId: Number(row.teamId), supervisorUserId: Number(row.supervisorUserId) };
}

async function assertFreshInventorySignature(
  connection: PoolConnection,
  userId: number,
  role: "agent" | "supervisor",
  hash: string,
) {
  const userColumn = role === "agent" ? "created_by" : "supervisor_user_id";
  const hashColumn = role === "agent" ? "agent_signature_sha256" : "supervisor_signature_sha256";
  const [rows] = await connection.execute<IdRow[]>(
    `SELECT id FROM inventory_records WHERE ${userColumn} = ? AND ${hashColumn} = ?
     UNION ALL
     SELECT id FROM inventory_record_events
     WHERE actor_user_id = ? AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.signatureHash')) = ?
     LIMIT 1`,
    [userId, hash, userId, hash],
  );
  if (rows[0]) throw conflict("Cette signature a déjà été utilisée. Tracez une nouvelle signature pour cette fiche.");
}

async function addReviewEvent(
  connection: PoolConnection,
  recordId: number,
  actorUserId: number,
  eventType: string,
  metadata?: Record<string, unknown>,
) {
  await connection.execute(
    "INSERT INTO inventory_record_events (record_id, actor_user_id, event_type, metadata) VALUES (?, ?, ?, ?)",
    [recordId, actorUserId, eventType, metadata ? JSON.stringify(metadata) : null],
  );
}

function isDuplicateEntry(error: unknown): error is { code: "ER_DUP_ENTRY"; sqlMessage?: unknown } {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY";
}

function isSignatureDuplicate(error: unknown) {
  if (!isDuplicateEntry(error)) return false;
  const message = "sqlMessage" in error ? String(error.sqlMessage) : String(error);
  return message.includes("uq_inventory_agent_signature") || message.includes("uq_inventory_supervisor_signature");
}

function assertOwner(user: AuthUser, createdBy: number, supervisorUserId?: number | null) {
  if (user.role === "agent" && user.id !== createdBy) {
    throw forbidden("Cette fiche appartient à un autre agent.");
  }
  if (user.role === "superviseur" && user.id !== supervisorUserId) {
    throw forbidden("Cette fiche appartient à une autre équipe.");
  }
}

async function assertCaseNatureMatchesAgentDirection(caseNature: string, user: AuthUser) {
  const team = await getAgentInventoryTeam(user.id);
  if (!isCaseNatureAllowedForDirection(caseNature, team?.direction ?? null)) {
    throw conflict("La nature du dossier ne correspond pas à la direction de l’agent.");
  }
}

export async function getInventoryRecordById(id: number, user: AuthUser) {
  const [rows] = await getPool().execute<InventoryDetailRow[]>(`${SELECT_DETAIL} WHERE ir.id = ? LIMIT 1`, [id]);
  const record = rows[0];
  if (!record) throw notFound("Fiche d'inventaire introuvable.");
  assertOwner(user, record.createdBy, record.supervisorUserId);
  return mapDetail(record);
}

async function getRecordByRequestId(clientRequestId: string, user: AuthUser) {
  const [rows] = await getPool().execute<InventoryDetailRow[]>(
    `${SELECT_DETAIL} WHERE ir.client_request_id = ? LIMIT 1`,
    [clientRequestId],
  );
  const record = rows[0];
  if (!record) throw conflict("La requête a déjà été traitée, mais la fiche est introuvable.");
  assertOwner(user, record.createdBy, record.supervisorUserId);
  return mapDetail(record);
}

function parseInventorySignature(input: Pick<CreateInventoryInput, "signatureDataUrl">) {
  if (!input.signatureDataUrl) return { signature: null as Buffer | null, hash: null as string | null };
  const { signature, hash } = decodePngSignature(input.signatureDataUrl);
  return { signature, hash };
}

export async function createInventoryRecord(input: CreateInventoryInput, user: AuthUser) {
  await assertCaseNatureMatchesAgentDirection(input.caseNature, user);
  const { signature, hash } = parseInventorySignature(input);
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();

    const [duplicateRows] = await connection.execute<IdRow[]>(
      "SELECT id FROM inventory_records WHERE client_request_id = ? LIMIT 1 FOR UPDATE",
      [input.clientRequestId],
    );
    if (duplicateRows[0]) {
      await connection.rollback();
      return { record: await getRecordByRequestId(input.clientRequestId, user), duplicate: true };
    }

    const team = await getReviewTeam(connection, user.id);
    if (hash) {
      await assertFreshInventorySignature(connection, user.id, "agent", hash);
    }

    let cartonId = input.cartonId;

    if (!cartonId) {
      const newCarton = input.carton;
      if (!newCarton) {
        throw conflict("Les informations du nouveau carton sont obligatoires.");
      }

      const [userRows] = await connection.execute<LockedUserRow[]>(
        "SELECT agent_code AS agentCode, is_active AS isActive FROM users WHERE id = ? FOR UPDATE",
        [user.id],
      );
      const lockedUser = userRows[0];
      if (!lockedUser?.isActive) throw forbidden("Ce compte n'est pas actif.");
      if (!lockedUser.agentCode) throw conflict("Un code agent est requis pour enregistrer une fiche.");

      const [openRows] = await connection.execute<IdRow[]>(
        "SELECT id FROM cartons WHERE created_by = ? AND status = 'OPEN' ORDER BY id DESC LIMIT 1 FOR UPDATE",
        [user.id],
      );
      if (openRows[0]) {
        throw conflict("Un carton est déjà en cours. Rechargez la fiche pour continuer.", {
          cartonId: openRows[0].id,
        });
      }

      const temporaryUid = `PENDING-${randomUUID()}`;
      const [cartonResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO cartons
          (carton_uid, libelle, barcode, carton_damaged, carton_damage_note, status, created_by)
         VALUES (?, ?, ?, ?, ?, 'OPEN', ?)`,
        [
          temporaryUid,
          newCarton.libelle,
          newCarton.barcode ?? null,
          newCarton.cartonDamaged,
          newCarton.cartonDamageNote ?? null,
          user.id,
        ],
      );

      cartonId = cartonResult.insertId;
      const cartonUid = formatCartonUid(dateInAppTimeZone(), lockedUser.agentCode, cartonId);
      await connection.execute("UPDATE cartons SET carton_uid = ? WHERE id = ?", [cartonUid, cartonId]);
    }

    const [cartonRows] = await connection.execute<CartonLockRow[]>(
      "SELECT created_by AS createdBy, status FROM cartons WHERE id = ? FOR UPDATE",
      [cartonId],
    );
    const carton = cartonRows[0];
    if (!carton) throw notFound("Carton introuvable.");
    assertOwner(user, carton.createdBy);
    if (carton.status !== "OPEN") throw conflict("Ce carton est déjà terminé.");

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO inventory_records (
        carton_id, client_request_id, guichet_number, ddu_number, classification_reference,
        ilot_number, lot_number, surface_area, land_title_number, housing_estate, commune,
        case_nature, last_name, first_names, address, phone, email, contact_person,
        contact_mobile, dossier_damaged, dossier_damage_note, has_difficulty,
        difficulty_note, inventory_date, created_by, supervisor_user_id, review_status,
        review_version, agent_signature, agent_signature_sha256, agent_signed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_SUPERVISOR', 1, ?, ?, ${hash ? "CURRENT_TIMESTAMP" : "NULL"})`,
      [
        cartonId,
        input.clientRequestId,
        input.guichetNumber ?? null,
        input.dduNumber ?? null,
        input.classificationReference ?? null,
        input.ilotNumber ?? null,
        input.lotNumber ?? null,
        input.surfaceArea ?? null,
        input.landTitleNumber ?? null,
        input.housingEstate ?? null,
        input.commune ?? null,
        input.caseNature,
        input.lastName ?? null,
        input.firstNames ?? null,
        input.address ?? null,
        input.phone ?? null,
        input.email ?? null,
        input.contactPerson ?? null,
        input.contactMobile ?? null,
        input.dossierDamaged,
        input.dossierDamageNote ?? null,
        input.hasDifficulty,
        input.difficultyNote ?? null,
        dateInAppTimeZone(),
        user.id,
        team.supervisorUserId,
        signature,
        hash,
      ],
    );

    await addReviewEvent(connection, result.insertId, user.id, hash ? "AGENT_SIGNED" : "AGENT_SUBMITTED", {
      ...(hash ? { signatureHash: hash } : {}),
      teamId: team.teamId,
      supervisorUserId: team.supervisorUserId,
    });

    if (input.closeCarton) {
      await connection.execute("UPDATE cartons SET status = 'CLOSED' WHERE id = ?", [cartonId]);
    }

    await connection.commit();
    return { record: await getInventoryRecordById(result.insertId, user), duplicate: false };
  } catch (error) {
    await connection.rollback();
    if (isSignatureDuplicate(error)) {
      throw conflict("Cette signature a déjà été utilisée. Tracez une nouvelle signature pour cette fiche.");
    }
    if (isDuplicateEntry(error)) {
      return { record: await getRecordByRequestId(input.clientRequestId, user), duplicate: true };
    }
    throw error;
  } finally {
    connection.release();
  }
}

export async function listInventoryRecords(
  input: { page: number; pageSize: number; search?: string },
  user: AuthUser,
) {
  const where: string[] = [];
  const values: Array<string | number | boolean | null> = [];

  if (user.role === "agent") {
    where.push("ir.created_by = ?");
    values.push(user.id);
  }

  if (input.search) {
    where.push(`(
      c.carton_uid LIKE ? OR c.barcode LIKE ? OR c.libelle LIKE ? OR
      ir.guichet_number LIKE ? OR ir.ddu_number LIKE ? OR ir.classification_reference LIKE ? OR
      ir.ilot_number LIKE ? OR ir.lot_number LIKE ? OR ir.land_title_number LIKE ? OR
      ir.commune LIKE ? OR ir.last_name LIKE ? OR ir.first_names LIKE ?
    )`);
    const pattern = `%${input.search}%`;
    values.push(...Array(12).fill(pattern));
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const offset = (input.page - 1) * input.pageSize;
  const pool = getPool();
  const [countRows] = await pool.execute<CountRow[]>(
    `SELECT COUNT(*) AS total
     FROM inventory_records ir
     INNER JOIN cartons c ON c.id = ir.carton_id
     ${whereClause}`,
    values,
  );

  const [rows] = await pool.execute<InventoryListRow[]>(
    `SELECT
       ir.id,
       ir.carton_id AS cartonId,
       c.carton_uid AS cartonUid,
       ir.case_nature AS caseNature,
       ir.guichet_number AS guichetNumber,
       ir.ddu_number AS dduNumber,
       ir.classification_reference AS classificationReference,
       ir.commune,
       ir.last_name AS lastName,
       ir.first_names AS firstNames,
       ir.dossier_damaged AS dossierDamaged,
       ir.inventory_date AS inventoryDate,
       u.agent_code AS agentCode,
       CONCAT(u.first_name, ' ', u.last_name) AS agentName,
       ir.supervisor_user_id AS supervisorUserId,
       CASE WHEN supervisor.id IS NULL THEN NULL ELSE CONCAT(supervisor.first_name, ' ', supervisor.last_name) END AS supervisorName,
       ir.review_status AS reviewStatus,
       ir.review_version AS reviewVersion,
       ir.agent_signature_sha256 AS agentSignatureSha256,
       ir.agent_signed_at AS agentSignedAt,
       ir.supervisor_signature_sha256 AS supervisorSignatureSha256,
       ir.supervisor_signed_at AS supervisorSignedAt,
       ir.supervisor_comment AS supervisorComment,
       ir.rejection_reason AS rejectionReason
     FROM inventory_records ir
     INNER JOIN cartons c ON c.id = ir.carton_id
     INNER JOIN users u ON u.id = ir.created_by
     LEFT JOIN users supervisor ON supervisor.id = ir.supervisor_user_id
     ${whereClause}
     ORDER BY ir.created_at DESC, ir.id DESC
     LIMIT ? OFFSET ?`,
    [...values, input.pageSize, offset],
  );

  const total = Number(countRows[0]?.total ?? 0);
  return {
    data: rows.map((row) => ({
      ...row,
      id: Number(row.id),
      cartonId: Number(row.cartonId),
      supervisorUserId: row.supervisorUserId === null ? null : Number(row.supervisorUserId),
      reviewVersion: Number(row.reviewVersion),
      dossierDamaged: Boolean(row.dossierDamaged),
    })),
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
    },
  };
}

export async function updateInventoryRecord(id: number, input: UpdateInventoryInput, user: AuthUser) {
  if (input.caseNature !== undefined) {
    await assertCaseNatureMatchesAgentDirection(input.caseNature, user);
  }
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<
      (RowDataPacket & { createdBy: number; cartonStatus: CartonStatus; reviewStatus: InventoryReviewStatus })[]
    >(
      `SELECT ir.created_by AS createdBy, c.status AS cartonStatus, ir.review_status AS reviewStatus
       FROM inventory_records ir
       INNER JOIN cartons c ON c.id = ir.carton_id
       WHERE ir.id = ? FOR UPDATE`,
      [id],
    );
    const record = rows[0];
    if (!record) throw notFound("Fiche d'inventaire introuvable.");
    assertOwner(user, record.createdBy);
    if (user.role === "agent" && record.reviewStatus !== "REJECTED") {
      throw conflict("Seule une fiche rejetée peut être corrigée puis signée de nouveau.");
    }
    if (user.role === "agent" && record.cartonStatus !== "OPEN") {
      throw conflict("Une fiche d'un carton terminé ne peut plus être modifiée par l'agent.");
    }

    const mapping: Array<[keyof UpdateInventoryInput, string]> = [
      ["guichetNumber", "guichet_number"],
      ["dduNumber", "ddu_number"],
      ["classificationReference", "classification_reference"],
      ["ilotNumber", "ilot_number"],
      ["lotNumber", "lot_number"],
      ["surfaceArea", "surface_area"],
      ["landTitleNumber", "land_title_number"],
      ["housingEstate", "housing_estate"],
      ["commune", "commune"],
      ["caseNature", "case_nature"],
      ["lastName", "last_name"],
      ["firstNames", "first_names"],
      ["address", "address"],
      ["phone", "phone"],
      ["email", "email"],
      ["contactPerson", "contact_person"],
      ["contactMobile", "contact_mobile"],
      ["dossierDamaged", "dossier_damaged"],
      ["dossierDamageNote", "dossier_damage_note"],
      ["hasDifficulty", "has_difficulty"],
      ["difficultyNote", "difficulty_note"],
    ];
    const assignments: string[] = [];
    const values: Array<string | number | boolean | null> = [];
    for (const [key, column] of mapping) {
      if (input[key] !== undefined) {
        assignments.push(`${column} = ?`);
        const value = input[key];
        values.push((value === "" || value === undefined ? null : value) as string | number | boolean | null);
      }
    }
    if (assignments.length) {
      values.push(id);
      await connection.execute(`UPDATE inventory_records SET ${assignments.join(", ")} WHERE id = ?`, values);
    }
    await connection.commit();
    return await getInventoryRecordById(id, user);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function listInventoryReviews(
  user: AuthUser,
  input: { status?: InventoryReviewStatus; limit?: number } = {},
) {
  if (user.role !== "superviseur" && user.role !== "executif") throw forbidden();
  const conditions: string[] = [];
  const values: Array<string | number> = [];
  if (user.role === "superviseur") {
    conditions.push("ir.supervisor_user_id = ?");
    values.push(user.id);
  }
  if (input.status) {
    conditions.push("ir.review_status = ?");
    values.push(input.status);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = Math.max(1, Math.min(250, input.limit ?? 250));
  values.push(limit);
  const [rows] = await getPool().execute<InventoryReviewRow[]>(
    `SELECT
       ir.id,
       ir.carton_id AS cartonId,
       c.carton_uid AS cartonUid,
       ir.case_nature AS caseNature,
       ir.guichet_number AS guichetNumber,
       ir.ddu_number AS dduNumber,
       ir.classification_reference AS classificationReference,
       ir.commune,
       ir.last_name AS lastName,
       ir.first_names AS firstNames,
       ir.dossier_damaged AS dossierDamaged,
       ir.dossier_damage_note AS dossierDamageNote,
       ir.has_difficulty AS hasDifficulty,
       ir.difficulty_note AS difficultyNote,
       ir.inventory_date AS inventoryDate,
       ir.created_by AS createdBy,
       agent.agent_code AS agentCode,
       CONCAT(agent.first_name, ' ', agent.last_name) AS agentName,
       ir.supervisor_user_id AS supervisorUserId,
       CASE WHEN supervisor.id IS NULL THEN NULL ELSE CONCAT(supervisor.first_name, ' ', supervisor.last_name) END AS supervisorName,
       ir.review_status AS reviewStatus,
       ir.review_version AS reviewVersion,
       ir.agent_signature_sha256 AS agentSignatureSha256,
       ir.agent_signed_at AS agentSignedAt,
       ir.supervisor_signature_sha256 AS supervisorSignatureSha256,
       ir.supervisor_signed_at AS supervisorSignedAt,
       ir.supervisor_comment AS supervisorComment,
       ir.rejection_reason AS rejectionReason,
       ir.created_at AS createdAt
     FROM inventory_records ir
     INNER JOIN cartons c ON c.id = ir.carton_id
     INNER JOIN users agent ON agent.id = ir.created_by
     LEFT JOIN users supervisor ON supervisor.id = ir.supervisor_user_id
     ${where}
     ORDER BY FIELD(ir.review_status, 'PENDING_SUPERVISOR', 'REJECTED', 'APPROVED'), ir.created_at DESC
     LIMIT ?`,
    values,
  );
  return rows.map((row) => ({
    ...row,
    id: Number(row.id),
    cartonId: Number(row.cartonId),
    createdBy: Number(row.createdBy),
    supervisorUserId: row.supervisorUserId === null ? null : Number(row.supervisorUserId),
    reviewVersion: Number(row.reviewVersion),
    dossierDamaged: Boolean(row.dossierDamaged),
    hasDifficulty: Boolean(row.hasDifficulty),
  }));
}

export async function getPendingInventoryReviewSummary(user: AuthUser, limit = 8) {
  if (user.role !== "superviseur") throw forbidden();
  const [records, countRows] = await Promise.all([
    listInventoryReviews(user, { status: "PENDING_SUPERVISOR", limit }),
    getPool().execute<CountRow[]>(
      `SELECT COUNT(*) AS total
       FROM inventory_records
       WHERE supervisor_user_id = ? AND review_status = 'PENDING_SUPERVISOR'`,
      [user.id],
    ),
  ]);
  return { records, total: Number(countRows[0][0]?.total ?? 0) };
}

export async function approveInventoryRecord(
  id: number,
  user: AuthUser,
  input: { signatureDataUrl: string; consent: boolean; comment?: string },
) {
  if (user.role !== "superviseur") throw forbidden();
  const { signature, hash } = decodePngSignature(input.signatureDataUrl);
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    await assertFreshInventorySignature(connection, user.id, "supervisor", hash);
    const [rows] = await connection.execute<ReviewLockRow[]>(
      `SELECT id, created_by AS createdBy, supervisor_user_id AS supervisorUserId,
              review_status AS reviewStatus
       FROM inventory_records WHERE id = ? FOR UPDATE`,
      [id],
    );
    const record = rows[0];
    if (!record) throw notFound("Fiche d'inventaire introuvable.");
    if (Number(record.supervisorUserId) !== user.id) throw forbidden("Cette fiche appartient à une autre équipe.");
    if (record.reviewStatus !== "PENDING_SUPERVISOR") {
      throw conflict("Seule une fiche en attente peut être approuvée.");
    }
    await connection.execute(
      `UPDATE inventory_records SET
         review_status = 'APPROVED', supervisor_signature = ?, supervisor_signature_sha256 = ?,
         supervisor_signed_at = CURRENT_TIMESTAMP, supervisor_comment = ?, rejection_reason = NULL,
         rejected_at = NULL
       WHERE id = ?`,
      [signature, hash, input.comment ?? null, id],
    );
    await addReviewEvent(connection, id, user.id, "SUPERVISOR_APPROVED", { signatureHash: hash });
    await connection.commit();
    return await getInventoryRecordById(id, user);
  } catch (error) {
    await connection.rollback();
    if (isSignatureDuplicate(error)) {
      throw conflict("Cette signature a déjà été utilisée. Tracez une nouvelle signature pour cette fiche.");
    }
    throw error;
  } finally {
    connection.release();
  }
}

export async function rejectInventoryRecord(id: number, user: AuthUser, reason: string) {
  if (user.role !== "superviseur") throw forbidden();
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<ReviewLockRow[]>(
      `SELECT id, created_by AS createdBy, supervisor_user_id AS supervisorUserId,
              review_status AS reviewStatus
       FROM inventory_records WHERE id = ? FOR UPDATE`,
      [id],
    );
    const record = rows[0];
    if (!record) throw notFound("Fiche d'inventaire introuvable.");
    if (Number(record.supervisorUserId) !== user.id) throw forbidden("Cette fiche appartient à une autre équipe.");
    if (record.reviewStatus !== "PENDING_SUPERVISOR") {
      throw conflict("Seule une fiche en attente peut être rejetée.");
    }
    await connection.execute(
      `UPDATE inventory_records SET
         review_status = 'REJECTED', rejection_reason = ?, rejected_at = CURRENT_TIMESTAMP,
         supervisor_signature = NULL, supervisor_signature_sha256 = NULL,
         supervisor_signed_at = NULL, supervisor_comment = NULL
       WHERE id = ?`,
      [reason, id],
    );
    await addReviewEvent(connection, id, user.id, "SUPERVISOR_REJECTED", { reason });
    await connection.commit();
    return await getInventoryRecordById(id, user);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function resubmitInventoryRecord(id: number, input: ResubmitInventoryInput, user: AuthUser) {
  if (user.role !== "agent") throw forbidden();
  await assertCaseNatureMatchesAgentDirection(input.caseNature, user);
  const { signature, hash } = parseInventorySignature(input);
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const team = await getReviewTeam(connection, user.id);
    if (hash) {
      await assertFreshInventorySignature(connection, user.id, "agent", hash);
    }
    const [rows] = await connection.execute<ReviewLockRow[]>(
      `SELECT id, created_by AS createdBy, supervisor_user_id AS supervisorUserId,
              review_status AS reviewStatus
       FROM inventory_records WHERE id = ? FOR UPDATE`,
      [id],
    );
    const record = rows[0];
    if (!record) throw notFound("Fiche d'inventaire introuvable.");
    if (Number(record.createdBy) !== user.id) throw forbidden("Cette fiche appartient à un autre agent.");
    if (record.reviewStatus !== "REJECTED") throw conflict("Seule une fiche rejetée peut être corrigée puis renvoyée.");

    await connection.execute(
      `UPDATE inventory_records SET
         guichet_number = ?, ddu_number = ?, classification_reference = ?, ilot_number = ?,
         lot_number = ?, surface_area = ?, land_title_number = ?, housing_estate = ?, commune = ?,
         case_nature = ?, last_name = ?, first_names = ?, address = ?, phone = ?, email = ?,
         contact_person = ?, contact_mobile = ?, dossier_damaged = ?, dossier_damage_note = ?,
         has_difficulty = ?, difficulty_note = ?, supervisor_user_id = ?,
         review_status = 'PENDING_SUPERVISOR', review_version = review_version + 1,
         agent_signature = ?, agent_signature_sha256 = ?, agent_signed_at = ${hash ? "CURRENT_TIMESTAMP" : "NULL"},
         supervisor_signature = NULL, supervisor_signature_sha256 = NULL,
         supervisor_signed_at = NULL, supervisor_comment = NULL, rejection_reason = NULL, rejected_at = NULL
       WHERE id = ?`,
      [
        input.guichetNumber ?? null,
        input.dduNumber ?? null,
        input.classificationReference ?? null,
        input.ilotNumber ?? null,
        input.lotNumber ?? null,
        input.surfaceArea ?? null,
        input.landTitleNumber ?? null,
        input.housingEstate ?? null,
        input.commune ?? null,
        input.caseNature,
        input.lastName ?? null,
        input.firstNames ?? null,
        input.address ?? null,
        input.phone ?? null,
        input.email ?? null,
        input.contactPerson ?? null,
        input.contactMobile ?? null,
        input.dossierDamaged,
        input.dossierDamageNote ?? null,
        input.hasDifficulty,
        input.difficultyNote ?? null,
        team.supervisorUserId,
        signature,
        hash,
        id,
      ],
    );
    await addReviewEvent(connection, id, user.id, hash ? "AGENT_RESUBMITTED" : "AGENT_RECORRECTED", {
      ...(hash ? { signatureHash: hash } : {}),
      teamId: team.teamId,
      supervisorUserId: team.supervisorUserId,
    });
    await connection.commit();
    return await getInventoryRecordById(id, user);
  } catch (error) {
    await connection.rollback();
    if (isSignatureDuplicate(error)) {
      throw conflict("Cette signature a déjà été utilisée. Tracez une nouvelle signature pour cette fiche.");
    }
    throw error;
  } finally {
    connection.release();
  }
}
