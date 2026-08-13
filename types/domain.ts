export const ROLES = ["admin", "agent", "superviseur", "executif"] as const;
export const INVENTORY_DIRECTIONS = [
  "DCM",
  "DEMA",
  "SDA",
  "DTC",
  "DAJC",
  "DDU",
  "DGUF",
  "SBICU",
  "GUF",
] as const;

export type Role = (typeof ROLES)[number];
export type InventoryDirection = (typeof INVENTORY_DIRECTIONS)[number];

export type AuthUser = {
  id: number;
  firstName: string;
  lastName: string;
  login: string;
  email: string | null;
  agentCode: string | null;
  role: Role;
};

export type CartonStatus = "OPEN" | "CLOSED";
export type DailyReportStatus = "PENDING_SUPERVISOR" | "APPROVED" | "REJECTED";
export type DailyReportEmailStatus = "NOT_SENT" | "SENT" | "FAILED";

export type DailyReportSummary = {
  id: number;
  reportDate: string;
  agentUserId: number;
  agentName: string;
  agentCode: string | null;
  agentEmail: string | null;
  supervisorUserId: number;
  supervisorName: string;
  supervisorEmail: string | null;
  teamId: number;
  teamCode: string;
  teamName: string;
  direction: InventoryDirection;
  status: DailyReportStatus;
  version: number;
  cartonsCount: number;
  dossiersCount: number;
  degradedCartonsCount: number;
  degradedDossiersCount: number;
  majorDifficulties: string | null;
  agentSignatureSha256: string;
  agentSignedAt: string;
  supervisorSignatureSha256: string | null;
  supervisorSignedAt: string | null;
  supervisorComment: string | null;
  rejectionReason: string | null;
  emailStatus: DailyReportEmailStatus;
  resendEmailId: string | null;
  emailSentAt: string | null;
  emailError: string | null;
};

export type DailyReportPreview = {
  reportDate: string;
  teamId: number;
  teamCode: string;
  teamName: string;
  direction: InventoryDirection;
  supervisorName: string;
  cartonsCount: number;
  dossiersCount: number;
  degradedCartonsCount: number;
  degradedDossiersCount: number;
  majorDifficulties: string | null;
};

export type Carton = {
  id: number;
  cartonUid: string;
  libelle: string;
  barcode: string | null;
  cartonDamaged: boolean;
  cartonDamageNote: string | null;
  status: CartonStatus;
  createdBy: number;
  agentCode: string | null;
  agentName: string;
  createdAt: string;
  updatedAt: string;
  dossierCount: number;
};

export type InventoryRecordListItem = {
  id: number;
  cartonId: number;
  cartonUid: string;
  caseNature: string;
  guichetNumber: string | null;
  dduNumber: string | null;
  classificationReference: string | null;
  commune: string | null;
  lastName: string | null;
  firstNames: string | null;
  dossierDamaged: boolean;
  inventoryDate: string;
  agentCode: string | null;
  agentName: string;
};
