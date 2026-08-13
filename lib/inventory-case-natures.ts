import type { InventoryDirection } from "../types/domain";

export const CUSTOM_CASE_NATURE_OPTION = "__OTHER__";
export const CUSTOM_CASE_NATURE_PREFIX = "Autre : ";

const COMMON_CASE_NATURES = [
  "Dossier de base",
  "Correspondance administrative",
  "Rapport / procès-verbal",
] as const;

function withCommon(...items: string[]) {
  return [...new Set([...items, ...COMMON_CASE_NATURES])];
}

export const CASE_NATURES_BY_DIRECTION = {
  GUF: withCommon(
    "Demande d’ACD",
    "ACD",
    "Titre foncier",
    "Attestation domaniale",
    "Mutation / transfert de propriété",
  ),
  DDU: withCommon(
    "Demande d’ACD",
    "ACD",
    "Titre foncier",
    "Attestation domaniale",
    "Mutation / transfert de propriété",
    "Plan de lotissement",
  ),
  DUDU: withCommon(
    "Dossier de lotissement",
    "Plan de lotissement",
    "Certificat d’urbanisme",
    "Plan d’urbanisme",
    "Schéma directeur d’urbanisme",
  ),
  DGUF: withCommon(
    "Demande d’ACD",
    "ACD",
    "Titre foncier",
    "Dossier de lotissement",
    "Plan topographique",
    "IDUFCI / dossier SIGFU",
  ),
  DTC: withCommon(
    "Plan topographique",
    "Plan cadastral",
    "Plan de bornage",
    "Plan de situation",
    "Plan de lotissement",
    "Extrait topographique",
  ),
  GUPCCU: withCommon(
    "Permis de construire",
    "Autorisation de construire",
    "Plan architectural",
    "Plan de masse",
    "Plan de structure",
    "Certificat de conformité",
  ),
  AGEF: withCommon(
    "Dossier d’aménagement foncier",
    "Convention d’aménagement",
    "Plan de lotissement",
    "Plan topographique",
    "Titre foncier",
    "ACD",
  ),
  SDA: withCommon(
    "Archives / versement",
    "Dossier de base",
    "ACD",
    "Titre foncier",
    "Plan de lotissement",
  ),
  SCPA: withCommon(
    "Plan cadastral",
    "Plan topographique",
    "Plan de bornage",
    "Plan de situation",
    "Extrait topographique",
  ),
  SBICU: withCommon(
    "Dossier de contrôle urbain",
    "Procès-verbal d’infraction",
    "Constat d’occupation",
    "Mise en demeure",
    "Permis de construire",
  ),
  DGCMA: withCommon(
    "Permis de construire",
    "Autorisation de construire",
    "Plan architectural",
    "Plan de masse",
    "Plan de structure",
    "Certificat de conformité",
  ),
  DEMA: withCommon(
    "Dossier d’étude",
    "Plan architectural",
    "Plan de masse",
    "Plan de structure",
    "Avis technique",
  ),
  DCM: withCommon(
    "Dossier de chantier / maintenance",
    "Marché de travaux",
    "Plan architectural",
    "Plan de structure",
    "Rapport de chantier",
  ),
  DMISSA: withCommon(
    "IDUFCI / dossier SIGFU",
    "Acte foncier numérisé",
    "Données cartographiques",
    "Dossier de sécurisation des actes",
  ),
  DGLCV: withCommon(
    "Dossier de logement social",
    "Attribution de logement",
    "Contrat de bail",
    "Programme immobilier",
    "Réhabilitation de l’habitat",
  ),
  DICAF: withCommon(
    "Audit / inspection",
    "Dossier administratif et financier",
    "Marché de travaux",
    "Rapport de contrôle",
  ),
  DGLPI: withCommon(
    "Programme immobilier",
    "Agrément de promoteur immobilier",
    "Dossier de logement social",
    "Attribution de logement",
    "Convention immobilière",
  ),
  DCCV: withCommon(
    "Dossier de contrôle urbain",
    "Certificat de conformité",
    "Procès-verbal d’infraction",
    "Constat d’occupation",
    "Mise en demeure",
  ),
  SALA: withCommon(
    "Attribution de logement",
    "Aide au logement",
    "Location-accession",
    "Contrat de bail",
    "Dossier de logement social",
  ),
  DARRU: withCommon(
    "Projet d’aménagement urbain",
    "Plan d’aménagement",
    "Dossier de rénovation urbaine",
    "Dossier de restructuration urbaine",
    "Dossier de relogement",
  ),
  ANAH: withCommon(
    "Réhabilitation de l’habitat",
    "Amélioration de l’habitat",
    "Aide au logement",
    "Dossier de logement social",
  ),
  SONAPIE: withCommon(
    "Patrimoine immobilier de l’État",
    "Inventaire immobilier",
    "Contrat de bail",
    "Attribution de logement",
    "Dossier de maintenance",
  ),
  DAJC: withCommon(
    "Dossier contentieux",
    "Recours administratif",
    "Avis juridique",
    "Contrat / convention",
    "Arrêté / décision administrative",
  ),
} satisfies Record<InventoryDirection, readonly string[]>;

export const ALL_CASE_NATURES = [
  ...new Set(Object.values(CASE_NATURES_BY_DIRECTION).flat()),
];

export function getCaseNaturesForDirection(direction: InventoryDirection | null) {
  return direction ? CASE_NATURES_BY_DIRECTION[direction] : ALL_CASE_NATURES;
}

export function formatSelectedCaseNature(selection: string, customValue: string) {
  return selection === CUSTOM_CASE_NATURE_OPTION
    ? `${CUSTOM_CASE_NATURE_PREFIX}${customValue.trim()}`
    : selection.trim();
}

export function isCaseNatureAllowedForDirection(
  caseNature: string,
  direction: InventoryDirection | null,
) {
  const normalized = caseNature.trim();
  if (normalized.startsWith(CUSTOM_CASE_NATURE_PREFIX)) {
    return normalized.slice(CUSTOM_CASE_NATURE_PREFIX.length).trim().length >= 2;
  }
  return getCaseNaturesForDirection(direction).includes(normalized);
}
