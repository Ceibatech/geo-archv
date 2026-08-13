"use client";

import Link from "next/link";
import { useState, type ChangeEvent, type FormEvent } from "react";

import { INVENTORY_DIRECTIONS, type InventoryDirection } from "@/types/domain";

type TeamUser = {
  id: number;
  firstName: string;
  lastName: string;
  agentCode: string | null;
};

type TeamMember = Omit<TeamUser, "id"> & { teamId: number; userId: number };

type Team = {
  id: number;
  code: string;
  name: string;
  direction: InventoryDirection;
  supervisorUserId: number;
  supervisorName: string;
  members: TeamMember[];
};

function apiMessage(payload: { error?: { message?: string } }, fallback: string) {
  return payload.error?.message ?? fallback;
}

function MemberChecklist({
  agents,
  selectedIds,
  assignedTeamByUser,
  currentTeamId,
  onChange,
}: {
  agents: TeamUser[];
  selectedIds: number[];
  assignedTeamByUser: Map<number, number>;
  currentTeamId?: number;
  onChange?: (ids: number[]) => void;
}) {
  function toggle(userId: number, checked: boolean) {
    if (!onChange) return;
    onChange(checked ? [...selectedIds, userId] : selectedIds.filter((id) => id !== userId));
  }

  return (
    <div className="member-checklist">
      {agents.length ? agents.map((agent) => {
        const assignedTeamId = assignedTeamByUser.get(agent.id);
        const assignedElsewhere = assignedTeamId !== undefined && assignedTeamId !== currentTeamId;
        return (
          <label className={`member-option ${assignedElsewhere ? "member-option-disabled" : ""}`} key={agent.id}>
            <input
              type="checkbox"
              name="memberUserIds"
              value={agent.id}
              disabled={assignedElsewhere}
              {...(onChange
                ? {
                    checked: selectedIds.includes(agent.id),
                    onChange: (event: ChangeEvent<HTMLInputElement>) => toggle(agent.id, event.target.checked),
                  }
                : { defaultChecked: false })}
            />
            <span>
              <strong>{agent.firstName} {agent.lastName}</strong>
              <small>{agent.agentCode || "Sans code"}{assignedElsewhere ? " · Déjà affecté" : ""}</small>
            </span>
          </label>
        );
      }) : <p className="field-hint">Créez d’abord des comptes avec le rôle AGENT.</p>}
    </div>
  );
}

