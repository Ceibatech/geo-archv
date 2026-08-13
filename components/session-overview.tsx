import type { AuthUser } from "@/types/domain";

const rolePresentation = {
  admin: {
    label: "Administrateur",
    scope: "Comptes, rôles, équipes et configuration de la plateforme",
    tone: "navy",
  },
  agent: {
    label: "Agent d’inventaire",
    scope: "Saisie mobile, production personnelle et rapport journalier",
    tone: "blue",
  },
  superviseur: {
    label: "Superviseur",
    scope: "Pilotage de l’équipe et validation des rapports signés",
    tone: "green",
  },
  executif: {
    label: "Exécutif",
    scope: "Vision consolidée de toutes les directions d’inventaire",
    tone: "amber",
  },
} as const;

export function SessionOverview({ user }: { user: AuthUser }) {
  const presentation = rolePresentation[user.role];
  const identity = user.agentCode || user.email || `@${user.login}`;

  return (
    <section className={`session-overview session-overview-${presentation.tone}`} aria-label="Session active">
      <div className="session-overview-status">
        <span className="session-live-dot" aria-hidden="true" />
        Session sécurisée active
      </div>
      <div className="session-overview-main">
        <span className="session-overview-avatar" aria-hidden="true">
          {user.firstName.charAt(0)}{user.lastName.charAt(0)}
        </span>
        <div>
          <span>Bienvenue dans votre espace</span>
          <strong>{user.firstName} {user.lastName}</strong>
        </div>
      </div>
      <div className="session-overview-role">
        <span>{presentation.label}</span>
        <strong>{presentation.scope}</strong>
      </div>
      <div className="session-overview-identity">
        <span>Compte connecté</span>
        <strong>{identity}</strong>
      </div>
    </section>
  );
}
