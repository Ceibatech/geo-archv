import "server-only";

import mysql, { type Pool, type PoolOptions } from "mysql2/promise";

declare global {
  var __geoArchivMysqlPool: Pool | undefined;
}

function databaseOptions(): PoolOptions {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) {
    throw new Error("La variable d'environnement DATABASE_URL est obligatoire.");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("DATABASE_URL n'est pas une URL MySQL valide.");
  }

  if (url.protocol !== "mysql:") {
    throw new Error("DATABASE_URL doit utiliser le protocole mysql://.");
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const port = Number(url.port || "3306");
  if (!url.hostname || !url.username || !database || !Number.isInteger(port) || port <= 0) {
    throw new Error("DATABASE_URL doit contenir l'hôte, l'utilisateur, le port et la base.");
  }

  return {
    host: url.hostname,
    port,
    database,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 10,
    idleTimeout: 60_000,
    queueLimit: 0,
    enableKeepAlive: true,
    timezone: "Z",
    dateStrings: true,
    decimalNumbers: true,
    ssl: url.searchParams.get("ssl") === "true" ? {} : undefined,
  };
}

export function getPool(): Pool {
  if (global.__geoArchivMysqlPool) {
    return global.__geoArchivMysqlPool;
  }

  global.__geoArchivMysqlPool = mysql.createPool(databaseOptions());
  return global.__geoArchivMysqlPool;
}
