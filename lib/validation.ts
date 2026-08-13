import { z } from "zod";

import { INVENTORY_DIRECTIONS, ROLES } from "../types/domain";

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional(),
  );

const nullableEmail = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.email("Adresse e-mail invalide.").max(191).optional(),
);

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Saisissez votre identifiant.").max(191),
  password: z.string().min(1, "Saisissez votre mot de passe.").max(200),
});

const userFields = {
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: nullableEmail,
  login: z.string().trim().min(3).max(100).regex(/^[a-zA-Z0-9._-]+$/),
  agentCode: optionalText(30),
  role: z.enum(ROLES),
  isActive: z.boolean().default(true),
};

export const createUserSchema = z
  .object({
    ...userFields,
    password: z.string().min(10, "Le mot de passe doit contenir au moins 10 caractères.").max(200),
  })
  .superRefine((data, context) => {
    if (data.role === "agent" && !data.agentCode) {
      context.addIssue({ code: "custom", path: ["agentCode"], message: "Le code agent est obligatoire." });
    }
  });

export const updateUserSchema = z
  .object({
    ...userFields,
    password: z.string().min(10).max(200).optional(),
  })
  .partial()
  .superRefine((data, context) => {
    if (data.role === "agent" && data.agentCode === undefined) {
      context.addIssue({ code: "custom", path: ["agentCode"], message: "Le code agent est obligatoire." });
    }
  });

export const teamSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Le code équipe est obligatoire.")
    .max(30)
    .regex(/^[a-zA-Z0-9._/-]+$/, "Utilisez uniquement lettres, chiffres, tiret, point ou barre.")
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2, "Le nom de l’équipe est obligatoire.").max(120),
  direction: z.enum(INVENTORY_DIRECTIONS, "Choisissez une direction d’inventaire dans la liste."),
  supervisorUserId: z.coerce.number().int().positive(),
  memberUserIds: z.array(z.coerce.number().int().positive()).max(500).default([]),
});

export const createCartonSchema = z
  .object({
    libelle: z.string().trim().min(1, "Le libellé du carton est obligatoire.").max(255),
    barcode: optionalText(100),
    cartonDamaged: z.boolean().default(false),
    cartonDamageNote: optionalText(2_000),
  })
  .superRefine((data, context) => {
    if (data.cartonDamaged && !data.cartonDamageNote) {
      context.addIssue({
        code: "custom",
        path: ["cartonDamageNote"],
        message: "Décrivez la dégradation du carton.",
      });
    }
  });

const inventoryFields = {
  cartonId: z.coerce.number().int().positive().optional(),
  carton: z
    .object({
      libelle: z.string().trim().min(1, "Le libellé du carton est obligatoire.").max(255),
      barcode: optionalText(100),
    })
    .optional(),
  clientRequestId: z.uuid(),
  guichetNumber: optionalText(100),
  dduNumber: optionalText(100),
  classificationReference: optionalText(191),
  ilotNumber: optionalText(100),
  lotNumber: optionalText(100),
  surfaceArea: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.coerce.number().nonnegative().max(999_999_999_999.99).optional(),
  ),
  landTitleNumber: optionalText(100),
  housingEstate: optionalText(191),
  commune: optionalText(191),
  caseNature: z.string().trim().min(1, "La nature du dossier est obligatoire.").max(191),
  lastName: optionalText(100),
  firstNames: optionalText(191),
  address: optionalText(2_000),
  phone: optionalText(50),
  email: nullableEmail,
  contactPerson: optionalText(191),
  contactMobile: optionalText(50),
  dossierDamaged: z.boolean().default(false),
  dossierDamageNote: optionalText(2_000),
  hasDifficulty: z.boolean().default(false),
  difficultyNote: optionalText(4_000),
  closeCarton: z.boolean().default(false),
};

function validateInventoryDetails(
  data: {
    dossierDamaged: boolean;
    dossierDamageNote?: string;
    hasDifficulty: boolean;
    difficultyNote?: string;
    guichetNumber?: string;
    dduNumber?: string;
    classificationReference?: string;
    landTitleNumber?: string;
    lastName?: string;
  },
  context: z.RefinementCtx,
) {
  if (data.dossierDamaged && !data.dossierDamageNote) {
    context.addIssue({
      code: "custom",
      path: ["dossierDamageNote"],
      message: "Décrivez la dégradation du dossier.",
    });
  }
  if (data.hasDifficulty && !data.difficultyNote) {
    context.addIssue({
      code: "custom",
      path: ["difficultyNote"],
      message: "Décrivez la difficulté rencontrée.",
    });
  }
  const identifiers = [
    data.guichetNumber,
    data.dduNumber,
    data.classificationReference,
    data.landTitleNumber,
    data.lastName,
  ];
  if (!identifiers.some(Boolean)) {
    context.addIssue({
      code: "custom",
      path: ["classificationReference"],
      message: "Renseignez au moins une référence ou le nom de la personne concernée.",
    });
  }
}

export const createInventorySchema = z.object(inventoryFields).superRefine((data, context) => {
  if ((!data.cartonId && !data.carton) || (data.cartonId && data.carton)) {
    context.addIssue({
      code: "custom",
      path: ["carton"],
      message: "Indiquez le carton en cours ou les informations du nouveau carton.",
    });
  }
  validateInventoryDetails(data, context);
});

export const updateInventorySchema = z
  .object(inventoryFields)
  .omit({ cartonId: true, carton: true, clientRequestId: true, closeCarton: true })
  .superRefine(validateInventoryDetails);

export const inventoryListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: optionalText(191),
});

export const dashboardQuerySchema = z.object({
  period: z.enum(["day", "week", "month"]).default("day"),
});

const signatureDataUrl = z
  .string()
  .max(500_000, "La signature est trop volumineuse.")
  .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, "La signature doit être une image PNG valide.");

export const reportSignatureSchema = z.object({
  signatureDataUrl,
  consent: z.boolean().refine(Boolean, "Vous devez confirmer votre visa électronique."),
  comment: optionalText(2_000),
});

export const reportRejectionSchema = z.object({
  reason: z.string().trim().min(5, "Expliquez la correction attendue.").max(2_000),
});
