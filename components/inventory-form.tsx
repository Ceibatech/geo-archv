"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { ABIDJAN_COMMUNES } from "../lib/abidjan-communes";
import {
  CUSTOM_CASE_NATURE_OPTION,
  formatSelectedCaseNature,
  getCaseNaturesForDirection,
} from "../lib/inventory-case-natures";
import type { AuthUser, Carton, InventoryDirection } from "@/types/domain";

type InventoryCarton = Pick<Carton, "id" | "cartonUid" | "libelle" | "barcode" | "dossierCount">;

const STEPS = [
  { label: "Le carton", compact: "Carton" },
  { label: "Les références", compact: "Références" },
  { label: "La parcelle", compact: "Parcelle" },
  { label: "La localisation", compact: "Lieu" },
  { label: "Le dossier", compact: "Dossier" },
  { label: "La personne concernée", compact: "Personne" },
  { label: "Les contacts", compact: "Contacts" },
  { label: "Les compléments", compact: "Contrôle" },
] as const;

function QuestionnaireStep({
  active,
  index,
  title,
  description,
  children,
}: {
  active: boolean;
  index: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="questionnaire-card"
      data-step={index}
      hidden={!active}
      aria-labelledby={`questionnaire-step-title-${index}`}
    >
      <div className="questionnaire-card-header">
        <span className="section-number">{index + 1}</span>
        <div>
          <h2 id={`questionnaire-step-title-${index}`} tabIndex={-1}>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      <div className="questionnaire-card-body">{children}</div>
    </section>
  );
}

