import type { SourceMetadata, ManualOverrides } from "./shared";

export type TeamType = "club" | "national";

export interface Team {
  id: string;
  name: string;
  shortName?: string;
  logoUrl?: string;
  country: string;
  sport: string;
  type: TeamType;
  competitionIds: string[];
  isActive: boolean;
  isNational: boolean;
  externalId?: string;
  source: SourceMetadata;
  manualOverrides: ManualOverrides;
  createdAt: { seconds: number };
  updatedAt: { seconds: number };
}
