import type { DashboardData } from "@/services/dashboard-service";

type MetricKey = "cartons" | "dossiers" | "degradedCartons" | "degradedDossiers";

const productionRows: Array<{ number: number; key: MetricKey; label: string }> = [
  { number: 1, key: "cartons", label: "Nombre de cartons" },
  { number: 2, key: "dossiers", label: "Nombre de dossiers" },
  { number: 3, key: "degradedCartons", label: "Nombre de cartons dégradés" },
  { number: 4, key: "degradedDossiers", label: "Nombre de dossiers dégradés" },
];

function percentage(value: number, total: number) {
  if (!total) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}

function QualityBar({
  total,
  damaged,
  kind,
}: {
  total: number;
  damaged: number;
  kind: "carton" | "dossier";
}) {
  const damagedRate = percentage(damaged, total);
  const goodRate = total ? 100 - damagedRate : 0;
  const kindLabel = kind === "carton" ? "Cartons" : "Dossiers";

  return (
    <div className="quality-bar-unit">
      <div
        className={`quality-bar quality-bar-${kind} ${total ? "" : "quality-bar-empty"}`}
        aria-label={`${kindLabel} : ${goodRate} % en bon état, ${damagedRate} % dégradés`}
        title={`${kindLabel} · ${damagedRate} % dégradés (${damaged}/${total})`}
      >
        {total ? (
          <>
            <span className="quality-segment quality-segment-good" style={{ height: `${goodRate}%` }} />
            <span className="quality-segment quality-segment-damaged" style={{ height: `${damagedRate}%` }} />
          </>
        ) : <span className="quality-zero">0</span>}
      </div>
      <strong>{kind === "carton" ? "C" : "D"}</strong>
      <small>{damagedRate} %</small>
    </div>
  );
}

export function ProductionTracking({ data }: { data: DashboardData }) {
  return (
    <section className="production-followup" aria-label="Suivi de production des opérateurs">
      <article className="card production-matrix-card">
        <div className="production-matrix-title">
          <span>Fiche de suivi</span>
          <h2>Production des opérateurs d’inventaire</h2>
          <p>Valeurs enregistrées sur la période sélectionnée · total général réconcilié</p>
        </div>
        {data.agents.length ? (
          <div className="production-matrix-wrap">
            <table className="production-matrix">
              <thead>
                <tr>
                  <th rowSpan={2} className="matrix-number">N°</th>
                  <th rowSpan={2} className="matrix-measure">Unité de conservation (UC)</th>
                  <th colSpan={data.agents.length} className="matrix-operators">Nom et prénoms des opérateurs d’inventaire</th>
                  <th rowSpan={2} className="matrix-total">Total général</th>
                </tr>
                <tr>
                  {data.agents.map((agent) => (
                    <th className="matrix-agent" key={agent.id}>
                      <span>{agent.lastName} {agent.firstName}</span>
                      <small>{agent.agentCode || "Sans code"}{agent.teamCode ? ` · ${agent.teamCode}` : ""}</small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {productionRows.map((row) => (
                  <tr key={row.key}>
                    <td className="matrix-number">{row.number}</td>
                    <th scope="row" className="matrix-measure">{row.label}</th>
                    {data.agents.map((agent) => (
                      <td key={agent.id}>{agent[row.key].toLocaleString("fr-FR")}</td>
                    ))}
                    <td className="matrix-total">{data.metrics[row.key].toLocaleString("fr-FR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state matrix-empty">
            <div>
              <strong>Aucun opérateur dans ce périmètre</strong>
              <p>Affectez des agents à l’équipe du superviseur pour alimenter cette fiche.</p>
            </div>
          </div>
        )}
      </article>

      <article className="card quality-chart-card">
        <div className="card-header quality-chart-header">
          <div>
            <h2>Suivi de la qualité de l’inventaire</h2>
            <span className="field-hint">Part en bon état et part dégradée, calculées séparément pour les cartons et les dossiers.</span>
          </div>
          <div className="quality-legend" aria-label="Légende">
            <span><i className="legend-swatch legend-carton-good" />Cartons en bon état</span>
            <span><i className="legend-swatch legend-carton-damaged" />Cartons dégradés</span>
            <span><i className="legend-swatch legend-dossier-good" />Dossiers en bon état</span>
            <span><i className="legend-swatch legend-dossier-damaged" />Dossiers dégradés</span>
          </div>
        </div>
        {data.agents.length ? (
          <div className="quality-chart-scroll">
            <div className="quality-chart">
              <div className="quality-axis" aria-hidden="true">
                <span>100 %</span><span>75 %</span><span>50 %</span><span>25 %</span><span>0 %</span>
              </div>
              <div className="quality-plot">
                {data.agents.map((agent) => (
                  <div className="quality-agent" key={agent.id}>
                    <div className="quality-bars-pair">
                      <QualityBar total={agent.cartons} damaged={agent.degradedCartons} kind="carton" />
                      <QualityBar total={agent.dossiers} damaged={agent.degradedDossiers} kind="dossier" />
                    </div>
                    <strong className="quality-agent-name" title={`${agent.firstName} ${agent.lastName}`}>
                      {agent.firstName} {agent.lastName}
                    </strong>
                    <small>{agent.direction || "Sans direction"}</small>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state dashboard-empty"><div><strong>Aucune donnée à représenter</strong><p>Le graphique apparaîtra après l’affectation des agents.</p></div></div>
        )}
        <p className="quality-chart-note"><strong>C</strong> = cartons · <strong>D</strong> = dossiers · Le pourcentage sous chaque barre indique la part dégradée.</p>
      </article>
    </section>
  );
}
