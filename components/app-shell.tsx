import Image from "next/image";
import Link from "next/link";

import { LogoutButton } from "@/components/logout-button";
import type { AuthUser } from "@/types/domain";

const roleLabels = {
  admin: "Administrateur",
  agent: "Agent",
  superviseur: "Superviseur",
  executif: "Exécutif",
} as const;

const roleContexts = {
  admin: "Configuration de la plateforme",
  agent: "Mon espace de production",
  superviseur: "Pilotage de mon équipe",
  executif: "Vision globale de l’inventaire",
} as const;

export function AppShell({
  user,
  active,
  title,
  children,
}: {
  user: AuthUser;
  active: "dashboard" | "inventaire" | "fiches" | "rapports" | "utilisateurs" | "equipes";
  title: string;
  children: React.ReactNode;
}) {
  const links = user.role === "admin"
    ? [
        { key: "dashboard", href: "/admin", symbol: "TB", label: "Tableau de bord" },
        { key: "utilisateurs", href: "/admin/utilisateurs", symbol: "UT", label: "Utilisateurs" },
        { key: "equipes", href: "/admin/equipes", symbol: "EQ", label: "Équipes et accès" },
      ]
    : user.role === "agent"
      ? [
          { key: "dashboard", href: "/dashboard", symbol: "TB", label: "Tableau de bord" },
          { key: "inventaire", href: "/inventaire", symbol: "SA", label: "Nouvelle fiche" },
          { key: "fiches", href: "/inventaire/mes-fiches", symbol: "FI", label: "Mes fiches" },
          { key: "rapports", href: "/rapports", symbol: "RP", label: "Rapport journalier" },
        ]
      : [
          { key: "dashboard", href: "/dashboard", symbol: "TB", label: "Tableau de bord" },
          { key: "rapports", href: "/rapports", symbol: "RP", label: "Rapports signés" },
        ];
  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();

  return (
    <div className={`app-layout app-layout-${user.role}`}>
      <aside className="sidebar">
        <span className="sidebar-accent sidebar-accent-one" aria-hidden="true" />
        <span className="sidebar-accent sidebar-accent-two" aria-hidden="true" />
        <div className="brand-lockup">
          <div className="brand-logo-card brand-logo-sidebar">
            <Image
              className="brand-logo-image"
              src="/ceibac.jpg"
              alt="CEIBA Analytics"
              width={345}
              height={188}
              priority
            />
          </div>
          <div>
            <div className="brand-name">Archives CG1020</div>
            <div className="brand-subtitle">MULCV · Centre de pilotage</div>
          </div>
        </div>
        <div className="nav-label">Espace de travail</div>
        <nav className="nav-list" aria-label="Navigation principale">
          {links.map((link) => (
            <Link
              className={`nav-link ${active === link.key ? "nav-link-active" : ""}`}
              href={link.href}
              key={link.key}
              aria-current={active === link.key ? "page" : undefined}
            >
              <span className="nav-symbol" aria-hidden="true">{link.symbol}</span>
              <span className="nav-link-label">{link.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-block">
            <span className="user-avatar" aria-hidden="true">{initials}</span>
            <div className="user-block-copy">
              <div className="user-name">{user.firstName} {user.lastName}</div>
              <div className="user-role">
                {roleLabels[user.role]}{user.agentCode ? ` · ${user.agentCode}` : ""}
              </div>
            </div>
          </div>
          <p className="sidebar-context">{roleContexts[user.role]}</p>
          <div className="sidebar-session-live"><span aria-hidden="true" /> Session sécurisée</div>
        </div>
      </aside>

      <div className="app-main">
        <span className="app-backdrop app-backdrop-one" aria-hidden="true" />
        <span className="app-backdrop app-backdrop-two" aria-hidden="true" />
        <header className="topbar">
          <div className="topbar-context">
            <div className="topbar-mobile-logo" aria-hidden="true">
              <Image src="/ceibac.jpg" alt="" width={345} height={188} />
            </div>
            <div>
              <div className="topbar-title">{title}</div>
              <div className="topbar-meta">{roleContexts[user.role]}</div>
            </div>
          </div>
          <div className="topbar-actions">
            <span className={`topbar-role-chip topbar-role-${user.role}`}>{roleLabels[user.role]}</span>
            <div className="topbar-user">
              <span className="topbar-status-dot" aria-hidden="true" />
              <span className="user-avatar user-avatar-small" aria-hidden="true">{initials}</span>
              <span className="topbar-user-copy">
                <strong>{user.firstName} {user.lastName}</strong>
                <small>{roleLabels[user.role]}</small>
              </span>
            </div>
            <LogoutButton />
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
