export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const unauthorized = (message = "Authentification requise.") =>
  new AppError(message, 401, "UNAUTHORIZED");

export const forbidden = (message = "Vous n'avez pas accès à cette ressource.") =>
  new AppError(message, 403, "FORBIDDEN");

export const notFound = (message = "Ressource introuvable.") =>
  new AppError(message, 404, "NOT_FOUND");

export const conflict = (message: string, details?: unknown) =>
  new AppError(message, 409, "CONFLICT", details);
