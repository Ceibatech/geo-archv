import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { positiveInteger } from "@/lib/api";
import { requirePageUser } from "@/lib/auth";
import { assertCartonAccess, getCartonById } from "@/services/carton-service";

export const dynamic = "force-dynamic";

export default async function CartonPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser(["agent"]);
  const carton = await getCartonById(positiveInteger((await params).id, "Carton"));
  assertCartonAccess(carton, user);
  const canEnterData = carton.status === "OPEN" && carton.createdBy === user.id;
  if (canEnterData) redirect("/inventaire");

  return (
    <AppShell user={user} active="inventaire" title={`Carton ${carton.cartonUid}`}>
      <div className="form-page">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Consultation</p>
            <h1>Consulter le carton</h1>
            <p>Ce carton est terminé et reste disponible en consultation.</p>
          </div>
          <Link className="button button-secondary" href="/inventaire">Retour</Link>
        </div>

        <section className="card">
            <div className="card-header">
              <h2>{carton.cartonUid}</h2>
              <span className={`badge ${carton.status === "OPEN" ? "badge-open" : "badge-closed"}`}>{carton.status === "OPEN" ? "Ouvert" : "Terminé"}</span>
            </div>
            <div className="card-body">
              <dl className="definition-grid">
                <div><dt>Libellé</dt><dd>{carton.libelle}</dd></div>
                <div><dt>Agent</dt><dd>{carton.agentName} · {carton.agentCode || "—"}</dd></div>
                <div><dt>Code-barres</dt><dd>{carton.barcode || "Non renseigné"}</dd></div>
                <div><dt>Nombre de dossiers</dt><dd>{carton.dossierCount}</dd></div>
                <div><dt>Carton dégradé</dt><dd>{carton.cartonDamaged ? "Oui" : "Non"}</dd></div>
                <div><dt>Observation</dt><dd>{carton.cartonDamageNote || "—"}</dd></div>
              </dl>
            </div>
        </section>
      </div>
    </AppShell>
  );
}
