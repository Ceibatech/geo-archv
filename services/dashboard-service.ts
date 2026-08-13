import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { getPool } from "@/db/mysql";
import { dateInAppTimeZone } from "@/lib/date";
import type { AuthUser } from "@/types/domain";

export type DashboardPeriod = "day" | "week" | "month";

type AgentMetricRow = RowDataPacket & {
  id: number;
  firstName: string;
  lastName: string;
  agentCode: string | null;
  teamCode: string | null;
  teamName: string | null;
  direction: string | null;
  cartons: number;
  dossiers: number;
  degradedCartons: number;
  degradedDossiers: number;
};

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function periodRange(period: DashboardPeriod) {
  const today = dateInAppTimeZone();
  const date = new Date(`${today}T00:00:00Z`);
  let start = today;

  if (period === "week") {
    const day = date.getUTCDay() || 7;
    start = shiftDate(today, 1 - day);
  } else if (period === "month") {
    start = `${today.slice(0, 7)}-01`;
  }

  const endExclusive = period === "day"
    ? shiftDate(start, 1)
    : period === "week"
      ? shiftDate(start, 7)
      : (() => {
          const nextMonth = new Date(`${start}T00:00:00Z`);
          nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
          return nextMonth.toISOString().slice(0, 10);
        })();

  const format = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  const startLabel = format.format(new Date(`${start}T00:00:00Z`));
  const endLabel = format.format(new Date(`${shiftDate(endExclusive, -1)}T00:00:00Z`));

  return {
    start,
    endExclusive,
    label: start === shiftDate(endExclusive, -1) ? startLabel : `${startLabel} – ${endLabel}`,
  };
}

function scopeCopy(user: AuthUser) {
  if (user.role === "agent") {
    return {
      title: "Ma performance",
      description: "Vos cartons et dossiers enregistrés sur la période sélectionnée.",
    };
  }
  if (user.role === "superviseur") {
    return {
      title: "Performance de mon équipe",
      description: "Uniquement les agents rattachés à vos équipes.",
    };
  }
  return {
    title: "Vue exécutive",
    description: "Tous les agents actifs du dispositif d’inventaire.",
  };
}

export async function getDashboardData(user: AuthUser, period: DashboardPeriod) {
  const range = periodRange(period);
  const values: Array<string | number> = [
    `${range.start} 00:00:00`,
    `${range.endExclusive} 00:00:00`,
    range.start,
    range.endExclusive,
  ];
  let scopeClause = "";

  if (user.role === "agent") {
    scopeClause = "AND u.id = ?";
    values.push(user.id);
  } else if (user.role === "superviseur") {
    scopeClause = `AND EXISTS (
      SELECT 1
      FROM inventory_team_members scope_tm
      INNER JOIN inventory_teams scope_t ON scope_t.id = scope_tm.team_id
      WHERE scope_tm.user_id = u.id AND scope_t.supervisor_user_id = ?
    )`;
    values.push(user.id);
  }

  const [rows] = await getPool().execute<AgentMetricRow[]>(
    `SELECT
       u.id,
       u.first_name AS firstName,
       u.last_name AS lastName,
       u.agent_code AS agentCode,
       t.code AS teamCode,
       t.name AS teamName,
       t.direction,
       COALESCE(c.cartons, 0) AS cartons,
       COALESCE(r.dossiers, 0) AS dossiers,
       COALESCE(c.degradedCartons, 0) AS degradedCartons,
       COALESCE(r.degradedDossiers, 0) AS degradedDossiers
     FROM users u
     LEFT JOIN inventory_team_members tm ON tm.user_id = u.id
     LEFT JOIN inventory_teams t ON t.id = tm.team_id
     LEFT JOIN (
       SELECT
         created_by,
         COUNT(*) AS cartons,
         SUM(carton_damaged = TRUE) AS degradedCartons
       FROM cartons
       WHERE created_at >= ? AND created_at < ?
       GROUP BY created_by
     ) c ON c.created_by = u.id
     LEFT JOIN (
       SELECT
         created_by,
         COUNT(*) AS dossiers,
         SUM(dossier_damaged = TRUE) AS degradedDossiers
       FROM inventory_records
       WHERE inventory_date >= ? AND inventory_date < ?
       GROUP BY created_by
     ) r ON r.created_by = u.id
     WHERE u.role = 'agent' AND u.is_active = TRUE
     ${scopeClause}
     ORDER BY dossiers DESC, cartons DESC, u.last_name, u.first_name`,
    values,
  );

  const agents = rows.map((row) => ({
    ...row,
    id: Number(row.id),
    cartons: Number(row.cartons),
    dossiers: Number(row.dossiers),
    degradedCartons: Number(row.degradedCartons),
    degradedDossiers: Number(row.degradedDossiers),
  }));
  const metrics = agents.reduce(
    (total, agent) => ({
      cartons: total.cartons + agent.cartons,
      dossiers: total.dossiers + agent.dossiers,
      degradedCartons: total.degradedCartons + agent.degradedCartons,
      degradedDossiers: total.degradedDossiers + agent.degradedDossiers,
    }),
    { cartons: 0, dossiers: 0, degradedCartons: 0, degradedDossiers: 0 },
  );

  return {
    period,
    range,
    ...scopeCopy(user),
    metrics,
    agents,
    maxDossiers: Math.max(1, ...agents.map((agent) => agent.dossiers)),
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