function text(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

export function InventoryForm({
  carton,
  operator,
  direction,
}: {
  carton: InventoryCarton | null;
  operator: Pick<AuthUser, "firstName" | "lastName" | "agentCode">;
  direction: InventoryDirection | null;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(() => (carton ? 1 : 0));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [cartonDamaged, setCartonDamaged] = useState<boolean | null>(null);
  const [dossierDamaged, setDossierDamaged] = useState(false);
  const [hasDifficulty, setHasDifficulty] = useState(false);
  const [caseNatureSelection, setCaseNatureSelection] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const caseNatures = getCaseNaturesForDirection(direction);

  function focusStep(nextStep: number) {
    requestAnimationFrame(() => {
      const section = formRef.current?.querySelector<HTMLElement>(`[data-step="${nextStep}"]`);
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      section?.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
    });
  }

  function goToStep(nextStep: number) {
    setError("");
    setStep(nextStep);
    focusStep(nextStep);
  }

  function validateCurrentStep() {
    const currentSection = formRef.current?.querySelector<HTMLElement>(`[data-step="${step}"]`);
    const invalidControl = Array.from(
      currentSection?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        "input, textarea, select",
      ) ?? [],
    ).find((control) => !control.checkValidity());

    if (!invalidControl) return true;
    invalidControl.reportValidity();
    invalidControl.focus();
    return false;
  }

  function nextStep() {
    if (!validateCurrentStep()) return;
    goToStep(Math.min(step + 1, STEPS.length - 1));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    if (!carton && cartonDamaged === null) {
      setError("Choisissez l’état du carton avant d’enregistrer la fiche.");
      setStep(STEPS.length - 1);
      focusStep(STEPS.length - 1);
      return;
    }

    const hasIdentifier = [
      "guichetNumber",
      "dduNumber",
      "classificationReference",
      "landTitleNumber",
      "lastName",
    ].some((name) => text(form, name));

    if (!hasIdentifier) {
      setError("Renseignez au moins une référence du dossier ou le nom de la personne concernée.");
      setStep(1);
      focusStep(1);
      return;
    }

    setPending(true);
    setError("");
    setSuccess("");
    const surfaceArea = text(form, "surfaceArea");
    const caseNature = formatSelectedCaseNature(
      text(form, "caseNature"),
      text(form, "customCaseNature"),
    );

    try {
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(carton
            ? { cartonId: carton.id }
            : {
                carton: {
                  libelle: text(form, "cartonLibelle"),
                  barcode: text(form, "cartonBarcode"),
                  cartonDamaged,
                  cartonDamageNote: text(form, "cartonDamageNote"),
                },
              }),
          clientRequestId: requestId,
          guichetNumber: text(form, "guichetNumber"),
          dduNumber: text(form, "dduNumber"),
          classificationReference: text(form, "classificationReference"),
          ilotNumber: text(form, "ilotNumber"),
          lotNumber: text(form, "lotNumber"),
          surfaceArea: surfaceArea || undefined,
          landTitleNumber: text(form, "landTitleNumber"),
          housingEstate: text(form, "housingEstate"),
          commune: text(form, "commune"),
          caseNature,
          lastName: text(form, "lastName"),
          firstNames: text(form, "firstNames"),
          address: text(form, "address"),
          phone: text(form, "phone"),
          email: text(form, "email"),
          contactPerson: text(form, "contactPerson"),
          contactMobile: text(form, "contactMobile"),
          dossierDamaged,
          dossierDamageNote: text(form, "dossierDamageNote"),
          hasDifficulty,
          difficultyNote: text(form, "difficultyNote"),
          closeCarton: false,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Enregistrement impossible.");

      if (!carton) {
        router.replace("/inventaire?success=dossier");
        router.refresh();
        return;
      }

      formElement.reset();
      setDossierDamaged(false);
      setHasDifficulty(false);
      setCaseNatureSelection("");
      setRequestId(crypto.randomUUID());
      setSuccess("Fiche enregistrée. Le questionnaire est prêt pour le dossier suivant.");
      setPending(false);
      setStep(1);
      router.refresh();
      focusStep(1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Enregistrement impossible.");
      setPending(false);
    }
  }

  async function changeCarton() {
    if (!carton || pending) return;
    const confirmed = window.confirm(
      "Terminer ce carton et préparer le questionnaire pour un nouveau carton ?",
    );
    if (!confirmed) return;

    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/cartons/${carton.id}/close`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Changement de carton impossible.");
      router.replace("/inventaire?success=carton-termine");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Changement de carton impossible.");
      setPending(false);
    }
  }

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <form
      className="questionnaire"
      ref={formRef}
      onSubmit={submit}
      aria-label="Questionnaire mobile d’inventaire"
    >
      <div className="questionnaire-identity">
        <div>
          <span>Opérateur connecté</span>
          <strong>{operator.firstName} {operator.lastName}</strong>
        </div>
        <small>{operator.agentCode} · CG1020</small>
      </div>

      <ol className="questionnaire-stepper" aria-label="Étapes du questionnaire">
        {STEPS.map((item, index) => (
          <li
            className={index === step ? "is-active" : index < step ? "is-complete" : undefined}
            aria-current={index === step ? "step" : undefined}
            key={item.label}
          >
            <span className="questionnaire-step-dot" aria-hidden="true">
              {index < step ? "✓" : index + 1}
            </span>
            <span>{item.compact}</span>
          </li>
        ))}
      </ol>

      <div className="questionnaire-progress" aria-live="polite">
        <div className="questionnaire-progress-copy">
          <span>Étape {step + 1} sur {STEPS.length}</span>
          <strong>{STEPS[step].label}</strong>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-label="Progression du questionnaire"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={step + 1}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>

      {error ? <p className="message message-error questionnaire-message" role="alert">{error}</p> : null}
      {success ? <p className="message message-success questionnaire-message" role="status">{success}</p> : null}

      <QuestionnaireStep
        active={step === 0}
        index={0}
        title="Quel carton êtes-vous en train d’inventorier ?"
        description="Saisissez uniquement ce qui est écrit sur le carton physique."
      >
        {carton ? (
          <div className="current-carton-line">
            <span className="badge badge-open">Carton en cours</span>
            <strong>{carton.cartonUid}</strong>
            <span>{carton.dossierCount} fiche{carton.dossierCount > 1 ? "s" : ""}</span>
          </div>
        ) : null}
        <div className="form-grid">
          <div className="field">
            <label htmlFor="cartonLibelle">Libellé du carton *</label>
            <input
              id="cartonLibelle"
              name="cartonLibelle"
              maxLength={255}
              defaultValue={carton?.libelle ?? ""}
              readOnly={Boolean(carton)}
              required
              autoFocus={!carton}
            />
            {!carton ? <p className="field-hint">Nous créerons le carton automatiquement à l’enregistrement.</p> : null}
          </div>
          <div className="field">
            <label htmlFor="cartonBarcode">Code-barres</label>
            <input
              id="cartonBarcode"
              name="cartonBarcode"
              maxLength={100}
              defaultValue={carton?.barcode ?? ""}
              readOnly={Boolean(carton)}
              placeholder="Facultatif"
            />
          </div>
        </div>
        {carton ? (
          <button className="questionnaire-link-button" type="button" onClick={changeCarton} disabled={pending}>
            Je passe à un autre carton
          </button>
        ) : null}
      </QuestionnaireStep>

      <QuestionnaireStep
        active={step === 1}
        index={1}
        title="Quelles sont les références du dossier ?"
        description="Vous pouvez laisser un champ vide s’il n’existe pas sur le dossier."
      >
        <div className="form-grid form-grid-3">
          <div className="field"><label htmlFor="guichetNumber">N° Guichet</label><input id="guichetNumber" name="guichetNumber" maxLength={100} autoFocus={Boolean(carton)} placeholder="Facultatif" /></div>
          <div className="field"><label htmlFor="dduNumber">N° DDU</label><input id="dduNumber" name="dduNumber" maxLength={100} placeholder="Facultatif" /></div>
          <div className="field"><label htmlFor="classificationReference">Référence de classement</label><input id="classificationReference" name="classificationReference" maxLength={191} placeholder="Facultatif" /></div>
        </div>
      </QuestionnaireStep>

      <QuestionnaireStep
        active={step === 2}
        index={2}
        title="Comment la parcelle est-elle identifiée ?"
        description="Recopiez les numéros et la superficie indiqués sur le dossier."
      >
        <div className="form-grid form-grid-3">
          <div className="field"><label htmlFor="ilotNumber">N° Îlot</label><input id="ilotNumber" name="ilotNumber" maxLength={100} placeholder="Facultatif" /></div>
          <div className="field"><label htmlFor="lotNumber">N° Lot</label><input id="lotNumber" name="lotNumber" maxLength={100} placeholder="Facultatif" /></div>
          <div className="field"><label htmlFor="surfaceArea">Superficie (m²)</label><input id="surfaceArea" name="surfaceArea" type="number" min="0" step="0.01" placeholder="Facultatif" /></div>
        </div>
      </QuestionnaireStep>

      <QuestionnaireStep
        active={step === 3}
        index={3}
        title="Où se situe le bien ?"
        description="Ajoutez le titre foncier et la localisation si ces informations sont disponibles."
      >
        <div className="form-grid form-grid-3">
          <div className="field"><label htmlFor="landTitleNumber">N° Titre foncier</label><input id="landTitleNumber" name="landTitleNumber" maxLength={100} placeholder="Facultatif" /></div>
          <div className="field"><label htmlFor="housingEstate">Lotissement</label><input id="housingEstate" name="housingEstate" maxLength={191} placeholder="Facultatif" /></div>
          <div className="field">
            <label htmlFor="commune">Commune d’Abidjan</label>
            <select id="commune" name="commune" defaultValue="">
              <option value="">Sélectionner une commune (facultatif)</option>
              {ABIDJAN_COMMUNES.map((commune) => <option value={commune} key={commune}>{commune}</option>)}
            </select>
            <p className="field-hint">Liste des dix communes d’Abidjan publiée par l’ANStat.</p>
          </div>
        </div>
      </QuestionnaireStep>

      <QuestionnaireStep
        active={step === 4}
        index={4}
        title="Quelle est la nature du dossier ?"
        description="Indiquez le type exact inscrit sur le dossier."
      >
        <div className="form-grid">
          <div className="field field-full">
          <label htmlFor="caseNature">Nature du dossier *</label>
            <select
              id="caseNature"
              name="caseNature"
              value={caseNatureSelection}
              onChange={(event) => setCaseNatureSelection(event.target.value)}
              required
            >
              <option value="">Sélectionner la nature du dossier</option>
              {caseNatures.map((nature) => <option value={nature} key={nature}>{nature}</option>)}
              <option value={CUSTOM_CASE_NATURE_OPTION}>Autre nature — à préciser</option>
            </select>
            <p className="field-hint">
              {direction ? `Liste adaptée à la direction ${direction}.` : "Liste générale des dossiers d’inventaire."}
            </p>
          </div>
          {caseNatureSelection === CUSTOM_CASE_NATURE_OPTION ? (
            <div className="field field-full">
              <label htmlFor="customCaseNature">Précisez la nature du dossier *</label>
              <input id="customCaseNature" name="customCaseNature" maxLength={170} required />
            </div>
          ) : null}
        </div>
      </QuestionnaireStep>

      <QuestionnaireStep
        active={step === 5}
        index={5}
        title="Quelle personne est concernée ?"
        description="Recopiez l’identité et l’adresse figurant dans le dossier."
      >
        <div className="form-grid">
          <div className="field"><label htmlFor="lastName">Nom</label><input id="lastName" name="lastName" maxLength={100} placeholder="Facultatif" /></div>
          <div className="field"><label htmlFor="firstNames">Prénoms</label><input id="firstNames" name="firstNames" maxLength={191} placeholder="Facultatif" /></div>
          <div className="field field-full"><label htmlFor="address">Adresse</label><textarea id="address" name="address" maxLength={2000} placeholder="Facultatif" /></div>
        </div>
      </QuestionnaireStep>

      <QuestionnaireStep
        active={step === 6}
        index={6}
        title="Comment peut-on contacter la personne ?"
        description="Ces informations sont facultatives."
      >
        <div className="form-grid">
          <div className="field"><label htmlFor="phone">Téléphone</label><input id="phone" name="phone" type="tel" maxLength={50} placeholder="Facultatif" /></div>
          <div className="field"><label htmlFor="email">E-mail</label><input id="email" name="email" type="email" maxLength={191} placeholder="Facultatif" /></div>
          <div className="field"><label htmlFor="contactPerson">Personne à contacter</label><input id="contactPerson" name="contactPerson" maxLength={191} placeholder="Facultatif" /></div>
          <div className="field"><label htmlFor="contactMobile">Mobile</label><input id="contactMobile" name="contactMobile" type="tel" maxLength={50} placeholder="Facultatif" /></div>
        </div>
      </QuestionnaireStep>

      <QuestionnaireStep
        active={step === 7}
        index={7}
        title="Avez-vous une observation à signaler ?"
        description="Répondez seulement si le dossier est dégradé ou si vous avez rencontré une difficulté."
      >
        <div className="form-grid">
          {!carton ? (
            <div className="field field-full">
              <span className="field-label">Quel est l’état du carton ? *</span>
              <div className="radio-group">
                <label className="radio-option">
                  <input
                    type="radio"
                    name="cartonDamaged"
                    checked={cartonDamaged === false}
                    onChange={() => setCartonDamaged(false)}
                    required
                  />
                  Bon état
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name="cartonDamaged"
                    checked={cartonDamaged === true}
                    onChange={() => setCartonDamaged(true)}
                    required
                  />
                  Dégradé
                </label>
              </div>
              <p className="field-hint">Ce choix est obligatoire avant l’enregistrement du premier dossier.</p>
            </div>
          ) : null}
          {!carton && cartonDamaged ? (
            <div className="field field-full">
              <label htmlFor="cartonDamageNote">Observation sur la dégradation du carton *</label>
              <textarea id="cartonDamageNote" name="cartonDamageNote" maxLength={2000} required />
            </div>
          ) : null}
          <div className="field">
            <span className="field-label">Le dossier est-il dégradé ?</span>
            <div className="radio-group">
              <label className="radio-option"><input type="radio" name="dossierDamaged" checked={!dossierDamaged} onChange={() => setDossierDamaged(false)} /> Non</label>
              <label className="radio-option"><input type="radio" name="dossierDamaged" checked={dossierDamaged} onChange={() => setDossierDamaged(true)} /> Oui</label>
            </div>
          </div>
          {dossierDamaged ? (
            <div className="field">
              <label htmlFor="dossierDamageNote">Observation sur la dégradation *</label>
              <textarea id="dossierDamageNote" name="dossierDamageNote" maxLength={2000} required />
            </div>
          ) : null}
          <div className="field">
            <span className="field-label">Une difficulté majeure a-t-elle été rencontrée ?</span>
            <div className="radio-group">
              <label className="radio-option"><input type="radio" name="hasDifficulty" checked={!hasDifficulty} onChange={() => setHasDifficulty(false)} /> Non</label>
              <label className="radio-option"><input type="radio" name="hasDifficulty" checked={hasDifficulty} onChange={() => setHasDifficulty(true)} /> Oui</label>
            </div>
          </div>
          {hasDifficulty ? (
            <div className="field">
              <label htmlFor="difficultyNote">Décrire la difficulté *</label>
              <textarea id="difficultyNote" name="difficultyNote" maxLength={4000} required />
            </div>
          ) : null}
        </div>
      </QuestionnaireStep>

      <div className="questionnaire-actions">
        <button
          className="button button-secondary"
          type="button"
          onClick={() => goToStep(step - 1)}
          disabled={pending || step === 0}
        >
          <span aria-hidden="true">←</span> Précédent
        </button>
        {step < STEPS.length - 1 ? (
          <button className="button button-primary" type="button" onClick={nextStep} disabled={pending}>
            {step === 0 ? "Commencer" : "Continuer"} <span aria-hidden="true">→</span>
          </button>
        ) : (
          <button
            className="button button-primary"
            type="submit"
            disabled={pending || (!carton && cartonDamaged === null)}
          >
            {pending ? "Enregistrement…" : "Enregistrer la fiche"}
          </button>
        )}
      </div>
    </form>
  );
}
