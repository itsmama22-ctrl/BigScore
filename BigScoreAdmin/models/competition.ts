import type { SourceMetadata, ManualOverrides } from "./shared";

export type TeamType = "club" | "national" | "mixed";

export interface Competition {
  id: string;
  name: string;
  logoUrl?: string;
  country: string;
  season: string;
  sport: string;
  teamType: TeamType;
  isActive: boolean;
  displayOrder: number;
  externalId?: string;
  source: SourceMetadata;
  manualOverrides: ManualOverrides;
  createdAt: { seconds: number };
  updatedAt: { seconds: number };
}
