import Link from "next/link";

import { requirePageUser } from "@/lib/auth";
import { homePathForRole } from "@/lib/permissions";

export default async function AccessDeniedPage() {
  const user = await requirePageUser();
  return (
    <main className="login-panel">
      <div className="login-card">
        <p className="eyebrow">Accès refusé</p>
        <h2>Cette section n’est pas disponible pour votre profil.</h2>
        <p>Les autorisations sont contrôlées côté serveur conformément au rôle attribué.</p>
        <Link className="button button-primary" href={homePathForRole(user.role)}>Retour à mon espace</Link>
      </div>
    </main>
  );
}
