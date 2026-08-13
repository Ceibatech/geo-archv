"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function CartonForm() {
  const router = useRouter();
  const [damaged, setDamaged] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");

    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/cartons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          libelle: form.get("libelle"),
          barcode: form.get("barcode"),
          cartonDamaged: damaged,
          cartonDamageNote: form.get("cartonDamageNote"),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Création impossible.");
      router.replace(`/inventaire/carton/${payload.data.id}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Création impossible.");
      setPending(false);
    }
  }

  return (
    <form className="form-card card" onSubmit={submit}>
      <div className="form-stack">
        {error && <p className="message message-error" role="alert">{error}</p>}
        <div className="form-grid">
          <div className="field field-full">
            <label htmlFor="libelle">Libellé du carton *</label>
            <input id="libelle" name="libelle" maxLength={255} required autoFocus />
            <p className="field-hint">Utilisez le libellé visible sur le carton physique.</p>
          </div>
          <div className="field">
            <label htmlFor="barcode">Code-barres</label>
            <input id="barcode" name="barcode" maxLength={100} />
            <p className="field-hint">Facultatif. Il ne remplace pas la référence CG1020.</p>
          </div>
          <div className="field">
            <span className="field-label">Le carton est-il dégradé ?</span>
            <div className="radio-group">
              <label className="radio-option">
                <input type="radio" name="cartonDamaged" checked={!damaged} onChange={() => setDamaged(false)} />
                Non
              </label>
              <label className="radio-option">
                <input type="radio" name="cartonDamaged" checked={damaged} onChange={() => setDamaged(true)} />
                Oui
              </label>
            </div>
          </div>
          {damaged && (
            <div className="field field-full">
              <label htmlFor="cartonDamageNote">Observation sur la dégradation *</label>
              <textarea id="cartonDamageNote" name="cartonDamageNote" maxLength={2000} required />
            </div>
          )}
        </div>
        <div className="form-actions">
          <button className="button button-primary" type="submit" disabled={pending}>
            {pending ? "Création du carton…" : "Créer le carton et saisir le premier dossier"}
          </button>
        </div>
      </div>
    </form>
  );
}
