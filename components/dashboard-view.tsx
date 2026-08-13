import Link from "next/link";

import { ProductionTracking } from "@/components/production-tracking";
import type { DashboardData, DashboardPeriod } from "@/services/dashboard-service";
import type { Role } from "@/types/domain";

const periodLabels: Record<DashboardPeriod, string> = {
  day: "Aujourd’hui",
  week: "Cette semaine",
  month: "Ce mois",
};

function rate(value: number, total: number) {
  if (!total) return "0 %";
  return `${Math.round((value / total) * 100)} %`;
}

function MetricCard({
  label,
  value,
  helper,
  tone = "blue",
}: {
  label: string;
  value: number;
  helper: string;
  tone?: "blue" | "green" | "amber" | "red";
}) {
  return (
    <article className={`kpi-card kpi-card-${tone}`}>
      <span>{label}</span>
      <strong>{value.toLocaleString("fr-FR")}</strong>
      <small>{helper}</small>
    </article>
  );
}

export function DashboardView({ data, role }: { data: DashboardData; role: Role }) {
  const { metrics } = data;

  return (
    <>
      <div className="dashboard-toolbar">
        <div className="period-tabs" aria-label="Période du tableau de bord">
          {(Object.keys(periodLabels) as DashboardPeriod[]).map((period) => (
            <Link
              className={data.period === period ? "period-tab period-tab-active" : "period-tab"}
              href={`/dashboard?period=${period}`}
              aria-current={data.period === period ? "page" : undefined}
              key={period}
            >
              {periodLabels[period]}
            </Link>
          ))}
        </div>
        <span className="dashboard-range">{data.range.label}</span>
      </div>

      <section className="kpi-grid" aria-label="Indicateurs principaux">
        <MetricCard label="Nombre de cartons" value={metrics.cartons} helper="Cartons créés sur la période" />
        <MetricCard label="Nombre de dossiers" value={metrics.dossiers} helper="Fiches enregistrées" tone="green" />
        <MetricCard
          label="Cartons dégradés"
          value={metrics.degradedCartons}
          helper={`${rate(metrics.degradedCartons, metrics.cartons)} des cartons`}
          tone="amber"
        />
        <MetricCard
          label="Dossiers dégradés"
          value={metrics.degradedDossiers}
          helper={`${rate(metrics.degradedDossiers, metrics.dossiers)} des dossiers`}
          tone="red"
        />
      </section>

      {role === "superviseur" || role === "executif" ? <ProductionTracking data={data} /> : null}

      <div className="dashboard-analysis-grid">
        <section className="card dashboard-chart-card">
          <div className="card-header">
            <div>
              <h2>Production par agent</h2>
              <span className="field-hint">Nombre de dossiers enregistrés</span>
            </div>
          </div>
          <div className="card-body agent-bars">
            {data.agents.length ? data.agents.map((agent) => (
              <div className="agent-bar-row" key={agent.id}>
                <div className="agent-bar-label">
                  <strong>{agent.firstName} {agent.lastName}</strong>
                  <span>
                    {agent.agentCode || "Sans code"}
                    {agent.teamCode ? ` · ${agent.teamCode}` : ""}
                    {agent.direction ? ` · ${agent.direction}` : ""}
                  </span>
                </div>
                <div className="agent-bar-track" aria-label={`${agent.dossiers} dossiers`}>
                  <span style={{ width: `${(agent.dossiers / data.maxDossiers) * 100}%` }} />
                </div>
                <strong className="agent-bar-value">{agent.dossiers}</strong>
              </div>
            )) : (
              <div className="empty-state dashboard-empty"><div><strong>Aucun agent dans ce périmètre</strong><p>L’administrateur doit affecter les agents à une équipe.</p></div></div>
            )}
          </div>
        </section>

        <aside className="card scope-card">
          <div className="card-header"><h2>Périmètre visible</h2></div>
          <div className="card-body">
            <span className="scope-role">{role === "agent" ? "Agent" : role === "superviseur" ? "Superviseur" : "Exécutif"}</span>
            <strong>{data.title}</strong>
            <p>{data.description}</p>
            <dl className="scope-definition">
              <div><dt>Période</dt><dd>{periodLabels[data.period]}</dd></div>
              <div><dt>Agents visibles</dt><dd>{data.agents.length}</dd></div>
              <div>
                <dt>Directions</dt>
                <dd>{new Set(data.agents.map((agent) => agent.direction).filter(Boolean)).size || "Non définie"}</dd>
              </div>
              <div><dt>Source</dt><dd>Données CG1020 en direct</dd></div>
            </dl>
          </div>
        </aside>
      </div>

      <section className="card dashboard-agent-table">
        <div className="card-header">
          <div>
            <h2>Détail par agent</h2>
            <span className="field-hint">Les totaux de ce tableau correspondent aux cartes ci-dessus.</span>
          </div>
        </div>
        {data.agents.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Code équipe</th>
                  <th>Direction</th>
                  <th>Cartons</th>
                  <th>Dossiers</th>
                  <th>Cartons dégradés</th>
                  <th>Dossiers dégradés</th>
                </tr>
              </thead>
              <tbody>
                {data.agents.map((agent) => (
                  <tr key={agent.id}>
                    <td><span className="primary-cell">{agent.firstName} {agent.lastName}</span><br /><span className="field-hint">{agent.agentCode || "—"}</span></td>
                    <td>
                      <span className="primary-cell">{agent.teamCode || "Non affecté"}</span>
                      {agent.teamName ? <><br /><span className="field-hint">{agent.teamName}</span></> : null}
                    </td>
                    <td>{agent.direction || "—"}</td>
                    <td>{agent.cartons}</td>
                    <td className="primary-cell">{agent.dossiers}</td>
                    <td>{agent.degradedCartons}</td>
                    <td>{agent.degradedDossiers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </>
  );
}
