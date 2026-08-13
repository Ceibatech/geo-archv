import { createHash } from "node:crypto";

import { AppError } from "@/lib/errors";

export function decodePngSignature(dataUrl: string) {
  const encoded = dataUrl.slice("data:image/png;base64,".length);
  const signature = Buffer.from(encoded, "base64");
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (signature.length < 100 || signature.length > 350_000 || !signature.subarray(0, 8).equals(pngHeader)) {
    throw new AppError("La signature PNG est vide ou invalide.", 400, "INVALID_SIGNATURE");
  }
  return {
    signature,
    hash: createHash("sha256").update(signature).digest("hex"),
  };
}
