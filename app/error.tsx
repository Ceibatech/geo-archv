"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="login-panel">
      <div className="login-card">
        <p className="eyebrow">Erreur</p>
        <h2>La page n’a pas pu être chargée.</h2>
        <p>Vérifiez la configuration du service ou réessayez dans quelques instants.</p>
        <button className="button button-primary" type="button" onClick={reset}>Réessayer</button>
      </div>
    </main>
  );
}
