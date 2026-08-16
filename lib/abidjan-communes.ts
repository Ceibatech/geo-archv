export const ABIDJAN_COMMUNES = [
  "Abobo",
  "Adjamé",
  "Attécoubé",
  "Bouaké",
  "Cocody",
  "Daloa",
  "Koumassi",
  "Marcory",
  "Plateau",
  "Port-Bouët",
  "San Pedro",
  "Treichville",
  "Yamoussoukro",
  "Yopougon",
] as const;

export type AbidjanCommune = (typeof ABIDJAN_COMMUNES)[number];
