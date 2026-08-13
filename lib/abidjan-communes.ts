export const ABIDJAN_COMMUNES = [
  "Abobo",
  "Adjamé",
  "Attécoubé",
  "Cocody",
  "Koumassi",
  "Marcory",
  "Plateau",
  "Port-Bouët",
  "Treichville",
  "Yopougon",
] as const;

export type AbidjanCommune = (typeof ABIDJAN_COMMUNES)[number];
