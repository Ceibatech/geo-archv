import "server-only";

import { redirect } from "next/navigation";

import { forbidden, unauthorized } from "@/lib/errors";
import { getSessionUser } from "@/lib/session";
import type { Role } from "@/types/domain";

export async function requirePageUser(roles?: readonly Role[]) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect("/acces-refuse");
  return user;
}

export async function requireApiUser(roles?: readonly Role[]) {
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  if (roles && !roles.includes(user.role)) throw forbidden();
  return user;
}
