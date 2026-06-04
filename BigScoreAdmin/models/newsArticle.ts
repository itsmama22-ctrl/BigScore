import type { SourceMetadata, ManualOverrides } from "./shared";

export type NewsSourceType = "manual" | "api";

export interface NewsArticle {
  id: string;
  title: string;
  summary?: string;
  body: string;
  imageUrl?: string;
  category: string;
  sourceName?: string;
  sourceUrl?: string;
  isPublished: boolean;
  isFeatured: boolean;
  isActive: boolean;
  sourceType: NewsSourceType;
  externalArticleId?: string;
  publishedAt?: { seconds: number };
  source: SourceMetadata;
  manualOverrides: ManualOverrides;
  createdAt: { seconds: number };
  updatedAt: { seconds: number };
  createdBy?: string;
  language?: string;
}

export interface NewsApiConfig {
  apis: NewsApiProviderConfig[];
  updatedAt?: { seconds: number };
}

export interface NewsApiProviderConfig {
  id: string;
  name: string;
  providerType: "newsdata_io" | "mock" | "custom";
  endpointUrl: string;
  apiKeySecretName: string;
  apiKeyMasked: string;
  enabled: boolean;
  categoryMapping: Record<string, string>;
  fetchIntervalMinutes: number;
  language?: string;
}

export interface ExternalNewsArticle {
  externalId: string;
  title: string;
  summary?: string;
  body: string;
  imageUrl?: string;
  category: string;
  sourceName: string;
  sourceUrl?: string;
  publishedAt: Date;
  language?: string;
}
