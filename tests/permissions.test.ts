import { describe, expect, it } from "vitest";

import { canAccessPath } from "../lib/permissions";

describe("contrôle des rôles", () => {
  it("autorise l'agent sur son tableau de bord et l'inventaire", () => {
    expect(canAccessPath("agent", "/dashboard")).toBe(true);
    expect(canAccessPath("agent", "/inventaire")).toBe(true);
    expect(canAccessPath("agent", "/inventaire/carton/381")).toBe(true);
    expect(canAccessPath("agent", "/rapports")).toBe(true);
    expect(canAccessPath("agent", "/admin/utilisateurs")).toBe(false);
  });

  it("limite le superviseur au tableau de bord de son équipe", () => {
    expect(canAccessPath("superviseur", "/dashboard")).toBe(true);
    expect(canAccessPath("superviseur", "/rapports")).toBe(true);
    expect(canAccessPath("superviseur", "/inventaire")).toBe(false);
    expect(canAccessPath("superviseur", "/admin/utilisateurs")).toBe(false);
  });

  it("refuse l'administration à l'exécutif", () => {
    expect(canAccessPath("executif", "/dashboard")).toBe(true);
    expect(canAccessPath("executif", "/rapports")).toBe(true);
    expect(canAccessPath("executif", "/admin/utilisateurs")).toBe(false);
    expect(canAccessPath("executif", "/inventaire")).toBe(false);
  });

  it("limite l'administrateur à la gestion des comptes et équipes", () => {
    expect(canAccessPath("admin", "/admin/utilisateurs")).toBe(true);
    expect(canAccessPath("admin", "/admin/equipes")).toBe(true);
    expect(canAccessPath("admin", "/inventaire")).toBe(false);
    expect(canAccessPath("admin", "/dashboard")).toBe(false);
  });
});
