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

    for (const tableName of ["daily_reports", "daily_report_events", "inventory_records", "inventory_record_events"]) {
      if (!tables.some((row) => row.tableName === tableName)) continue;
      const [columns] = await connection.execute(
        `SELECT column_name AS columnName
         FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ?
         ORDER BY ordinal_position`,
        [tableName],
      );
      console.log(`Champs de ${tableName} : ${columns.map((row) => row.columnName).join(", ")}`);
    }

    if (tables.some((row) => row.tableName === "inventory_record_events")) {
      const [reviewCounts] = await connection.query(
        `SELECT review_status AS reviewStatus, COUNT(*) AS total
         FROM inventory_records
         GROUP BY review_status
         ORDER BY review_status`,
      );
      const reviewSummary = reviewCounts
        .map((row) => `${row.reviewStatus}: ${row.total}`)
        .join(", ");
      console.log(`État des validations de fiches : ${reviewSummary || "aucune fiche"}`);

      const [[assignment]] = await connection.query(
        `SELECT
           COUNT(DISTINCT CASE WHEN u.role = 'agent' AND u.is_active = 1 THEN u.id END) AS activeAgents,
           COUNT(DISTINCT CASE WHEN u.role = 'agent' AND u.is_active = 1 AND tm.team_id IS NOT NULL THEN u.id END) AS assignedAgents
         FROM users u
         LEFT JOIN inventory_team_members tm ON tm.user_id = u.id`,
      );
      console.log(`Agents actifs affectés à une équipe : ${assignment.assignedAgents}/${assignment.activeAgents}`);
    }

    if (tables.some((row) => row.tableName === "daily_reports")) {
      const [[duplicates]] = await connection.query(
        `SELECT
           (SELECT COUNT(*) FROM (
             SELECT agent_user_id, agent_signature_sha256 FROM daily_reports
             WHERE agent_signature_sha256 IS NOT NULL
             GROUP BY agent_user_id, agent_signature_sha256 HAVING COUNT(*) > 1
           ) agent_duplicates) AS agentDuplicateGroups,
           (SELECT COUNT(*) FROM (
             SELECT supervisor_user_id, supervisor_signature_sha256 FROM daily_reports
             WHERE supervisor_signature_sha256 IS NOT NULL
             GROUP BY supervisor_user_id, supervisor_signature_sha256 HAVING COUNT(*) > 1
           ) supervisor_duplicates) AS supervisorDuplicateGroups`,
      );
      console.log(
        `Signatures journalières dupliquées : agents ${duplicates.agentDuplicateGroups}, superviseurs ${duplicates.supervisorDuplicateGroups}`,
      );
    }
  }
} finally {
  await connection.end();
}
