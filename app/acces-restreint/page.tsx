import { requirePageUser } from "@/lib/auth";

export default async function RestrictedAreaPage() {
  const user = await requirePageUser(["executif"]);
  return (
    <main className="login-panel">
      <div className="login-card">
        <p className="eyebrow">Profil exécutif</p>
        <h2>Le workflow d’inventaire est en cours de validation.</h2>
        <p>
          Le tableau de bord et les rapports seront activés après validation des données MySQL et des agrégations,
          conformément à l’ordre de développement du projet.
        </p>
        <p className="field-hint">Connecté : {user.firstName} {user.lastName}</p>
      </div>
    </main>
  );
}
