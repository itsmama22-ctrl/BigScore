export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { createAuditLog } from "@/lib/audit/createAuditLog";
import { createNewsProvider } from "@/lib/services/newsApiProvider";
import { FieldValue } from "firebase-admin/firestore";
import type { NewsApiProviderConfig, ExternalNewsArticle } from "@/models/newsArticle";

const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "ar", name: "Arabic" },
  { code: "fr", name: "French" },
  { code: "es", name: "Spanish" },
  { code: "de", name: "German" },
  { code: "pt", name: "Portuguese" },
];

const CATEGORY_COLORS: Record<string, string> = {
  "League News": "1e3a5f",
  "Transfer News": "5c1a1a",
  "Injury Update": "5c3a1a",
  "Interview": "1a3a2c",
  "Opinion": "2c1a3a",
  "Match Report": "1a2c3a",
  "Other": "2c2c2c",
};

function generatePlaceholderImage(article: ExternalNewsArticle): string {
  const category = article.category || "Other";
  const color = CATEGORY_COLORS[category] || "2c2c2c";

  let displayText = category;
  if (article.language === "ar") {
    const arMap: Record<string, string> = {
      "League News": "أخبار الدوري",
      "Transfer News": "انتقالات",
      "Injury Update": "إصابات",
      "Interview": "مقابلات",
      "Opinion": "آراء",
      "Match Report": "تقرير المباراة",
    };
    displayText = arMap[category] || category;
  }

  const encodedText = encodeURIComponent(displayText);

  return `https://placehold.co/800x450/${color}/FFFFFF?text=${encodedText}`;
}

function getRealImageOrNull(article: ExternalNewsArticle): string | null {
  if (article.imageUrl && article.imageUrl.startsWith("http") && !article.imageUrl.includes("placehold.co")) {
    return article.imageUrl;
  }
  return null;
}

function createDefaultProviders(): NewsApiProviderConfig[] {
  return SUPPORTED_LANGUAGES.map((lang, index) => ({
    id: `newsdata-${lang.code}`,
    name: `NewsData.io (${lang.name})`,
    providerType: "newsdata_io" as const,
    endpointUrl: "https://newsdata.io/api/1/news",
    apiKeySecretName: "NEWSDATA_IO_API_KEY",
    apiKeyMasked: process.env.NEWSDATA_IO_API_KEY
      ? `...${process.env.NEWSDATA_IO_API_KEY.slice(-4)}`
      : "",
    enabled: true,
    categoryMapping: {},
    fetchIntervalMinutes: 360,
    language: lang.code,
  }));
}

