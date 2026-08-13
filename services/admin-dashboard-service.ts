import "server-only";

import type { RowDataPacket } from "mysql2/promise";

import { getPool } from "@/db/mysql";

type AccountMetricsRow = RowDataPacket & {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  usersWithEmail: number;
  admins: number;
  agents: number;
  supervisors: number;
  executives: number;
};

type OrganisationMetricsRow = RowDataPacket & {
  teams: number;
  assignments: number;
  unassignedAgents: number;
  unassignedSupervisors: number;
};

type EmailMetricsRow = RowDataPacket & {
  reports: number;
  pendingApproval: number;
  sent: number;
  failed: number;
  waitingEmail: number;
};

type EmailIssue = {
  id: number;
  reportDate: string;
  agentName: string;
  teamCode: string;
  emailError: string;
  updatedAt: string;
};

type EmailIssueRow = RowDataPacket & EmailIssue;

type SchemaMetricsRow = RowDataPacket & {
  dailyReportsReady: number;
};

function numericRecord<T extends Record<string, unknown>>(row: T) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, Number(value ?? 0)]),
  ) as { [K in keyof T]: number };
}

export async function getAdminDashboardData() {
  const pool = getPool();
  const [accountsResult, organisationResult, schemaResult] = await Promise.all([
    pool.query<AccountMetricsRow[]>(
      `SELECT
         COUNT(*) AS totalUsers,
         SUM(is_active = TRUE) AS activeUsers,
         SUM(is_active = FALSE) AS inactiveUsers,
         SUM(email IS NOT NULL AND email <> '') AS usersWithEmail,
         SUM(role = 'admin') AS admins,
         SUM(role = 'agent') AS agents,
         SUM(role = 'superviseur') AS supervisors,
         SUM(role = 'executif') AS executives
       FROM users`,
    ),
    pool.query<OrganisationMetricsRow[]>(
      `SELECT
         (SELECT COUNT(*) FROM inventory_teams) AS teams,
         (SELECT COUNT(*) FROM inventory_team_members) AS assignments,
         (SELECT COUNT(*)
          FROM users u
          WHERE u.role = 'agent' AND u.is_active = TRUE
            AND NOT EXISTS (SELECT 1 FROM inventory_team_members tm WHERE tm.user_id = u.id)) AS unassignedAgents,
         (SELECT COUNT(*)
          FROM users u
          WHERE u.role = 'superviseur' AND u.is_active = TRUE
            AND NOT EXISTS (SELECT 1 FROM inventory_teams t WHERE t.supervisor_user_id = u.id)) AS unassignedSupervisors`,
    ),
    pool.query<SchemaMetricsRow[]>(
      `SELECT COUNT(*) AS dailyReportsReady
       FROM information_schema.tables
       WHERE table_schema = DATABASE()
         AND table_name IN ('daily_reports', 'daily_report_events')`,
    ),
  ]);

  const accounts = numericRecord(accountsResult[0][0] ?? {} as AccountMetricsRow);
  const organisation = numericRecord(organisationResult[0][0] ?? {} as OrganisationMetricsRow);
  const dailyReportsReady = Number(schemaResult[0][0]?.dailyReportsReady ?? 0) === 2;
  let email = {
    reports: 0,
    pendingApproval: 0,
    sent: 0,
    failed: 0,
    waitingEmail: 0,
  };
  let recentEmailIssues: EmailIssue[] = [];

  if (dailyReportsReady) {
    const [emailResult, issuesResult] = await Promise.all([
      pool.query<EmailMetricsRow[]>(
        `SELECT
           COUNT(*) AS reports,
           SUM(status = 'PENDING_SUPERVISOR') AS pendingApproval,
           SUM(email_status = 'SENT') AS sent,
           SUM(email_status = 'FAILED') AS failed,
           SUM(status = 'APPROVED' AND email_status = 'NOT_SENT') AS waitingEmail
         FROM daily_reports`,
      ),
      pool.query<EmailIssueRow[]>(
        `SELECT
           r.id,
           r.report_date AS reportDate,
           CONCAT(agent.first_name, ' ', agent.last_name) AS agentName,
           r.team_code AS teamCode,
           r.email_error AS emailError,
           r.updated_at AS updatedAt
         FROM daily_reports r
         INNER JOIN users agent ON agent.id = r.agent_user_id
         WHERE r.email_status = 'FAILED'
         ORDER BY r.updated_at DESC
         LIMIT 5`,
      ),
    ]);
    email = numericRecord(emailResult[0][0] ?? {} as EmailMetricsRow);
    recentEmailIssues = issuesResult[0].map((issue) => ({
      id: Number(issue.id),
      reportDate: issue.reportDate,
      agentName: issue.agentName,
      teamCode: issue.teamCode,
      emailError: issue.emailError,
      updatedAt: issue.updatedAt,
    }));
  }

  return {
    accounts,
    organisation,
    email,
    recentEmailIssues,
    database: { dailyReportsReady },
    resend: {
      apiKeyConfigured: Boolean(process.env.RESEND_API_KEY?.trim()),
      fromEmailConfigured: Boolean(process.env.RESEND_FROM_EMAIL?.trim()),
      fromEmail: process.env.RESEND_FROM_EMAIL?.trim() || null,
      appUrlConfigured: Boolean(process.env.APP_URL?.trim()),
      appUrl: process.env.APP_URL?.trim() || null,
    },
  };
}

export type AdminDashboardData = Awaited<ReturnType<typeof getAdminDashboardData>>;
