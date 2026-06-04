/**
 * Shared metadata types used across all Firestore collections.
 * Every imported document carries a `source` block tracking its origin.
 */

export type SourceType = "manual" | "api" | "mixed";

export type ApiProvider = "api-football" | "openligadb" | "football-data";

export interface SourceMetadata {
  /** How this document was created: manually by admin, from an external API, or a mix of both */
  type: SourceType;

  /** Which API provider synced this document (null for manual) */
  provider: ApiProvider | null;

  /** External ID from the provider (null for manual) */
  externalId: string | null;

  /** Last time an API sync touched this document */
  lastSyncedAt: { seconds: number } | null;

  /** Last time a manual admin edit touched this document */
  lastManualEditAt: { seconds: number } | null;
}

export interface ManualOverrides {
  /** Whether manual overrides are enabled for this document */
  enabled: boolean;

  /** List of field paths that the admin has manually locked (API sync won't overwrite) */
  fields: string[];
}

/**
 * Firebase-compatible timestamp.
 */
export interface FirebaseTimestamp {
  seconds: number;
  nanoseconds: number;
  toDate: () => Date;
}
