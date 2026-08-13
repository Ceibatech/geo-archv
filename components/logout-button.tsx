"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    if (pending) return;
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <button className="logout-button" type="button" onClick={logout} disabled={pending}>
      {pending ? "Déconnexion…" : "Se déconnecter"}
    </button>
  );
}
