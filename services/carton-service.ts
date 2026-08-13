import "server-only";

import { randomUUID } from "node:crypto";

import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { getPool } from "@/db/mysql";
import { dateInAppTimeZone, formatCartonUid } from "@/lib/date";
import { conflict, forbidden, notFound } from "@/lib/errors";
import type { AuthUser, Carton, CartonStatus } from "@/types/domain";

export type CreateCartonInput = {
  libelle: string;
  barcode?: string;
  cartonDamaged: boolean;
  cartonDamageNote?: string;
};

type CartonRow = RowDataPacket & {
  id: number;
  cartonUid: string;
  libelle: string;
  barcode: string | null;
  cartonDamaged: number;
  cartonDamageNote: string | null;
  status: CartonStatus;
  createdBy: number;
  agentCode: string | null;
  agentName: string;
  createdAt: string;
  updatedAt: string;
  dossierCount: number;
};

type LockedUserRow = RowDataPacket & { agentCode: string | null; isActive: number };
type IdRow = RowDataPacket & { id: number };

const SELECT_CARTON = `SELECT
  c.id,
  c.carton_uid AS cartonUid,
  c.libelle,
  c.barcode,
  c.carton_damaged AS cartonDamaged,
  c.carton_damage_note AS cartonDamageNote,
  c.status,
  c.created_by AS createdBy,
  u.agent_code AS agentCode,
  CONCAT(u.first_name, ' ', u.last_name) AS agentName,
  c.created_at AS createdAt,
  c.updated_at AS updatedAt,
  COUNT(ir.id) AS dossierCount
FROM cartons c
INNER JOIN users u ON u.id = c.created_by
LEFT JOIN inventory_records ir ON ir.carton_id = c.id`;

function mapCarton(row: CartonRow): Carton {
  return {
    ...row,
    cartonDamaged: Boolean(row.cartonDamaged),
    dossierCount: Number(row.dossierCount),
  };
}

export async function getCartonById(id: number) {
  const [rows] = await getPool().execute<CartonRow[]>(
    `${SELECT_CARTON} WHERE c.id = ? GROUP BY c.id LIMIT 1`,
    [id],
  );
  if (!rows[0]) throw notFound("Carton introuvable.");
  return mapCarton(rows[0]);
}

export async function getCurrentCarton(userId: number) {
  const [rows] = await getPool().execute<CartonRow[]>(
    `${SELECT_CARTON} WHERE c.created_by = ? AND c.status = 'OPEN'
     GROUP BY c.id ORDER BY c.created_at DESC LIMIT 1`,
    [userId],
  );
  return rows[0] ? mapCarton(rows[0]) : null;
}

export async function createCarton(input: CreateCartonInput, user: AuthUser) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();

    const [userRows] = await connection.execute<LockedUserRow[]>(
      "SELECT agent_code AS agentCode, is_active AS isActive FROM users WHERE id = ? FOR UPDATE",
      [user.id],
    );
    const lockedUser = userRows[0];
    if (!lockedUser?.isActive) throw forbidden("Ce compte n'est pas actif.");
    if (!lockedUser.agentCode) throw conflict("Un code agent est requis pour créer un carton.");

    const [openRows] = await connection.execute<IdRow[]>(
      "SELECT id FROM cartons WHERE created_by = ? AND status = 'OPEN' ORDER BY id DESC LIMIT 1 FOR UPDATE",
      [user.id],
    );
    if (openRows[0]) {
      throw conflict("Un carton est déjà en cours.", { cartonId: openRows[0].id });
    }

    const temporaryUid = `PENDING-${randomUUID()}`;
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO cartons
        (carton_uid, libelle, barcode, carton_damaged, carton_damage_note, status, created_by)
       VALUES (?, ?, ?, ?, ?, 'OPEN', ?)`,
      [
        temporaryUid,
        input.libelle,
        input.barcode ?? null,
        input.cartonDamaged,
        input.cartonDamageNote ?? null,
        user.id,
      ],
    );

    const cartonUid = formatCartonUid(dateInAppTimeZone(), lockedUser.agentCode, result.insertId);
    await connection.execute("UPDATE cartons SET carton_uid = ? WHERE id = ?", [cartonUid, result.insertId]);
    await connection.commit();
    return await getCartonById(result.insertId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export function assertCartonAccess(carton: Carton, user: AuthUser) {
  if (user.role === "agent" && carton.createdBy !== user.id) {
    throw forbidden("Ce carton appartient à un autre agent.");
  }
}

export async function closeCarton(id: number, user: AuthUser) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<(RowDataPacket & { createdBy: number; status: CartonStatus })[]>(
      "SELECT created_by AS createdBy, status FROM cartons WHERE id = ? FOR UPDATE",
      [id],
    );
    const carton = rows[0];
    if (!carton) throw notFound("Carton introuvable.");
    if (user.role === "agent" && carton.createdBy !== user.id) {
      throw forbidden("Ce carton appartient à un autre agent.");
    }
    if (carton.status === "OPEN") {
      await connection.execute("UPDATE cartons SET status = 'CLOSED' WHERE id = ?", [id]);
    }
    await connection.commit();
    return await getCartonById(id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
