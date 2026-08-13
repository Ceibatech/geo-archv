const APP_TIME_ZONE = "Africa/Abidjan";

export function dateInAppTimeZone(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function formatCartonUid(date: string, agentCode: string, id: number) {
  const compactDate = date.replaceAll("-", "");
  const normalizedAgentCode = agentCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  return `CG1020-${compactDate}-${normalizedAgentCode}-${String(id).padStart(6, "0")}`;
}
