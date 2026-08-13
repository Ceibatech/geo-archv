import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="login-panel">
      <div className="login-card">
        <p className="eyebrow">404</p>
        <h2>Page introuvable</h2>
        <p>La ressource demandée n’existe pas ou n’est plus disponible.</p>
        <Link className="button button-primary" href="/">Retour à l’accueil</Link>
      </div>
    </main>
  );
}
