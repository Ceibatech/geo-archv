import { describe, expect, it } from "vitest";

import { createInventorySchema } from "../lib/validation";

const dossier = {
  clientRequestId: "70631f8f-9bd0-48e4-af55-2084f1122b01",
  caseNature: "Dossier ACD",
  lastName: "Bado",
  dossierDamaged: false,
  hasDifficulty: false,
  closeCarton: false,
};

describe("validation de la fiche simplifiée", () => {
  it("accepte une fiche qui crée automatiquement son carton", () => {
    const result = createInventorySchema.safeParse({
      ...dossier,
      carton: { libelle: "Carton ACD 2026", barcode: "BC-001" },
    });

    expect(result.success).toBe(true);
  });

  it("accepte une fiche ajoutée au carton en cours", () => {
    const result = createInventorySchema.safeParse({ ...dossier, cartonId: 42 });

    expect(result.success).toBe(true);
  });

  it("refuse une fiche sans carton", () => {
    const result = createInventorySchema.safeParse(dossier);

    expect(result.success).toBe(false);
  });

  it("refuse de créer un carton tout en ciblant un carton existant", () => {
    const result = createInventorySchema.safeParse({
      ...dossier,
      cartonId: 42,
      carton: { libelle: "Autre carton" },
    });

    expect(result.success).toBe(false);
  });
});
