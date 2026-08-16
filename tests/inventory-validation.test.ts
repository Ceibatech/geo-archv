import { describe, expect, it } from "vitest";

import { createInventorySchema, inventorySubmissionSchema } from "../lib/validation";

const pngDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const dossier = {
  clientRequestId: "70631f8f-9bd0-48e4-af55-2084f1122b01",
  caseNature: "Dossier ACD",
  lastName: "Bado",
  dossierDamaged: false,
  hasDifficulty: false,
  closeCarton: false,
};

const nouveauCarton = {
  libelle: "Carton ACD 2026",
  barcode: "BC-001",
  cartonDamaged: false,
};

describe("validation de la fiche simplifiée", () => {
  it("accepte une fiche qui crée automatiquement son carton", () => {
    const result = createInventorySchema.safeParse({
      ...dossier,
      carton: nouveauCarton,
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
      carton: { ...nouveauCarton, libelle: "Autre carton" },
    });

    expect(result.success).toBe(false);
  });

  it("refuse de créer un carton sans choix explicite de son état", () => {
    const result = createInventorySchema.safeParse({
      ...dossier,
      carton: { libelle: "Carton sans état" },
    });

    expect(result.success).toBe(false);
  });

  it("demande une observation lorsqu’un nouveau carton est dégradé", () => {
    const result = createInventorySchema.safeParse({
      ...dossier,
      carton: { ...nouveauCarton, cartonDamaged: true },
    });

    expect(result.success).toBe(false);
  });

  it("accepte une commune d’Abidjan", () => {
    const result = createInventorySchema.safeParse({
      ...dossier,
      cartonId: 42,
      commune: "Yopougon",
    });

    expect(result.success).toBe(true);
  });

  it("accepte une ville hors Abidjan si elle figure dans la liste", () => {
    const result = createInventorySchema.safeParse({
      ...dossier,
      cartonId: 42,
      commune: "Bouaké",
    });

    expect(result.success).toBe(true);
  });

  it("refuse une commune absente de la liste autorisée", () => {
    const result = createInventorySchema.safeParse({
      ...dossier,
      cartonId: 42,
      commune: "Katiola",
    });

    expect(result.success).toBe(false);
  });

  it("accepte une fiche sans signature, car la validation du point de journée se fait au niveau du rapport", () => {
    const result = inventorySubmissionSchema.safeParse({
      ...dossier,
      cartonId: 42,
    });

    expect(result.success).toBe(true);
  });

  it("accepte une signature optionnelle si un agent choisit de l’apposer", () => {
    const result = inventorySubmissionSchema.safeParse({
      ...dossier,
      cartonId: 42,
      signatureDataUrl: pngDataUrl,
      consent: true,
    });

    expect(result.success).toBe(true);
  });
});
