import type { Role } from "../types/domain";

const ROLE_PATHS: Record<Role, readonly string[]> = {
  admin: ["/admin"],
  agent: ["/dashboard", "/inventaire", "/rapports"],
  superviseur: ["/dashboard", "/rapports"],
  executif: ["/dashboard", "/rapports"],
};

export function canAccessPath(role: Role, pathname: string) {
  return ROLE_PATHS[role].some(
    (allowedPath) => pathname === allowedPath || pathname.startsWith(`${allowedPath}/`),
  );
}

export function homePathForRole(role: Role) {
  if (role === "admin") return "/admin";
  return "/dashboard";
}
