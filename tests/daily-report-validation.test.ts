import { describe, expect, it } from "vitest";

import { reportRejectionSchema, reportSignatureSchema } from "../lib/validation";

const pngDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("validation des visas journaliers", () => {
  it("accepte une signature PNG avec consentement", () => {
    expect(reportSignatureSchema.safeParse({ signatureDataUrl: pngDataUrl, consent: true }).success).toBe(true);
  });

  it("refuse une signature sans confirmation explicite", () => {
    expect(reportSignatureSchema.safeParse({ signatureDataUrl: pngDataUrl, consent: false }).success).toBe(false);
  });

  it("refuse un motif de correction trop vague", () => {
    expect(reportRejectionSchema.safeParse({ reason: "Non" }).success).toBe(false);
  });
});
