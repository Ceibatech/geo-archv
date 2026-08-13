import { describe, expect, it } from "vitest";

import { formatCartonUid } from "../lib/date";

describe("formatCartonUid", () => {
  it("construit une référence CG1020 stable à partir de l'identifiant MySQL", () => {
    expect(formatCartonUid("2026-08-12", "AG007", 381)).toBe("CG1020-20260812-AG007-000381");
  });

  it("normalise le code agent", () => {
    expect(formatCartonUid("2026-08-12", " ag-9 ", 2)).toBe("CG1020-20260812-AG-9-000002");
  });
});
