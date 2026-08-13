import { describe, expect, it } from "vitest";

import {
  CASE_NATURES_BY_DIRECTION,
  formatSelectedCaseNature,
  isCaseNatureAllowedForDirection,
} from "../lib/inventory-case-natures";
import { INVENTORY_DIRECTIONS } from "../types/domain";

describe("natures de dossier par direction", () => {
  it("fournit une liste non vide et sans doublon à chaque direction", () => {
    for (const direction of INVENTORY_DIRECTIONS) {
      const values = CASE_NATURES_BY_DIRECTION[direction];
      expect(values.length).toBeGreaterThan(0);
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it("associe les ACD au foncier et les plans à la topographie", () => {
    expect(CASE_NATURES_BY_DIRECTION.DDU).toContain("ACD");
    expect(CASE_NATURES_BY_DIRECTION.DTC).toContain("Plan topographique");
    expect(CASE_NATURES_BY_DIRECTION.DTC).toContain("Plan cadastral");
  });

  it("valide la nature selon la direction réelle de l’agent", () => {
    expect(isCaseNatureAllowedForDirection("ACD", "DDU")).toBe(true);
    expect(isCaseNatureAllowedForDirection("Permis de construire", "DDU")).toBe(false);
    expect(isCaseNatureAllowedForDirection("Permis de construire", "GUPCCU")).toBe(true);
  });

  it("autorise une autre nature lorsqu’elle est précisée", () => {
    const value = formatSelectedCaseNature("__OTHER__", "  Microfiche technique  ");

    expect(value).toBe("Autre : Microfiche technique");
    expect(isCaseNatureAllowedForDirection(value, "DDU")).toBe(true);
    expect(isCaseNatureAllowedForDirection("Autre : ", "DDU")).toBe(false);
  });
});
