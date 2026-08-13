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
    const markup = renderToStaticMarkup(<InventoryForm carton={null} operator={operator} />);

    expect(markup).toContain("Quel est l’état du carton ?");
    expect(markup).toContain("Bon état");
    expect(markup).toContain("Dégradé");
    expect(markup).toContain('type="radio" required="" name="cartonDamaged"');
  });

  it("affiche les dix communes d’Abidjan dans une liste déroulante", () => {
    const markup = renderToStaticMarkup(<InventoryForm carton={null} operator={operator} />);

    expect(markup).toContain('<select id="commune" name="commune">');
    for (const commune of ABIDJAN_COMMUNES) {
      expect(markup).toContain(`value="${commune}"`);
    }
  });
});
