import { redirect } from "next/navigation";

import { homePathForRole } from "@/lib/permissions";
import { getSessionUser } from "@/lib/session";

export default async function HomePage() {
  const user = await getSessionUser();
  redirect(user ? homePathForRole(user.role) : "/login");
}
