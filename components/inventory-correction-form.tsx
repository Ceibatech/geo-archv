"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { SignaturePad } from "@/components/signature-pad";
import { ABIDJAN_COMMUNES } from "@/lib/abidjan-communes";
import {
  CUSTOM_CASE_NATURE_OPTION,
  formatSelectedCaseNature,
  getCaseNaturesForDirection,
} from "@/lib/inventory-case-natures";
import type { InventoryDirection } from "@/types/domain";

export type InventoryCorrectionData = {
  id: number;
  cartonUid: string;
  guichetNumber: string | null;
  dduNumber: string | null;
  classificationReference: string | null;
  ilotNumber: string | null;
  lotNumber: string | null;
  surfaceArea: number | null;
  landTitleNumber: string | null;
  housingEstate: string | null;
  commune: string | null;
  caseNature: string;
  lastName: string | null;
  firstNames: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  contactPerson: string | null;
  contactMobile: string | null;
  dossierDamaged: boolean;
  dossierDamageNote: string | null;
  hasDifficulty: boolean;
  difficultyNote: string | null;
  rejectionReason: string | null;
  reviewVersion: number;
};

function text(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

export function InventoryCorrectionForm({ record, direction }: { record: InventoryCorrectionData; direction: InventoryDirection | null }) {
  const router = useRouter();
  const caseNatures = getCaseNaturesForDirection(direction);
  const initialNature = caseNatures.includes(record.caseNature) ? record.caseNature : CUSTOM_CASE_NATURE_OPTION;
  const [caseNatureSelection, setCaseNatureSelection] = useState(initialNature);
  const [dossierDamaged, setDossierDamaged] = useState(record.dossierDamaged);
  const [hasDifficulty, setHasDifficulty] = useState(record.hasDifficulty);
  const [signature, setSignature] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (signature && !consent) {
      setError("Confirmez votre visa électronique si vous apposez une signature sur cette fiche.");
      return;
    }
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/inventory/${record.id}/resubmit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guichetNumber: text(form, "guichetNumber"),
          dduNumber: text(form, "dduNumber"),
          classificationReference: text(form, "classificationReference"),
          ilotNumber: text(form, "ilotNumber"),
          lotNumber: text(form, "lotNumber"),
          surfaceArea: text(form, "surfaceArea") || undefined,
          landTitleNumber: text(form, "landTitleNumber"),
          housingEstate: text(form, "housingEstate"),
          commune: text(form, "commune"),
          caseNature: formatSelectedCaseNature(text(form, "caseNature"), text(form, "customCaseNature")),
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
          signatureDataUrl: signature,
          consent,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Renvoi impossible.");
      router.replace("/inventaire/mes-fiches");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Renvoi impossible.");
      setPending(false);
    }
  }

  return (
    <form className="card inventory-correction-form" onSubmit={submit}>
      <div className="message message-error">
        <strong>Motif du rejet :</strong> {record.rejectionReason || "Correction demandée par le superviseur."}
      </div>
      <div className="card-header"><div><h2>Corriger la fiche {record.cartonUid}</h2><span className="field-hint">Version actuelle V{record.reviewVersion}. Le visa agent de la fiche reste optionnel ; le rapport journalier garde le point de signature de la journée.</span></div></div>
      <div className="card-body inventory-correction-body">
        <div className="form-grid form-grid-3">
          <div className="field"><label htmlFor="guichetNumber">N° Guichet</label><input id="guichetNumber" name="guichetNumber" defaultValue={record.guichetNumber ?? ""} maxLength={100} /></div>
          <div className="field"><label htmlFor="dduNumber">N° DDU</label><input id="dduNumber" name="dduNumber" defaultValue={record.dduNumber ?? ""} maxLength={100} /></div>
          <div className="field"><label htmlFor="classificationReference">Référence de classement</label><input id="classificationReference" name="classificationReference" defaultValue={record.classificationReference ?? ""} maxLength={191} /></div>
          <div className="field"><label htmlFor="ilotNumber">N° Îlot</label><input id="ilotNumber" name="ilotNumber" defaultValue={record.ilotNumber ?? ""} maxLength={100} /></div>
          <div className="field"><label htmlFor="lotNumber">N° Lot</label><input id="lotNumber" name="lotNumber" defaultValue={record.lotNumber ?? ""} maxLength={100} /></div>
          <div className="field"><label htmlFor="surfaceArea">Superficie (m²)</label><input id="surfaceArea" name="surfaceArea" type="number" min="0" step="0.01" defaultValue={record.surfaceArea ?? ""} /></div>
          <div className="field"><label htmlFor="landTitleNumber">N° Titre foncier</label><input id="landTitleNumber" name="landTitleNumber" defaultValue={record.landTitleNumber ?? ""} maxLength={100} /></div>
          <div className="field"><label htmlFor="housingEstate">Lotissement</label><input id="housingEstate" name="housingEstate" defaultValue={record.housingEstate ?? ""} maxLength={191} /></div>
          <div className="field"><label htmlFor="commune">Commune</label><select id="commune" name="commune" defaultValue={record.commune ?? ""}><option value="">Sélectionner</option>{ABIDJAN_COMMUNES.map((commune) => <option value={commune} key={commune}>{commune}</option>)}</select></div>
          <div className="field field-full"><label htmlFor="caseNature">Nature du dossier *</label><select id="caseNature" name="caseNature" value={caseNatureSelection} onChange={(event) => setCaseNatureSelection(event.target.value)} required><option value="">Sélectionner</option>{caseNatures.map((nature) => <option value={nature} key={nature}>{nature}</option>)}<option value={CUSTOM_CASE_NATURE_OPTION}>Autre nature</option></select></div>
          {caseNatureSelection === CUSTOM_CASE_NATURE_OPTION ? <div className="field field-full"><label htmlFor="customCaseNature">Précisez la nature *</label><input id="customCaseNature" name="customCaseNature" defaultValue={record.caseNature} maxLength={170} required /></div> : null}
          <div className="field"><label htmlFor="lastName">Nom</label><input id="lastName" name="lastName" defaultValue={record.lastName ?? ""} maxLength={100} /></div>
          <div className="field"><label htmlFor="firstNames">Prénoms</label><input id="firstNames" name="firstNames" defaultValue={record.firstNames ?? ""} maxLength={191} /></div>
          <div className="field field-full"><label htmlFor="address">Adresse</label><textarea id="address" name="address" defaultValue={record.address ?? ""} maxLength={2000} /></div>
          <div className="field"><label htmlFor="phone">Téléphone</label><input id="phone" name="phone" defaultValue={record.phone ?? ""} maxLength={50} /></div>
          <div className="field"><label htmlFor="email">E-mail</label><input id="email" name="email" type="email" defaultValue={record.email ?? ""} maxLength={191} /></div>
          <div className="field"><label htmlFor="contactPerson">Personne à contacter</label><input id="contactPerson" name="contactPerson" defaultValue={record.contactPerson ?? ""} maxLength={191} /></div>
          <div className="field"><label htmlFor="contactMobile">Mobile</label><input id="contactMobile" name="contactMobile" defaultValue={record.contactMobile ?? ""} maxLength={50} /></div>
        </div>
        <div className="inventory-correction-flags">
          <div className="field"><span className="field-label">Dossier dégradé ?</span><div className="radio-group"><label className="radio-option"><input type="radio" checked={!dossierDamaged} onChange={() => setDossierDamaged(false)} /> Non</label><label className="radio-option"><input type="radio" checked={dossierDamaged} onChange={() => setDossierDamaged(true)} /> Oui</label></div></div>
          {dossierDamaged ? <div className="field"><label htmlFor="dossierDamageNote">Observation sur la dégradation *</label><textarea id="dossierDamageNote" name="dossierDamageNote" defaultValue={record.dossierDamageNote ?? ""} maxLength={2000} required /></div> : null}
          <div className="field"><span className="field-label">Difficulté majeure ?</span><div className="radio-group"><label className="radio-option"><input type="radio" checked={!hasDifficulty} onChange={() => setHasDifficulty(false)} /> Non</label><label className="radio-option"><input type="radio" checked={hasDifficulty} onChange={() => setHasDifficulty(true)} /> Oui</label></div></div>
          {hasDifficulty ? <div className="field"><label htmlFor="difficultyNote">Description de la difficulté *</label><textarea id="difficultyNote" name="difficultyNote" defaultValue={record.difficultyNote ?? ""} maxLength={4000} required /></div> : null}
        </div>
        <div className="inventory-correction-signature">
          <SignaturePad label="Nouvelle signature de l’agent (facultative)" onChange={setSignature} />
          <label className="signature-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>Je confirme mes corrections et je renvoie cette fiche à mon superviseur.</span></label>
        </div>
        {error ? <p className="message message-error" role="alert">{error}</p> : null}
        <button className="button button-primary button-block" type="submit" disabled={pending}>{pending ? "Renvoi…" : "Renvoyer au superviseur"}</button>
      </div>
    </form>
  );
}
