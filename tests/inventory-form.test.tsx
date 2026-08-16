import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ABIDJAN_COMMUNES } from "../lib/abidjan-communes";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

import { InventoryForm } from "../components/inventory-form";

const operator = {
  firstName: "Awa",
  lastName: "Koné",
  agentCode: "AG007",
};

describe("questionnaire d’inventaire agent", () => {
  it("demande explicitement l’état du dossier avant l’enregistrement", () => {
    const markup = renderToStaticMarkup(<InventoryForm carton={null} operator={operator} direction="DDU" />);

    expect(markup).toContain("État du dossier");
    expect(markup).toContain("Bon état");
    expect(markup).toContain("Dégradé");
    expect(markup).toContain('type="radio" required="" name="cartonDamaged"');
  });

  it("affiche un champ de recherche rapide avec suggestions visibles pour les communes", () => {
    const markup = renderToStaticMarkup(<InventoryForm carton={null} operator={operator} direction="DDU" />);

    expect(markup).toContain('placeholder="Rechercher une commune ou ville"');
    expect(markup).toContain('id="commune-search"');
    expect(markup).toContain('commune-search-results');
  });

  it("affiche les communes et villes disponibles dans le moteur de suggestions", () => {
    const markup = renderToStaticMarkup(<InventoryForm carton={null} operator={operator} direction="DDU" />);

    expect(markup).toContain('commune-search-results');
    expect(markup).toContain('Rechercher une commune ou ville');
    for (const commune of ABIDJAN_COMMUNES.slice(0, 3)) {
      expect(markup).not.toContain(commune);
    }
  });

  it("adapte les natures de dossier à la direction de l’agent", () => {
    const dduMarkup = renderToStaticMarkup(<InventoryForm carton={null} operator={operator} direction="DDU" />);
    const dtcMarkup = renderToStaticMarkup(<InventoryForm carton={null} operator={operator} direction="DTC" />);

    expect(dduMarkup).toContain('value="ACD"');
    expect(dduMarkup).not.toContain('value="Permis de construire"');
    expect(dtcMarkup).toContain('value="Plan topographique"');
    expect(dtcMarkup).toContain('value="Plan cadastral"');
  });
});
