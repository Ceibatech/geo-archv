import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { homePathForRole } from "@/lib/permissions";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(homePathForRole(user.role));

  return (
    <main className="login-page">
      <section className="login-brand" aria-labelledby="login-heading">
        <span className="login-orbit login-orbit-one" aria-hidden="true" />
        <span className="login-orbit login-orbit-two" aria-hidden="true" />
        <div className="brand-lockup">
          <div className="brand-logo-card brand-logo-login">
            <Image
              className="brand-logo-image"
              src="/ceibac.jpg"
              alt="CEIBA Analytics"
              width={345}
              height={188}
              priority
            />
          </div>
          <div>
            <div className="brand-name">Ministère de l’Urbanisme, du Logement et du Cadre de Vie</div>
            <div className="brand-subtitle">Système de gestion des archives · CEIBA Analytics</div>
          </div>
        </div>

        <div className="login-brand-copy">
          <p className="eyebrow">Inventaire CG1020</p>
          <h1 id="login-heading">Les archives foncières, pilotées avec précision.</h1>
          <p>
            Une plateforme unique pour saisir sur le terrain, superviser les équipes
            et suivre l’avancement de l’inventaire en temps réel.
          </p>
          <ul className="login-capabilities" aria-label="Fonctionnalités principales">
            <li><strong>01</strong><span>Saisie mobile</span></li>
            <li><strong>02</strong><span>Suivi en direct</span></li>
            <li><strong>03</strong><span>Accès par rôle</span></li>
          </ul>
        </div>

        <div className="login-project-code">
          <span className="status-dot" aria-hidden="true" />
          Phase pilote · Dossiers de base et dossiers ACD
        </div>
      </section>

      <section className="login-panel" aria-labelledby="login-form-title">
        <span className="login-panel-accent" aria-hidden="true" />
        <div className="login-card">
          <div className="login-security"><span className="status-dot" aria-hidden="true" /> Portail interne sécurisé</div>
          <p className="eyebrow">Accès à la plateforme</p>
          <h2 id="login-form-title">Heureux de vous revoir.</h2>
          <p>Utilisez les identifiants attribués par votre administrateur.</p>
          <LoginForm />
          <p className="login-help">
            Besoin d’un accès ? <strong>Contactez l’administrateur CG1020.</strong>
          </p>
        </div>
      </section>
    </main>
  );
}
