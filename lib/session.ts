import "server-only";

import { createHmac, randomBytes } from "node:crypto";

import { cookies } from "next/headers";
import type { RowDataPacket } from "mysql2/promise";

import { getPool } from "@/db/mysql";
import type { AuthUser, Role } from "@/types/domain";
import { SESSION_COOKIE } from "@/lib/auth-constants";

const SESSION_DURATION_MS = 12 * 60 * 60 * 1_000;

type SessionUserRow = RowDataPacket & {
  id: number;
  firstName: string;
  lastName: string;
  login: string;
  email: string | null;
  agentCode: string | null;
  role: Role;
};

function authSecret() {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET doit contenir au moins 32 caractères.");
  }
  return secret;
}

function tokenHash(token: string) {
  return createHmac("sha256", authSecret()).update(token).digest("hex");
}

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const pool = getPool();

  await pool.execute("DELETE FROM sessions WHERE expires_at <= UTC_TIMESTAMP()");
  await pool.execute(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
    [tokenHash(token), userId, expiresAt],
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
    priority: "high",
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await getPool().execute("DELETE FROM sessions WHERE token_hash = ?", [tokenHash(token)]);
  }

  cookieStore.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<AuthUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [rows] = await getPool().execute<SessionUserRow[]>(
    `SELECT
       u.id,
       u.first_name AS firstName,
       u.last_name AS lastName,
       u.login,
       u.email,
       u.agent_code AS agentCode,
       u.role
     FROM sessions s
     INNER JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?
       AND s.expires_at > UTC_TIMESTAMP()
       AND u.is_active = TRUE
     LIMIT 1`,
    [tokenHash(token)],
  );

  return rows[0] ?? null;
}
