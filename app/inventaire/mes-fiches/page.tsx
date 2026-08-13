import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { requirePageUser } from "@/lib/auth";
import { inventoryListQuerySchema } from "@/lib/validation";
import { listInventoryRecords } from "@/services/inventory-service";

export const dynamic = "force-dynamic";

function pageHref(page: number, search?: string) {
  const params = new URLSearchParams({ page: String(page) });
  if (search) params.set("search", search);
  return `/inventaire/mes-fiches?${params}`;
}

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const user = await requirePageUser(["agent"]);
  const query = inventoryListQuerySchema.parse(await searchParams);
  const result = await listInventoryRecords(query, user);

  return (
    <AppShell user={user} active="fiches" title="Mes fiches">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Registre d’inventaire</p>
          <h1>Mes fiches</h1>
          <p>{result.pagination.total} dossier{result.pagination.total > 1 ? "s" : ""} correspondant à vos droits d’accès.</p>
        </div>
      </div>

      <form className="search-bar" method="get">
        <input
          className="search-input"
          type="search"
          name="search"
          defaultValue={query.search}
          placeholder="Carton, code-barres, guichet, DDU, îlot, lot, titre foncier, commune, nom…"
          aria-label="Rechercher dans les fiches"
        />
        <button className="button button-primary" type="submit">Rechercher</button>
        {query.search && <Link className="button button-secondary" href="/inventaire/mes-fiches">Effacer</Link>}
      </form>

      <section className="card">
        {result.data.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Carton</th><th>Guichet / DDU</th><th>Nature</th><th>Personne</th><th>Commune</th><th>Agent</th><th>État</th></tr></thead>
              <tbody>
                {result.data.map((record) => (
                  <tr key={record.id}>
                    <td>{record.inventoryDate}</td>
                    <td className="primary-cell">{record.cartonUid}</td>
                    <td>{[record.guichetNumber, record.dduNumber].filter(Boolean).join(" / ") || "—"}</td>
                    <td>{record.caseNature}</td>
                    <td>{[record.lastName, record.firstNames].filter(Boolean).join(" ") || "—"}</td>
                    <td>{record.commune || "—"}</td>
                    <td>{record.agentCode || record.agentName}</td>
                    <td><span className={`badge ${record.dossierDamaged ? "badge-warning" : "badge-active"}`}>{record.dossierDamaged ? "Dégradé" : "Bon état"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state"><div><strong>Aucun résultat</strong><p>Modifiez votre recherche ou commencez un nouvel inventaire.</p></div></div>
        )}
        <div className="pagination">
          <span>Page {result.pagination.page} sur {result.pagination.totalPages}</span>
          <div className="pagination-links">
            {result.pagination.page > 1 && <Link className="button button-secondary" href={pageHref(result.pagination.page - 1, query.search)}>Précédent</Link>}
            {result.pagination.page < result.pagination.totalPages && <Link className="button button-secondary" href={pageHref(result.pagination.page + 1, query.search)}>Suivant</Link>}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