function TeamEditor({
  team,
  supervisors,
  agents,
  assignedTeamByUser,
  onUpdated,
}: {
  team: Team;
  supervisors: TeamUser[];
  agents: TeamUser[];
  assignedTeamByUser: Map<number, number>;
  onUpdated: (team: Team) => void;
}) {
  const [code, setCode] = useState(team.code);
  const [name, setName] = useState(team.name);
  const [direction, setDirection] = useState(team.direction);
  const [supervisorUserId, setSupervisorUserId] = useState(team.supervisorUserId);
  const [memberUserIds, setMemberUserIds] = useState(team.members.map((member) => member.userId));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function save() {
    if (pending) return;
    setPending(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/teams/${team.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name, direction, supervisorUserId, memberUserIds }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(apiMessage(payload, "Mise à jour impossible."));
      onUpdated(payload.data);
      setMessage("Équipe mise à jour.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Mise à jour impossible.");
    } finally {
      setPending(false);
    }
  }

  return (
    <article className="card team-card">
      <div className="card-header">
        <div>
          <h2>{team.name}</h2>
          <span className="field-hint">{team.code} · {team.direction} · {team.members.length} agent{team.members.length > 1 ? "s" : ""}</span>
        </div>
        <button className="button button-primary" type="button" onClick={save} disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
      <div className="card-body team-editor-grid">
        {error && <p className="message message-error field-full" role="alert">{error}</p>}
        {message && <p className="message message-success field-full" role="status">{message}</p>}
        <div className="team-settings">
          <div className="field">
            <label htmlFor={`team-code-${team.id}`}>Code équipe</label>
            <input
              id={`team-code-${team.id}`}
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              maxLength={30}
              placeholder="DCM-01"
              required
            />
          </div>
          <div className="field">
            <label htmlFor={`team-name-${team.id}`}>Nom de l’équipe</label>
            <input id={`team-name-${team.id}`} value={name} onChange={(event) => setName(event.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor={`team-direction-${team.id}`}>Direction d’inventaire</label>
            <select
              id={`team-direction-${team.id}`}
              value={direction}
              onChange={(event) => setDirection(event.target.value as InventoryDirection)}
              required
            >
              {INVENTORY_DIRECTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor={`team-supervisor-${team.id}`}>Superviseur responsable</label>
            <select
              id={`team-supervisor-${team.id}`}
              value={supervisorUserId}
              onChange={(event) => setSupervisorUserId(Number(event.target.value))}
            >
              {supervisors.map((supervisor) => (
                <option key={supervisor.id} value={supervisor.id}>{supervisor.firstName} {supervisor.lastName}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <span className="field-label">Agents de l’équipe</span>
          <MemberChecklist
            agents={agents}
            selectedIds={memberUserIds}
            assignedTeamByUser={assignedTeamByUser}
            currentTeamId={team.id}
            onChange={setMemberUserIds}
          />
        </div>
      </div>
    </article>
  );
}

export function TeamAdmin({
  initialTeams,
  supervisors,
  agents,
}: {
  initialTeams: Team[];
  supervisors: TeamUser[];
  agents: TeamUser[];
}) {
  const [teams, setTeams] = useState(initialTeams);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const assignedTeamByUser = new Map(
    teams.flatMap((team) => team.members.map((member) => [member.userId, team.id] as const)),
  );

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    setSuccess("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.get("code"),
          name: form.get("name"),
          direction: form.get("direction"),
          supervisorUserId: Number(form.get("supervisorUserId")),
          memberUserIds: form.getAll("memberUserIds").map(Number),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(apiMessage(payload, "Création impossible."));
      setTeams((current) => [...current, payload.data].sort((a, b) => a.name.localeCompare(b.name)));
      formElement.reset();
      setSuccess("Équipe créée avec succès.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Création impossible.");
    } finally {
      setPending(false);
    }
  }

  function updateTeam(updated: Team) {
    setTeams((current) => current.map((team) => team.id === updated.id ? updated : team));
  }

  return (
    <div className="team-admin-layout">
      <section className="card">
        <div className="card-header"><h2>Nouvelle équipe</h2></div>
        <div className="card-body">
          <form className="compact-form" onSubmit={create}>
              {error && <p className="message message-error" role="alert">{error}</p>}
              {success && <p className="message message-success" role="status">{success}</p>}
              {!supervisors.length ? (
                <p className="message message-warning">
                  Créez d’abord un compte avec le rôle SUPERVISEUR dans <Link href="/admin/utilisateurs">Utilisateurs</Link>.
                </p>
              ) : null}
              <div className="field">
                <label htmlFor="team-code">Code équipe *</label>
                <input
                  id="team-code"
                  name="code"
                  maxLength={30}
                  pattern="[a-zA-Z0-9._/-]+"
                  placeholder="DCM-01"
                  required
                />
                <p className="field-hint">Code unique lié à la direction où l’inventaire est réalisé.</p>
              </div>
              <div className="field">
                <label htmlFor="team-name">Nom de l’équipe *</label>
                <input id="team-name" name="name" maxLength={120} required />
              </div>
              <div className="field">
                <label htmlFor="team-direction">Direction d’inventaire *</label>
                <select id="team-direction" name="direction" defaultValue="DCM" required>
                  {INVENTORY_DIRECTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <p className="field-hint">DCM, DEMA, SDA, DTC, DAJC, DDU, DGUF, SBICU ou GUF.</p>
              </div>
              <div className="field">
                <label htmlFor="team-supervisor">Superviseur responsable *</label>
                <select id="team-supervisor" name="supervisorUserId" required disabled={!supervisors.length}>
                  {!supervisors.length ? <option value="">Aucun superviseur disponible</option> : null}
                  {supervisors.map((supervisor) => (
                    <option key={supervisor.id} value={supervisor.id}>{supervisor.firstName} {supervisor.lastName}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <span className="field-label">Agents à affecter</span>
                <MemberChecklist
                  agents={agents}
                  selectedIds={[]}
                  assignedTeamByUser={assignedTeamByUser}
                />
                <p className="field-hint">
                  Un agent manque ? <Link href="/admin/utilisateurs">Créer son compte AGENT</Link>.
                </p>
              </div>
              <button className="button button-primary button-block" type="submit" disabled={pending || !supervisors.length}>
                {pending ? "Création…" : "Créer l’équipe"}
              </button>
          </form>
        </div>
      </section>

      <div className="team-list">
        {teams.length ? teams.map((team) => (
          <TeamEditor
            key={team.id}
            team={team}
            supervisors={supervisors}
            agents={agents}
            assignedTeamByUser={assignedTeamByUser}
            onUpdated={updateTeam}
          />
        )) : (
          <section className="card empty-state"><div><strong>Aucune équipe</strong><p>Créez la première équipe et affectez-lui des agents.</p></div></section>
        )}
      </div>
    </div>
  );
}
