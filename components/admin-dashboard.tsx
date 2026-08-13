import Link from "next/link";

import type { AdminDashboardData } from "@/services/admin-dashboard-service";

function percent(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

function AdminMetric({ label, value, helper, tone }: {
  label: string;
  value: number;
  helper: string;
  tone: "blue" | "green" | "amber" | "red";
}) {
  return (
    <article className={`admin-metric admin-metric-${tone}`}>
      <span>{label}</span>
      <strong>{value.toLocaleString("fr-FR")}</strong>
      <small>{helper}</small>
    </article>
  );
}

export function AdminDashboard({ data }: { data: AdminDashboardData }) {
  const { accounts, organisation, email, resend } = data;
  const emailCoverage = percent(accounts.usersWithEmail, accounts.totalUsers);
  const resendReady = resend.apiKeyConfigured && resend.fromEmailConfigured && resend.appUrlConfigured;
  const emailFeatureReady = resendReady && data.database.dailyReportsReady;

  return (
    <div className="admin-dashboard">
      <section className="admin-metrics-grid" aria-label="Indicateurs administrateur">
        <AdminMetric label="Comptes actifs" value={accounts.activeUsers} helper={`${accounts.inactiveUsers} compte(s) inactif(s)`} tone="blue" />
        <AdminMetric label="Agents" value={accounts.agents} helper={`${organisation.unassignedAgents} sans équipe`} tone="green" />
        <AdminMetric label="Équipes" value={organisation.teams} helper={`${organisation.assignments} affectation(s)`} tone="amber" />
        <AdminMetric
          label="Échecs e-mail"
          value={email.failed}
          helper={data.database.dailyReportsReady ? `${email.sent} rapport(s) envoyé(s)` : "Migration rapports requise"}
          tone="red"
        />
      </section>

      <div className="admin-dashboard-grid">
        <section className="card admin-dashboard-card admin-accounts-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Comptes et accès</p>
              <h2>Répartition des utilisateurs</h2>
            </div>
            <Link className="button button-primary" href="/admin/utilisateurs">Gérer les comptes</Link>
          </div>
          <div className="card-body">
            <div className="admin-role-grid">
              <div><span>Administrateurs</span><strong>{accounts.admins}</strong></div>
              <div><span>Agents</span><strong>{accounts.agents}</strong></div>
              <div><span>Superviseurs</span><strong>{accounts.supervisors}</strong></div>
              <div><span>Exécutifs</span><strong>{accounts.executives}</strong></div>
            </div>
            <div className="admin-readiness">
              <div><span>Comptes avec une adresse e-mail</span><strong>{emailCoverage} %</strong></div>
              <div className="admin-readiness-track" aria-label={`${emailCoverage} % des comptes ont un e-mail`}>
                <span style={{ width: `${emailCoverage}%` }} />
              </div>
              <small>{accounts.usersWithEmail} compte(s) sur {accounts.totalUsers}. Les agents et superviseurs doivent avoir un e-mail pour recevoir les rapports.</small>
            </div>
          </div>
        </section>

        <section className="card admin-dashboard-card admin-resend-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Messagerie transactionnelle</p>
              <h2>État de Resend</h2>
            </div>
            <span className={`badge ${emailFeatureReady ? "badge-active" : "badge-warning"}`}>
              {emailFeatureReady ? "Opérationnel" : data.database.dailyReportsReady ? "À compléter" : "Migration requise"}
            </span>
          </div>
          <div className="card-body">
            <dl className="admin-config-list">
              <div><dt>Tables rapports</dt><dd>{data.database.dailyReportsReady ? "Présentes" : "Migration 005 à appliquer"}</dd></div>
              <div><dt>Clé API</dt><dd>{resend.apiKeyConfigured ? "Présente" : "Manquante"}</dd></div>
              <div><dt>Expéditeur</dt><dd>{resend.fromEmail || "Non configuré"}</dd></div>
              <div><dt>URL publique</dt><dd>{resend.appUrl || "Non configurée"}</dd></div>
            </dl>
            <div className="admin-email-status-grid">
              <div><span>En attente de visa</span><strong>{email.pendingApproval}</strong></div>
              <div><span>À envoyer</span><strong>{email.waitingEmail}</strong></div>
              <div><span>Envoyés</span><strong>{email.sent}</strong></div>
              <div><span>Échoués</span><strong>{email.failed}</strong></div>
            </div>
            <p className="field-hint admin-dashboard-note">
              {data.database.dailyReportsReady
                ? "Le détail des échecs récents est affiché ci-dessous pour faciliter le diagnostic."
                : "Exécutez npm run db:migrate sur la base cible avant d’activer les signatures et les envois."}
            </p>
          </div>
        </section>

        <section className="card admin-dashboard-card admin-organisation-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Organisation</p>
              <h2>Prêt pour la production</h2>
            </div>
            <Link className="button button-secondary" href="/admin/equipes">Gérer les équipes</Link>
          </div>
          <div className="card-body admin-organisation-list">
            <div className={organisation.unassignedAgents ? "admin-attention-row" : "admin-ready-row"}>
              <span>Agents sans équipe</span><strong>{organisation.unassignedAgents}</strong>
            </div>
            <div className={organisation.unassignedSupervisors ? "admin-attention-row" : "admin-ready-row"}>
              <span>Superviseurs sans équipe</span><strong>{organisation.unassignedSupervisors}</strong>
            </div>
            <div className="admin-ready-row"><span>Affectations actives</span><strong>{organisation.assignments}</strong></div>
          </div>
        </section>

        <section className="card admin-dashboard-card admin-email-issues-card">
          <div className="card-header">
            <div>
              <p className="eyebrow">Derniers incidents</p>
              <h2>Échecs d’envoi</h2>
            </div>
          </div>
          <div className="card-body">
            {!data.database.dailyReportsReady ? (
              <div className="admin-migration-warning">
                <strong>Rapports non initialisés</strong>
                <p>La migration 005 créera les rapports signés, leur piste d’audit et le suivi Resend.</p>
                <code>npm run db:migrate</code>
              </div>
            ) : data.recentEmailIssues.length ? (
              <div className="admin-email-issues">
                {data.recentEmailIssues.map((issue) => (
                  <article key={issue.id}>
                    <div><strong>{issue.agentName}</strong><span>{issue.teamCode} · {issue.reportDate}</span></div>
                    <p>{issue.emailError}</p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="admin-empty-success">
                <span aria-hidden="true">✓</span>
                <div><strong>Aucun échec récent</strong><p>Les erreurs Resend apparaîtront ici avec leur message technique.</p></div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
