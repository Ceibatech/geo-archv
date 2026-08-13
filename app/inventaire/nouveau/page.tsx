import { redirect } from "next/navigation";

import { requirePageUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewCartonPage() {
  await requirePageUser(["agent"]);
  redirect("/inventaire");
}
