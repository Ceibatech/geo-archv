"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState, type FormEvent } from "react";

import type { Role } from "@/types/domain";

type AdminUser = {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  login: string;
  agentCode: string | null;
  role: Role;
  isActive: boolean;
};

type TeamAssignment = {
  userId: number;
  teamCode: string;
  teamName: string;
  direction: string;
  relation: "agent" | "superviseur";
};

type AccountFilter = "all" | Role | "inactive";

const roleLabels: Record<Role, string> = {
  admin: "Administrateur",
  agent: "Agent",
  superviseur: "Superviseur",
  executif: "Exécutif",
};

function apiMessage(payload: { error?: { message?: string } }, fallback: string) {
  return payload.error?.message ?? fallback;
}

function UserEditor({
  user,
  assignments,
  onUpdated,
}: {
  user: AdminUser;
  assignments: TeamAssignment[];
  onUpdated: (user: AdminUser) => void;
}) {
  const router = useRouter();
  const [role, setRole] = useState(user.role);
  const [agentCode, setAgentCode] = useState(user.agentCode ?? "");
  const [isActive, setIsActive] = useState(user.isActive);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          agentCode: role === "agent" ? agentCode : "",
          isActive,
          ...(password ? { password } : {}),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(apiMessage(payload, "Mise à jour impossible."));
      onUpdated(payload.data);
      setPassword("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Mise à jour impossible.");
    } finally {
      setPending(false);
    }
  }

  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
  const needsAssignment = role === "agent" || role === "superviseur";

  return (
    <article className={`admin-user-card ${isActive ? "is-active" : "is-inactive"}`}>
      <header className="admin-user-card-header">
        <span className="admin-user-avatar" aria-hidden="true">{initials}</span>
        <div className="admin-user-identity">
          <div>
            <strong>{user.firstName} {user.lastName}</strong>
            <span className={`badge ${isActive ? "badge-active" : "badge-inactive"}`}>
              {isActive ? "Actif" : "Inactif"}
            </span>
          </div>
          <p>@{user.login} · {user.email || "aucune adresse e-mail"}</p>
        </div>
        <span className={`admin-role-badge admin-role-${role}`}>{roleLabels[role]}</span>
      </header>

      {error ? <p className="message message-error admin-user-error" role="alert">{error}</p> : null}

      <div className="admin-user-editor-grid">
        <div className="field">
          <label htmlFor={`role-${user.id}`}>Rôle et permissions</label>
          <select id={`role-${user.id}`} value={role} onChange={(event) => setRole(event.target.value as Role)}>
            <option value="admin">Administrateur</option>
            <option value="agent">Agent</option>
            <option value="superviseur">Superviseur</option>
            <option value="executif">Exécutif</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor={`active-${user.id}`}>État du compte</label>
          <select id={`active-${user.id}`} value={String(isActive)} onChange={(event) => setIsActive(event.target.value === "true")}>
            <option value="true">Compte actif</option>
            <option value="false">Compte inactif</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor={`code-${user.id}`}>Code agent</label>
          {role === "agent" ? (
            <input
              id={`code-${user.id}`}
              value={agentCode}
              onChange={(event) => setAgentCode(event.target.value)}
              placeholder="AG007"
              required
            />
          ) : (
            <span className="user-field-not-applicable">Non applicable à ce rôle</span>
          )}
        </div>
        <div className="field">
          <label htmlFor={`password-${user.id}`}>Réinitialiser le mot de passe</label>
          <input
            id={`password-${user.id}`}
            type="password"
            minLength={10}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Laisser vide pour conserver"
          />
        </div>
        <div className="field admin-user-team-field">
          <span className="field-label">Équipe et direction</span>
          {assignments.length ? assignments.map((assignment) => (
            <span className="user-team-assignment" key={`${assignment.teamCode}-${assignment.relation}`}>
              <strong>{assignment.teamCode}</strong>
              <small>{assignment.teamName} · {assignment.direction}</small>
            </span>
          )) : needsAssignment ? (
            <Link className="user-team-empty" href="/admin/equipes">Affecter ce compte à une équipe →</Link>
          ) : (
            <span className="user-field-not-applicable">Accès transversal, sans équipe</span>
          )}
        </div>
        <button className="button button-primary admin-user-save" type="button" onClick={save} disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer les modifications"}
        </button>
      </div>
    </article>
  );
}