async function loadOrCreateConfig(): Promise<NewsApiProviderConfig[]> {
  const snap = await adminDb.collection("appSettings").doc("newsApi").get();

  if (snap.exists) {
    const data = snap.data();
    if (data && Array.isArray(data.apis)) {
      const configs = data.apis as NewsApiProviderConfig[];

      const hasLanguageField = configs.some((c) => c.language != null);

      if (!hasLanguageField && configs.length === 1) {
        const existing = configs[0];
        if (
          existing.providerType === "newsdata_io" &&
          process.env.NEWSDATA_IO_API_KEY
        ) {
          const newConfigs = SUPPORTED_LANGUAGES.map((lang, index) => ({
            ...existing,
            id: `newsdata-${lang.code}`,
            name: `NewsData.io (${lang.name})`,
            language: lang.code,
            enabled: true,
          }));

          await adminDb
            .collection("appSettings")
            .doc("newsApi")
            .set(
              {
                apis: newConfigs,
                updatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true }
            );

          console.log(
            "[news-sync] Auto-upgraded single provider to multi-language (6 languages)"
          );
          return newConfigs.filter((c) => c.enabled);
        }
      }

      return configs.filter((a) => a.enabled);
    }
  }

  if (process.env.NEWSDATA_IO_API_KEY) {
    const defaultProviders = createDefaultProviders();

    console.log(
      `[news-sync] No config found, creating default providers for ${defaultProviders.length} languages`
    );

    try {
      await adminDb
        .collection("appSettings")
        .doc("newsApi")
        .set({
          apis: defaultProviders,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

      console.log("[news-sync] Default providers saved to appSettings/newsApi");
    } catch (err) {
      console.warn(
        "[news-sync] Failed to save default providers (proceeding in-memory):",
        err
      );
    }

    return defaultProviders;
  }

  return [];
}

 async function verifyAuth(request: Request): Promise<boolean> {
   const url = new URL(request.url);

   const querySecret = url.searchParams.get("secret");
   const headerSecret = request.headers.get("x-sync-secret");
   const secret = querySecret || headerSecret;

   const isVercelCron = request.headers.get("x-vercel-cron") === "1";
   const configuredSecret = process.env.LIVE_SYNC_SECRET || process.env.NEWS_SYNC_SECRET;

   if (isVercelCron) {
     console.log("[news-sync] Vercel cron request detected - allowing");
     return true;
   }

   if (secret && configuredSecret && secret === configuredSecret) {
     return true;
   }

   const authHeader = request.headers.get("authorization");
   if (authHeader?.startsWith("Bearer ")) {
     try {
       const { getAuth } = await import("firebase-admin/auth");
       const token = await getAuth().verifyIdToken(authHeader.slice(7));
       return token.uid != null;
     } catch {
       return false;
     }
   }

   return false;
 }

async function runSync(): Promise<{
  success: boolean;
  created: number;
  updated: number;
  errors?: string[];
  error?: string;
}> {
  const configs = await loadOrCreateConfig();
  if (configs.length === 0) {
    return {
      success: false,
      created: 0,
      updated: 0,
      error: "No enabled news APIs configured. Please enable at least one provider in Admin Panel → Config → News API.",
    };
  }

  let totalCreated = 0;
  let totalUpdated = 0;
  const errors: string[] = [];

  const existingSnap = await adminDb
    .collection("news")
    .where("sourceType", "==", "api")
    .get();

  const existingByExternalId = new Map<string, string>();
  const existingBySourceUrl = new Map<string, string>();

  existingSnap.forEach((doc) => {
    const d = doc.data();
    if (d.externalArticleId) {
      existingByExternalId.set(d.externalArticleId, doc.id);
    }
    if (d.sourceUrl) {
      existingBySourceUrl.set(d.sourceUrl, doc.id);
    }
  });

  for (const config of configs) {
    try {
      const provider = createNewsProvider({
        ...config,
        apiKeySecretName: config.apiKeySecretName,
        apiKeyMasked: config.apiKeyMasked,
      } as NewsApiProviderConfig);

       const articles = await provider.fetchArticles();
       console.log(`[news-sync] Provider "${config.name}" returned ${articles.length} articles`);

       const withRealImages = articles.filter((a) => a.imageUrl && a.imageUrl.startsWith("http"));
       const withoutImages = articles.filter(
         (a) => !a.imageUrl || !a.imageUrl.startsWith("http")
       );

       console.log(
         `[news-sync]   → ${withRealImages.length} with REAL images, ${withoutImages.length} skipped (no image)`
       );

       const sortedArticles = withRealImages.slice(0, 30);
       const processedTitles = new Set<string>();

      for (const ext of sortedArticles) {
        const language = ext.language || config.language || "en";
        const titleLower = ext.title.toLowerCase().trim();
        const dedupKey = `${language}:${titleLower}`;

        if (processedTitles.has(dedupKey)) {
          continue;
        }
        processedTitles.add(dedupKey);

        const existingId = existingByExternalId.get(ext.externalId);
        const existingByUrl = ext.sourceUrl ? existingBySourceUrl.get(ext.sourceUrl) : undefined;
        const existingDocId = existingId || existingByUrl;

        const mappedCategory = config.categoryMapping[ext.category] || ext.category;
        const finalImageUrl = getRealImageOrNull({ ...ext, language });

        if (!finalImageUrl) {
          console.log(`[news-sync]   Skipping (no real image): ${ext.title}`);
          continue;
        }

        const langSuffix = language !== "en" ? `_${language}` : "";
        const titleLangKey = `title${langSuffix}`;
        const bodyLangKey = `body${langSuffix}`;

        const articleData = {
          title: ext.title,
          [titleLangKey]: ext.title,
          summary: ext.summary || null,
          body: ext.body,
          [bodyLangKey]: ext.body,
          image: finalImageUrl,
          imageUrl: finalImageUrl,
          category: "SOCCER",
          newsType: mappedCategory,
          sourceName: ext.sourceName,
          sourceUrl: ext.sourceUrl || null,
          url: ext.sourceUrl || "",
          isPublished: true,
          isFeatured: false,
          isActive: true,
          sourceType: "api" as const,
          externalArticleId: ext.externalId,
          language: language,
          publishedAt: ext.publishedAt,
          timestamp: ext.publishedAt,
          updatedAt: FieldValue.serverTimestamp(),
        };

        if (existingDocId) {
          await adminDb.collection("news").doc(existingDocId).update(articleData);
          totalUpdated++;
        } else {
          await adminDb.collection("news").add({
            ...articleData,
            createdAt: FieldValue.serverTimestamp(),
          });
          totalCreated++;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown";
      console.error(`[news-sync] Provider "${config.name}" failed:`, message);
      errors.push(`${config.name}: ${message}`);
    }
  }

  const syncStatus = errors.length === 0 ? "success" : "partial";
  await adminDb.collection("appSettings").doc("newsApi").set(
    {
      lastSyncAt: FieldValue.serverTimestamp(),
      lastSyncStatus: syncStatus,
      lastSyncResult: { created: totalCreated, updated: totalUpdated, errors },
    },
    { merge: true }
  );

  await createAuditLog({
    actorUid: "api-sync",
    actorEmail: "system@bigscore.com",
    action: "create",
    resourceType: "newsApi",
    description: `News API sync: ${totalCreated} created, ${totalUpdated} updated.`,
  });

  console.log(`[news-sync] Complete: ${totalCreated} created, ${totalUpdated} updated, ${errors.length} errors`);

  return {
    success: errors.length === 0 || totalCreated > 0 || totalUpdated > 0,
    created: totalCreated,
    updated: totalUpdated,
    errors: errors.length > 0 ? errors : undefined,
  };
}

export async function POST(request: Request) {
  if (!(await verifyAuth(request))) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  const result = await runSync();

  if (!result.success && result.error) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const triggerSync = url.searchParams.get("sync") === "1" || url.searchParams.has("secret");

  if (triggerSync) {
    if (!(await verifyAuth(request))) {
      return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
    }

    const result = await runSync();

    if (!result.success && result.error) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  }

  const snap = await adminDb.collection("appSettings").doc("newsApi").get();
  if (!snap.exists) {
    return NextResponse.json({ lastSyncAt: null, lastSyncStatus: "never" });
  }
  const data = snap.data()!;
  return NextResponse.json({
    lastSyncAt: data.lastSyncAt ?? null,
    lastSyncStatus: data.lastSyncStatus ?? "never",
    lastSyncResult: data.lastSyncResult ?? null,
  });
}
