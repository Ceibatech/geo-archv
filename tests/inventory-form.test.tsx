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

  it("affiche les communes et villes disponibles dans la liste déroulante", () => {
    const markup = renderToStaticMarkup(<InventoryForm carton={null} operator={operator} direction="DDU" />);

    const escapeHtmlAttribute = (value: string) =>
      value
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    expect(markup).toContain('<select id="commune" name="commune">');
    for (const commune of ABIDJAN_COMMUNES) {
      expect(markup).toContain(`value="${escapeHtmlAttribute(commune)}"`);
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
