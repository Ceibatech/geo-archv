import mysql from "mysql2/promise";

import { databaseOptions } from "./database-config.mjs";

const options = databaseOptions();
const requestedDatabase = options.database;
delete options.database;

const connection = await mysql.createConnection({
  ...options,
  connectTimeout: 10_000,
});

try {
  const [[server]] = await connection.query(
    "SELECT VERSION() AS version, CURRENT_USER() AS currentUser",
  );
  const [databaseRows] = await connection.query("SHOW DATABASES");
  const accessibleDatabases = databaseRows.map((row) => Object.values(row)[0]);

  console.log(`Connexion au serveur MySQL réussie — version : ${server.version}`);

  if (!accessibleDatabases.includes(requestedDatabase)) {
    console.error(`La base demandée '${requestedDatabase}' n'est pas accessible avec cet utilisateur.`);
    console.error(`Bases visibles : ${accessibleDatabases.join(", ") || "aucune"}`);
    process.exitCode = 2;
  } else {
    await connection.changeUser({ database: requestedDatabase });
    const [tables] = await connection.query(
      `SELECT table_name AS tableName
       FROM information_schema.tables
       WHERE table_schema = DATABASE()
       ORDER BY table_name`,
    );

    console.log(`Base sélectionnée : ${requestedDatabase}`);
    console.log(`Tables présentes (${tables.length}) : ${tables.map((row) => row.tableName).join(", ") || "aucune"}`);

    if (tables.some((row) => row.tableName === "users")) {
      const [userCounts] = await connection.query(
        `SELECT role, is_active AS isActive, COUNT(*) AS total
         FROM users
         GROUP BY role, is_active
         ORDER BY role, is_active DESC`,
      );
      const summary = userCounts
        .map((row) => `${row.role}/${row.isActive ? "actifs" : "inactifs"}: ${row.total}`)
        .join(", ");
      console.log(`Comptes de l'application : ${summary || "aucun"}`);
    }

    if (tables.some((row) => row.tableName === "inventory_teams")) {
      const [teamColumns] = await connection.query(
        `SELECT column_name AS columnName
         FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = 'inventory_teams'
         ORDER BY ordinal_position`,
      );
      console.log(`Champs des équipes : ${teamColumns.map((row) => row.columnName).join(", ")}`);
    }
  }
} finally {
  await connection.end();
}
