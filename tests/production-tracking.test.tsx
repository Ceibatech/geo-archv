import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProductionTracking } from "../components/production-tracking";
import type { DashboardData } from "../services/dashboard-service";

describe("fiche de suivi superviseur et exécutif", () => {
  it("affiche les quatre indicateurs par opérateur et les totaux", () => {
    const data = {
      period: "day",
      range: { start: "2026-08-12", endExclusive: "2026-08-13", label: "12 août 2026" },
      title: "Vue exécutive",
      description: "Tous les agents actifs.",
      metrics: { cartons: 25, dossiers: 120, degradedCartons: 2, degradedDossiers: 8 },
      agents: [{
        id: 7,
        firstName: "Awa",
        lastName: "Koné",
        agentCode: "AG007",
        teamCode: "DCM-01",
        teamName: "Équipe DCM 1",
        direction: "DCM",
        cartons: 25,
        dossiers: 120,
        degradedCartons: 2,
        degradedDossiers: 8,
      }],
      maxDossiers: 120,
    } as unknown as DashboardData;

    const markup = renderToStaticMarkup(<ProductionTracking data={data} />);

    expect(markup).toContain("Production des opérateurs d’inventaire");
    expect(markup).toContain("Nombre de cartons dégradés");
    expect(markup).toContain("Total général");
    expect(markup).toContain("Awa");
    expect(markup).toContain("120");
    expect(markup).toContain("Suivi de la qualité de l’inventaire");
  });
});
