import "server-only";

import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { z } from "zod";

import { getPool } from "@/db/mysql";
import { conflict, notFound } from "@/lib/errors";
import type { teamSchema } from "@/lib/validation";
import type { InventoryDirection } from "@/types/domain";

export type TeamInput = z.infer<typeof teamSchema>;

type TeamRow = RowDataPacket & {
  id: number;
  code: string;
  name: string;
  direction: InventoryDirection;
  supervisorUserId: number;
  supervisorName: string;
  createdAt: string;
  updatedAt: string;
};

type TeamMemberRow = RowDataPacket & {
  teamId: number;
  userId: number;
  firstName: string;
  lastName: string;
  agentCode: string | null;
};

type UserRoleRow = RowDataPacket & {
  id: number;
  role: string;
  isActive: number;
};

type IdRow = RowDataPacket & { id: number };

type AgentTeamRow = RowDataPacket & {
  id: number;
  code: string;
  name: string;
  direction: InventoryDirection;
  supervisorName: string;
};

async function validateAssignments(
  connection: Awaited<ReturnType<ReturnType<typeof getPool>["getConnection"]>>,
  supervisorUserId: number,
  memberUserIds: number[],
) {
  const uniqueMemberIds = [...new Set(memberUserIds)];
  const ids = [supervisorUserId, ...uniqueMemberIds];
  const placeholders = ids.map(() => "?").join(", ");
  const [rows] = await connection.execute<UserRoleRow[]>(
    `SELECT id, role, is_active AS isActive FROM users WHERE id IN (${placeholders}) FOR UPDATE`,
    ids,
  );
  const users = new Map(rows.map((row) => [Number(row.id), row]));
  const supervisor = users.get(supervisorUserId);
  if (!supervisor?.isActive || supervisor.role !== "superviseur") {
    throw conflict("Le responsable sélectionné doit avoir un compte superviseur actif.");
  }
  const invalidMember = uniqueMemberIds.find((id) => {
    const member = users.get(id);
    return !member?.isActive || member.role !== "agent";
  });
  if (invalidMember) {
    throw conflict("Tous les membres de l’équipe doivent être des agents actifs.");
  }
  return uniqueMemberIds;
}

function rethrowTeamConflict(error: unknown): never {
  if (typeof error === "object" && error && "code" in error && error.code === "ER_DUP_ENTRY") {
    throw conflict("Le code ou le nom de l’équipe existe déjà, ou un agent appartient déjà à une autre équipe.");
  }
  throw error;
}

export async function listTeams() {
  const pool = getPool();
  const [teams] = await pool.query<TeamRow[]>(
    `SELECT
       t.id,
       t.code,
       t.name,
       t.direction,
       t.supervisor_user_id AS supervisorUserId,
       CONCAT(u.first_name, ' ', u.last_name) AS supervisorName,
       t.created_at AS createdAt,
       t.updated_at AS updatedAt
     FROM inventory_teams t
     INNER JOIN users u ON u.id = t.supervisor_user_id
     ORDER BY t.name`,
  );
  if (!teams.length) return [];

  const [members] = await pool.query<TeamMemberRow[]>(
    `SELECT
       tm.team_id AS teamId,
       u.id AS userId,
       u.first_name AS firstName,
       u.last_name AS lastName,
       u.agent_code AS agentCode
     FROM inventory_team_members tm
     INNER JOIN users u ON u.id = tm.user_id
     ORDER BY u.last_name, u.first_name`,
  );

  return teams.map((team) => ({
    ...team,
    id: Number(team.id),
    supervisorUserId: Number(team.supervisorUserId),
    members: members
      .filter((member) => Number(member.teamId) === Number(team.id))
      .map((member) => ({ ...member, teamId: Number(member.teamId), userId: Number(member.userId) })),
  }));
}

export async function getAgentInventoryTeam(userId: number) {
  const [rows] = await getPool().execute<AgentTeamRow[]>(
    `SELECT
       t.id,
       t.code,
       t.name,
       t.direction,
       CONCAT(supervisor.first_name, ' ', supervisor.last_name) AS supervisorName
     FROM inventory_team_members tm
     INNER JOIN inventory_teams t ON t.id = tm.team_id
     INNER JOIN users supervisor ON supervisor.id = t.supervisor_user_id
     WHERE tm.user_id = ?
     LIMIT 1`,
    [userId],
  );
  return rows[0] ? { ...rows[0], id: Number(rows[0].id) } : null;
}

export async function createTeam(input: TeamInput) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const memberUserIds = await validateAssignments(
      connection,
      input.supervisorUserId,
      input.memberUserIds,
    );
    const [result] = await connection.execute<ResultSetHeader>(
      "INSERT INTO inventory_teams (code, name, direction, supervisor_user_id) VALUES (?, ?, ?, ?)",
      [input.code, input.name, input.direction, input.supervisorUserId],
    );
    for (const userId of memberUserIds) {
      await connection.execute(
        "INSERT INTO inventory_team_members (team_id, user_id) VALUES (?, ?)",
        [result.insertId, userId],
      );
    }
    await connection.commit();
    return (await listTeams()).find((team) => team.id === result.insertId);
  } catch (error) {
    await connection.rollback();
    rethrowTeamConflict(error);
  } finally {
    connection.release();
  }
}

export async function updateTeam(id: number, input: TeamInput) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [teamRows] = await connection.execute<IdRow[]>(
      "SELECT id FROM inventory_teams WHERE id = ? FOR UPDATE",
      [id],
    );
    if (!teamRows[0]) throw notFound("Équipe introuvable.");

    const memberUserIds = await validateAssignments(
      connection,
      input.supervisorUserId,
      input.memberUserIds,
    );
    await connection.execute(
      "UPDATE inventory_teams SET code = ?, name = ?, direction = ?, supervisor_user_id = ? WHERE id = ?",
      [input.code, input.name, input.direction, input.supervisorUserId, id],
    );
    await connection.execute("DELETE FROM inventory_team_members WHERE team_id = ?", [id]);
    for (const userId of memberUserIds) {
      await connection.execute(
        "INSERT INTO inventory_team_members (team_id, user_id) VALUES (?, ?)",
        [id, userId],
      );
    }
    await connection.commit();
    return (await listTeams()).find((team) => team.id === id);
  } catch (error) {
    await connection.rollback();
    rethrowTeamConflict(error);
  } finally {
    connection.release();
  }
}
