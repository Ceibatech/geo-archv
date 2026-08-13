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
  it("demande explicitement l’état du nouveau carton avant l’enregistrement", () => {
    const markup = renderToStaticMarkup(<InventoryForm carton={null} operator={operator} direction="DDU" />);

    expect(markup).toContain("Quel est l’état du carton ?");
    expect(markup).toContain("Bon état");
    expect(markup).toContain("Dégradé");
    expect(markup).toContain('type="radio" required="" name="cartonDamaged"');
  });

  it("affiche les dix communes d’Abidjan dans une liste déroulante", () => {
    const markup = renderToStaticMarkup(<InventoryForm carton={null} operator={operator} direction="DDU" />);

    expect(markup).toContain('<select id="commune" name="commune">');
    for (const commune of ABIDJAN_COMMUNES) {
      expect(markup).toContain(`value="${commune}"`);
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
