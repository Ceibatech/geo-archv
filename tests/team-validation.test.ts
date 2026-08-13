import { describe, expect, it } from "vitest";

import { createUserSchema, teamSchema } from "../lib/validation";

describe("validation des équipes d’inventaire", () => {
  it("normalise le code équipe et conserve la direction", () => {
    const result = teamSchema.parse({
      code: "eq-du-01",
      name: "Équipe Urbanisme 1",
      direction: "DCM",
      supervisorUserId: 12,
      memberUserIds: [31, 32],
    });

    expect(result.code).toBe("EQ-DU-01");
    expect(result.direction).toBe("DCM");
  });

  it("refuse une équipe sans direction ou avec un code invalide", () => {
    expect(teamSchema.safeParse({
      code: "équipe 1",
      name: "Équipe 1",
      direction: "DIRECTION INCONNUE",
      supervisorUserId: 12,
      memberUserIds: [],
    }).success).toBe(false);
  });
});

describe("création des superviseurs", () => {
  it("n’exige pas de code agent pour un superviseur", () => {
    const result = createUserSchema.safeParse({
      firstName: "Awa",
      lastName: "Koné",
      email: "awa@example.com",
      login: "awa.kone",
      password: "MotDePasse-2026!",
      agentCode: "",
      role: "superviseur",
      isActive: true,
    });

    expect(result.success).toBe(true);
  });
});
