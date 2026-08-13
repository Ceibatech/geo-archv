"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");

    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: form.get("identifier"), password: form.get("password") }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Connexion impossible.");
      router.replace(payload.redirectTo);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Connexion impossible.");
      setPending(false);
    }
  }

  return (
    <form className="form-stack login-form" onSubmit={submit} aria-busy={pending}>
      <div className="login-form-feedback" aria-live="polite" aria-atomic="true">
        {error ? (
          <p className="message message-error login-form-error" role="alert">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M12 8v5m0 3.5v.01M10.3 4.7 3.2 17a2 2 0 0 0 1.73 3h14.14a2 2 0 0 0 1.73-3L13.7 4.7a2 2 0 0 0-3.4 0Z" />
            </svg>
            <span>{error}</span>
          </p>
        ) : null}
      </div>
      <div className="field">
        <label htmlFor="identifier">Identifiant ou e-mail</label>
        <div className="login-input-shell">
          <svg className="login-field-icon" aria-hidden="true" viewBox="0 0 24 24">
            <path d="M20 21a8 8 0 0 0-16 0m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
          </svg>
          <input
            id="identifier"
            name="identifier"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Ex. akone ou awa@ceibac.ci"
            required
            autoFocus
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="password">Mot de passe</label>
        <div className="login-input-shell">
          <svg className="login-field-icon" aria-hidden="true" viewBox="0 0 24 24">
            <path d="M7 10V8a5 5 0 0 1 10 0v2m-9 0h8a2 2 0 0 1 2 2v7H6v-7a2 2 0 0 1 2-2Zm4 4v2" />
          </svg>
          <input
            id="password"
            name="password"
            type={passwordVisible ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Votre mot de passe"
            required
          />
          <button
            className="login-password-toggle"
            type="button"
            aria-label={passwordVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            aria-pressed={passwordVisible}
            onClick={() => setPasswordVisible((visible) => !visible)}
          >
            {passwordVisible ? (
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="m3 3 18 18M10.6 10.7A2 2 0 0 0 13.3 13.4M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9 6 9 6a15.6 15.6 0 0 1-3 3.7M6.2 6.2C4.1 7.6 3 10 3 10s3.5 6 9 6c.9 0 1.8-.2 2.6-.5" />
              </svg>
            ) : (
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Zm9 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
              </svg>
            )}
          </button>
        </div>
      </div>
      <button className="button button-primary button-block login-submit" disabled={pending} type="submit">
        {pending ? (
          <>
            <span className="login-spinner" aria-hidden="true" />
            Vérification en cours…
          </>
        ) : (
          <>
            Se connecter
            <svg className="login-submit-arrow" aria-hidden="true" viewBox="0 0 24 24">
              <path d="M5 12h14m-5-5 5 5-5 5" />
            </svg>
          </>
        )}
      </button>
      <p className="login-trust-note">
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M12 3 5 6v5c0 4.6 2.8 8.1 7 10 4.2-1.9 7-5.4 7-10V6l-7-3Zm-3 9 2 2 4-4" />
        </svg>
        Session protégée et accès journalisé
      </p>
    </form>
  );
}
