import "server-only";

import { randomUUID } from "node:crypto";

import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { z } from "zod";

import { getPool } from "@/db/mysql";
import { dateInAppTimeZone, formatCartonUid } from "@/lib/date";
import { conflict, forbidden, notFound } from "@/lib/errors";
import type { AuthUser, CartonStatus, InventoryRecordListItem } from "@/types/domain";
import type { createInventorySchema, updateInventorySchema } from "@/lib/validation";

export type CreateInventoryInput = z.infer<typeof createInventorySchema>;
export type UpdateInventoryInput = z.infer<typeof updateInventorySchema>;

type CartonLockRow = RowDataPacket & {
  createdBy: number;
  status: CartonStatus;
};

type LockedUserRow = RowDataPacket & { agentCode: string | null; isActive: number };
type IdRow = RowDataPacket & { id: number };

type InventoryListRow = RowDataPacket & Omit<InventoryRecordListItem, "dossierDamaged"> & {
  dossierDamaged: number;
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
  ir.created_at AS createdAt,
  ir.updated_at AS updatedAt
FROM inventory_records ir
INNER JOIN cartons c ON c.id = ir.carton_id
INNER JOIN users u ON u.id = ir.created_by`;

function mapDetail(row: InventoryDetailRow) {
  return {
    ...row,
    dossierDamaged: Boolean(row.dossierDamaged),
    hasDifficulty: Boolean(row.hasDifficulty),
  };
}

function isDuplicateEntry(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY";
}

function assertOwner(user: AuthUser, createdBy: number) {
  if (user.role === "agent" && user.id !== createdBy) {
    throw forbidden("Cette fiche appartient à un autre agent.");
  }
}

export async function getInventoryRecordById(id: number, user: AuthUser) {
  const [rows] = await getPool().execute<InventoryDetailRow[]>(`${SELECT_DETAIL} WHERE ir.id = ? LIMIT 1`, [id]);
  const record = rows[0];
  if (!record) throw notFound("Fiche d'inventaire introuvable.");
  assertOwner(user, record.createdBy);
  return mapDetail(record);
}

async function getRecordByRequestId(clientRequestId: string, user: AuthUser) {
  const [rows] = await getPool().execute<InventoryDetailRow[]>(
    `${SELECT_DETAIL} WHERE ir.client_request_id = ? LIMIT 1`,
    [clientRequestId],
  );
  const record = rows[0];
  if (!record) throw conflict("La requête a déjà été traitée, mais la fiche est introuvable.");
  assertOwner(user, record.createdBy);
  return mapDetail(record);
}

export async function createInventoryRecord(input: CreateInventoryInput, user: AuthUser) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();

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
        difficulty_note, inventory_date, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      ],
    );

    if (input.closeCarton) {
      await connection.execute("UPDATE cartons SET status = 'CLOSED' WHERE id = ?", [cartonId]);
    }

    await connection.commit();
    return { record: await getInventoryRecordById(result.insertId, user), duplicate: false };
  } catch (error) {
    await connection.rollback();
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
       CONCAT(u.first_name, ' ', u.last_name) AS agentName
     FROM inventory_records ir
     INNER JOIN cartons c ON c.id = ir.carton_id
     INNER JOIN users u ON u.id = ir.created_by
     ${whereClause}
     ORDER BY ir.created_at DESC, ir.id DESC
     LIMIT ? OFFSET ?`,
    [...values, input.pageSize, offset],
  );

  const total = Number(countRows[0]?.total ?? 0);
  return {
    data: rows.map((row) => ({ ...row, dossierDamaged: Boolean(row.dossierDamaged) })),
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
    },
  };
}

export async function updateInventoryRecord(id: number, input: UpdateInventoryInput, user: AuthUser) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<
      (RowDataPacket & { createdBy: number; cartonStatus: CartonStatus })[]
    >(
      `SELECT ir.created_by AS createdBy, c.status AS cartonStatus
       FROM inventory_records ir
       INNER JOIN cartons c ON c.id = ir.carton_id
       WHERE ir.id = ? FOR UPDATE`,
      [id],
    );
    const record = rows[0];
    if (!record) throw notFound("Fiche d'inventaire introuvable.");
    assertOwner(user, record.createdBy);
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
