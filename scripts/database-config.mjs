export function databaseOptions(additional = {}) {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL est obligatoire.");

  const url = new URL(value);
  if (url.protocol !== "mysql:") throw new Error("DATABASE_URL doit utiliser mysql://.");

  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!url.hostname || !url.username || !database) {
    throw new Error("DATABASE_URL est incomplète.");
  }

  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    database,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    ssl: url.searchParams.get("ssl") === "true" ? {} : undefined,
    ...additional,
  };
}
