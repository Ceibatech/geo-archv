import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import mysql from "mysql2/promise";

import { databaseOptions } from "./database-config.mjs";

const sqlDirectory = path.join(process.cwd(), "sql");
const migrationFiles = (await readdir(sqlDirectory))
  .filter((file) => /^\d+_.*\.sql$/.test(file))
  .sort();

const connection = await mysql.createConnection({
  ...databaseOptions({ multipleStatements: true }),
  connectTimeout: 10_000,
});

try {
  await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (version)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  const [appliedRows] = await connection.query("SELECT version FROM schema_migrations");
  const applied = new Set(appliedRows.map((row) => row.version));

  for (const file of migrationFiles) {
    if (applied.has(file)) {
      console.log(`Déjà appliquée : ${file}`);
      continue;
    }

    console.log(`Application : ${file}`);
    const sql = await readFile(path.join(sqlDirectory, file), "utf8");
    await connection.query(sql);
    await connection.execute("INSERT INTO schema_migrations (version) VALUES (?)", [file]);
    console.log(`Terminée : ${file}`);
  }

  console.log("Migrations MySQL terminées.");
} finally {
  await connection.end();
}
