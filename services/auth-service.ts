import "server-only";

import { compare } from "bcryptjs";
import type { RowDataPacket } from "mysql2/promise";

import { getPool } from "@/db/mysql";
import { unauthorized } from "@/lib/errors";

type LoginUserRow = RowDataPacket & {
  id: number;
  passwordHash: string;
  isActive: number;
};

export async function verifyCredentials(identifier: string, password: string) {
  const [rows] = await getPool().execute<LoginUserRow[]>(
    `SELECT id, password_hash AS passwordHash, is_active AS isActive
     FROM users
     WHERE login = ? OR email = ?
     LIMIT 1`,
    [identifier, identifier],
  );

  const row = rows[0];
  if (!row || !row.isActive || !(await compare(password, row.passwordHash))) {
    throw unauthorized("Identifiant ou mot de passe incorrect.");
  }

  return row.id;
}
