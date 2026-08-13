import "server-only";

import { hash } from "bcryptjs";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { getPool } from "@/db/mysql";
import { conflict, notFound } from "@/lib/errors";
import type { Role } from "@/types/domain";

export type UserInput = {
  firstName: string;
  lastName: string;
  email?: string;
  login: string;
  password: string;
  agentCode?: string;
  role: Role;
  isActive: boolean;
};

export type UserUpdateInput = Partial<Omit<UserInput, "password">> & { password?: string };

type UserRow = RowDataPacket & {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  login: string;
  agentCode: string | null;
  role: Role;
  isActive: number;
  createdAt: string;
  updatedAt: string;
};

const SELECT_USERS = `SELECT
  id,
  first_name AS firstName,
  last_name AS lastName,
  email,
  login,
  agent_code AS agentCode,
  role,
  is_active AS isActive,
  created_at AS createdAt,
  updated_at AS updatedAt
FROM users`;

function mapUser(row: UserRow) {
  return { ...row, isActive: Boolean(row.isActive) };
}

function rethrowDuplicate(error: unknown): never {
  if (typeof error === "object" && error && "code" in error && error.code === "ER_DUP_ENTRY") {
    throw conflict("Le login, l'e-mail ou le code agent existe déjà.");
  }
  throw error;
}

export async function listUsers() {
  const [rows] = await getPool().query<UserRow[]>(`${SELECT_USERS} ORDER BY last_name, first_name`);
  return rows.map(mapUser);
}

export async function getUserById(id: number) {
  const [rows] = await getPool().execute<UserRow[]>(`${SELECT_USERS} WHERE id = ? LIMIT 1`, [id]);
  if (!rows[0]) throw notFound("Utilisateur introuvable.");
  return mapUser(rows[0]);
}

export async function createUser(input: UserInput) {
  try {
    const passwordHash = await hash(input.password, 12);
    const [result] = await getPool().execute<ResultSetHeader>(
      `INSERT INTO users
        (first_name, last_name, email, login, password_hash, agent_code, role, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.firstName,
        input.lastName,
        input.email ?? null,
        input.login.toLowerCase(),
        passwordHash,
        input.agentCode?.toUpperCase() ?? null,
        input.role,
        input.isActive,
      ],
    );
    return await getUserById(result.insertId);
  } catch (error) {
    rethrowDuplicate(error);
  }
}

export async function updateUser(id: number, input: UserUpdateInput, actorId: number) {
  const currentUser = await getUserById(id);
  if (id === actorId && input.isActive === false) {
    throw conflict("Vous ne pouvez pas désactiver votre propre compte.");
  }

  const removesSupervisorAccess =
    currentUser.role === "superviseur"
    && ((input.role !== undefined && input.role !== "superviseur") || input.isActive === false);
  if (removesSupervisorAccess) {
    const [teams] = await getPool().execute<RowDataPacket[]>(
      "SELECT id FROM inventory_teams WHERE supervisor_user_id = ? LIMIT 1",
      [id],
    );
    if (teams[0]) {
      throw conflict("Réaffectez d’abord les équipes de ce superviseur.");
    }
  }

  const assignments: string[] = [];
  const values: Array<string | number | boolean | null> = [];
  const fields: Array<
    [keyof UserUpdateInput, string, (value: string | boolean) => string | boolean | null]
  > = [
    ["firstName", "first_name", (value) => value],
    ["lastName", "last_name", (value) => value],
    ["email", "email", (value) => value || null],
    ["login", "login", (value) => String(value).toLowerCase()],
    ["agentCode", "agent_code", (value) => (value ? String(value).toUpperCase() : null)],
    ["role", "role", (value) => value],
    ["isActive", "is_active", (value) => value],
  ];

  for (const [key, column, transform] of fields) {
    if (input[key] !== undefined) {
      assignments.push(`${column} = ?`);
      values.push(transform(input[key] as string | boolean));
    }
  }

  if (input.role && input.role !== "agent" && input.agentCode === undefined) {
    assignments.push("agent_code = ?");
    values.push(null);
  }

  if (input.password) {
    assignments.push("password_hash = ?");
    values.push(await hash(input.password, 12));
  }

  if (assignments.length === 0) return getUserById(id);

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    values.push(id);
    await connection.execute(`UPDATE users SET ${assignments.join(", ")} WHERE id = ?`, values);
    if (input.role && input.role !== "agent") {
      await connection.execute("DELETE FROM inventory_team_members WHERE user_id = ?", [id]);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    rethrowDuplicate(error);
  } finally {
    connection.release();
  }
  return getUserById(id);
}
