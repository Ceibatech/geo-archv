import process from "node:process";

import { hash } from "bcryptjs";
import mysql from "mysql2/promise";

import { databaseOptions } from "./database-config.mjs";

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function required(name) {
  const value = argument(name);
  if (!value) throw new Error(`Argument obligatoire : --${name}`);
  return value;
}

const role = required("role");
if (!["admin", "agent", "superviseur", "executif"].includes(role)) {
  throw new Error("--role doit valoir admin, agent, superviseur ou executif.");
}

const agentCode = argument("agent-code")?.toUpperCase() || null;
if (role === "agent" && !agentCode) {
  throw new Error("--agent-code est obligatoire pour un agent.");
}

const pool = mysql.createPool(databaseOptions());

try {
  const passwordHash = await hash(required("password"), 12);
  const [result] = await pool.execute(
    `INSERT INTO users
      (first_name, last_name, email, login, password_hash, agent_code, role, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
    [
      required("first-name"),
      required("last-name"),
      argument("email") || null,
      required("login").toLowerCase(),
      passwordHash,
      agentCode,
      role,
    ],
  );
  console.log(`Utilisateur créé avec l'identifiant ${result.insertId}.`);
} finally {
  await pool.end();
}