export function UserAdmin({
  initialUsers,
  teamAssignments,
}: {
  initialUsers: AdminUser[];
  teamAssignments: TeamAssignment[];
}) {
  const [users, setUsers] = useState(initialUsers);
  const [role, setRole] = useState<Role>("agent");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AccountFilter>("all");
  const deferredQuery = useDeferredValue(query);
  const assignmentsByUser = useMemo(() => {
    const assignments = new Map<number, TeamAssignment[]>();
    for (const assignment of teamAssignments) {
      assignments.set(assignment.userId, [
        ...(assignments.get(assignment.userId) ?? []),
        assignment,
      ]);
    }
    return assignments;
  }, [teamAssignments]);
  const accountSummary = useMemo(() => {
    const summary = { active: 0, inactive: 0, withEmail: 0, agents: 0 };
    for (const user of users) {
      if (user.isActive) summary.active += 1;
      else summary.inactive += 1;
      if (user.email) summary.withEmail += 1;
      if (user.role === "agent") summary.agents += 1;
    }
    return summary;
  }, [users]);
  const filteredUsers = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLocaleLowerCase("fr");
    return users.filter((user) => {
      const matchesFilter = filter === "all"
        || (filter === "inactive" ? !user.isActive : user.role === filter);
      const searchable = `${user.firstName} ${user.lastName} ${user.login} ${user.email ?? ""} ${user.agentCode ?? ""}`
        .toLocaleLowerCase("fr");
      return matchesFilter && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [deferredQuery, filter, users]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    setSuccess("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.get("firstName"),
          lastName: form.get("lastName"),
          email: form.get("email"),
          login: form.get("login"),
          password: form.get("password"),
          agentCode: role === "agent" ? form.get("agentCode") : "",
          role,
          isActive: true,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(apiMessage(payload, "Création impossible."));
      setUsers((current) => [...current, payload.data].sort((a, b) => a.lastName.localeCompare(b.lastName)));
      formElement.reset();
      setRole("agent");
      setSuccess("Utilisateur créé avec succès.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Création impossible.");
    } finally {
      setPending(false);
    }
  }

  function updateInList(updated: AdminUser) {
    setUsers((current) => current.map((user) => (user.id === updated.id ? updated : user)));
  }

  return (
    <div className="admin-grid">
      <section className="card">
        <div className="card-header"><h2>Nouvel utilisateur</h2></div>
        <div className="card-body">
          <form className="compact-form" onSubmit={create}>
            {error && <p className="message message-error" role="alert">{error}</p>}
            {success && <p className="message message-success" role="status">{success}</p>}
            <div className="form-grid">
              <div className="field"><label htmlFor="lastName">Nom *</label><input id="lastName" name="lastName" required /></div>
              <div className="field"><label htmlFor="firstName">Prénoms *</label><input id="firstName" name="firstName" required /></div>
            </div>
            <div className="field"><label htmlFor="email">E-mail</label><input id="email" name="email" type="email" /></div>
            <div className="field"><label htmlFor="login">Identifiant *</label><input id="login" name="login" minLength={3} pattern="[a-zA-Z0-9._-]+" required /></div>
            <div className="field"><label htmlFor="password">Mot de passe initial *</label><input id="password" name="password" type="password" minLength={10} required /></div>
            <div className="field">
              <label htmlFor="role">Rôle *</label>
              <select id="role" name="role" value={role} onChange={(event) => setRole(event.target.value as Role)}>
                <option value="agent">AGENT</option>
                <option value="superviseur">SUPERVISEUR</option>
                <option value="admin">ADMIN</option>
                <option value="executif">EXÉCUTIF</option>
              </select>
            </div>
            {role === "agent" ? (
              <div className="field">
                <label htmlFor="agentCode">Code agent *</label>
                <input id="agentCode" name="agentCode" required placeholder="AG007" />
              </div>
            ) : null}
            {role === "superviseur" ? (
              <p className="role-assignment-note">
                Après création, choisissez ce superviseur dans <Link href="/admin/equipes">Équipes et accès</Link>, puis complétez le code équipe et la direction.
              </p>
            ) : role === "agent" ? (
              <p className="role-assignment-note">
                Après création, rattachez l’agent à l’équipe correspondant à sa direction d’inventaire.
              </p>
            ) : null}
            <button className="button button-primary button-block" type="submit" disabled={pending}>
              {pending ? "Création…" : "Créer l’utilisateur"}
            </button>
          </form>
        </div>
      </section>

      <section className="admin-accounts-panel">
        <div className="admin-account-summary" aria-label="Résumé des comptes">
          <div><span>Total</span><strong>{users.length}</strong></div>
          <div><span>Actifs</span><strong>{accountSummary.active}</strong></div>
          <div><span>Agents</span><strong>{accountSummary.agents}</strong></div>
          <div><span>Avec e-mail</span><strong>{accountSummary.withEmail}</strong></div>
        </div>

        <div className="admin-users-toolbar">
          <div className="field admin-users-search">
            <label htmlFor="account-search">Rechercher un compte</label>
            <input
              id="account-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nom, identifiant, e-mail ou code agent"
            />
          </div>
          <div className="field admin-users-filter">
            <label htmlFor="account-filter">Filtrer</label>
            <select id="account-filter" value={filter} onChange={(event) => setFilter(event.target.value as AccountFilter)}>
              <option value="all">Tous les comptes</option>
              <option value="agent">Agents</option>
              <option value="superviseur">Superviseurs</option>
              <option value="admin">Administrateurs</option>
              <option value="executif">Exécutifs</option>
              <option value="inactive">Comptes inactifs ({accountSummary.inactive})</option>
            </select>
          </div>
        </div>

        <div className="admin-users-results" aria-busy={query !== deferredQuery}>
          <div className="admin-users-results-heading">
            <div><h2>Comptes</h2><p>{filteredUsers.length} résultat(s) · les comptes sont désactivés, jamais supprimés.</p></div>
            <Link className="admin-inline-link" href="/admin/equipes">Gérer les affectations →</Link>
          </div>
          {filteredUsers.length ? filteredUsers.map((user) => (
            <UserEditor
              key={user.id}
              user={user}
              assignments={assignmentsByUser.get(user.id) ?? []}
              onUpdated={updateInList}
            />
          )) : (
            <div className="admin-users-empty"><strong>Aucun compte trouvé</strong><p>Modifiez la recherche ou le filtre sélectionné.</p></div>
          )}
        </div>
      </section>
    </div>
  );
}
