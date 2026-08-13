import { ZodError } from "zod";

import { AppError } from "@/lib/errors";

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;

  const expectedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!expectedHost || new URL(origin).host !== expectedHost) {
    throw new AppError("Origine de la requête non autorisée.", 403, "INVALID_ORIGIN");
  }
}

export async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    throw new AppError("Le corps de la requête doit être en JSON.", 415, "INVALID_CONTENT_TYPE");
  }

  try {
    return await request.json();
  } catch {
    throw new AppError("Le corps JSON est invalide.", 400, "INVALID_JSON");
  }
}

export function apiError(error: unknown) {
  if (error instanceof AppError) {
    return Response.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues[0]?.message ?? "Certaines données sont invalides.",
          details: error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  console.error(error);
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "Une erreur interne est survenue." } },
    { status: 500 },
  );
}

export function positiveInteger(value: string, fieldName = "identifiant") {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new AppError(`${fieldName} invalide.`, 400, "INVALID_ID");
  }
  return parsed;
}
