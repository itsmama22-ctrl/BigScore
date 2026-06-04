"use server";

import { adminDb } from "@/lib/firebase/admin";
import { createAuditLog } from "@/lib/audit/createAuditLog";
import { createNewsProvider } from "@/lib/services/newsApiProvider";
import { FieldValue } from "firebase-admin/firestore";
import type { NewsApiProviderConfig, ExternalNewsArticle } from "@/models/newsArticle";


function getRealImageOrNull(
  imageUrl: string | null | undefined
): string | null {
  if (imageUrl && imageUrl.startsWith("http") && !imageUrl.includes("placehold.co")) {
    return imageUrl;
  }
  return null;
}

interface FetchedArticle {
  id: string;
  externalId: string;
  title: string;
  summary?: string;
  body: string;
  imageUrl?: string;
  category: string;
  sourceName: string;
  sourceUrl?: string;
  publishedAt: string;
  existsInDb: boolean;
  duplicateOf?: string;
}

interface FetchResult {
  success: boolean;
  articles: FetchedArticle[];
  error?: string;
}

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
}

interface Actor { uid: string; email: string; role: string }

 function authorize(role: string): boolean {
   return role === "super_admin" || role === "content_manager";
 }

 function normalizeTitle(title: string): string {
   return title
     .toLowerCase()
     .replace(/[^a-z0-9]/g, "")
     .trim();
 }

 function normalizeForDedup(title: string, summary?: string): string {
   const base = normalizeTitle(title);
   if (summary && summary.length > 20) {
     return base + normalizeTitle(summary.slice(0, 100));
   }
   return base;
 }

// ─── Fetch Articles ───────────────────────────────────────────

 export async function fetchNewsFromApiAction(input: {
   actor: Actor;
 }): Promise<FetchResult> {
   const { actor } = input;

   if (!authorize(actor.role)) {
     return { success: false, articles: [], error: "Permission denied." };
   }

   try {
     const configSnap = await adminDb.collection("appSettings").doc("newsApi").get();
     const configs: NewsApiProviderConfig[] = configSnap.exists
       ? (configSnap.data()?.apis as NewsApiProviderConfig[]) ?? []
       : [];

     const activeConfigs = configs.length > 0
       ? configs.filter((c) => c.enabled)
       : [{ id: "mock", name: "Mock Provider", endpointUrl: "", apiKeySecretName: "", apiKeyMasked: "", enabled: true, categoryMapping: {}, fetchIntervalMinutes: 60 }];

      console.log(`[fetchNewsFromApiAction] Found ${activeConfigs.length} active provider(s)`);

        const tempArticles: Map<string, { article: ExternalNewsArticle; hasImage: boolean }> = new Map();

       for (const config of activeConfigs) {
         try {
           const provider = createNewsProvider(config as NewsApiProviderConfig);
           const raw = await provider.fetchArticles();

           for (const ext of raw) {
             const normalizedTitle = normalizeTitle(ext.title);
             const normalizedFull = normalizeForDedup(ext.title, ext.summary);
             const key = normalizedTitle;
             
             const hasImage = !!(ext.imageUrl && ext.imageUrl.startsWith("http"));
             const existing = tempArticles.get(key);
             
             if (existing) {
               if (hasImage && !existing.hasImage) {
                 console.log(`[fetchNewsFromApiAction] Replacing "${ext.title.slice(0, 60)}" with version that has image`);
                 tempArticles.set(key, { article: ext, hasImage: true });
               } else {
                 console.log(`[fetchNewsFromApiAction] Skipping duplicate: "${ext.title.slice(0, 60)}"`);
               }
             } else {
               tempArticles.set(key, { article: ext, hasImage });
             }
           }
         } catch (err) {
           console.error(`[newsImport] Provider ${config.name} failed:`, err);
         }
       }

       const allArticles: FetchedArticle[] = [];
       
       for (const { article: ext, hasImage } of tempArticles.values()) {
         if (!hasImage) {
           console.log(`[fetchNewsFromApiAction] Skipping "${ext.title.slice(0, 60)}" — no real image`);
           continue;
         }
        const existingByExternalId = await adminDb
          .collection("news")
          .where("externalArticleId", "==", ext.externalId)
          .get();

        const existingByTitle = await adminDb
          .collection("news")
          .where("title", "==", ext.title)
          .get();

        let existsInDb = false;
        let duplicateOf: string | undefined;

        if (!existingByExternalId.empty) {
          existsInDb = true;
          duplicateOf = existingByExternalId.docs[0].id;
        } else if (!existingByTitle.empty) {
          existsInDb = true;
          duplicateOf = existingByTitle.docs[0].id;
        }

        allArticles.push({
          id: ext.externalId,
          externalId: ext.externalId,
          title: ext.title,
          summary: ext.summary,
          body: ext.body,
          imageUrl: ext.imageUrl,
          category: ext.category,
          sourceName: ext.sourceName,
          sourceUrl: ext.sourceUrl,
          publishedAt: ext.publishedAt.toISOString(),
          existsInDb,
          duplicateOf,
        });
      }

      const withImages = allArticles.filter(a => a.imageUrl).length;
      console.log(`[fetchNewsFromApiAction] Total: ${allArticles.length} unique articles (${withImages} with images)`);
      return { success: true, articles: allArticles };
   } catch (err) {
     console.error("[fetchNewsFromApiAction] Exception:", err);
     return { success: false, articles: [], error: err instanceof Error ? err.message : "Fetch failed." };
   }
 }

// ─── Import Selected ──────────────────────────────────────────

export async function importNewsArticlesAction(input: {
  articles: FetchedArticle[];
  actor: Actor;
}): Promise<ImportResult> {
  const { articles, actor } = input;

  if (!authorize(actor.role)) {
    return { success: false, imported: 0, skipped: articles.length, errors: ["Permission denied."] };
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const article of articles) {
    // Skip duplicates
    if (article.existsInDb) {
      skipped++;
      continue;
    }

    // Validate
    if (!article.title?.trim()) {
      errors.push(`Skipped: "${article.title || "untitled"}" — missing title.`);
      skipped++;
      continue;
    }

    if (article.sourceUrl && !/^https?:\/\/.+/.test(article.sourceUrl)) {
      errors.push(`Skipped: "${article.title}" — invalid sourceUrl.`);
      skipped++;
      continue;
    }

try {
         const finalCategory = article.category || "Other";
         const finalImageUrl = getRealImageOrNull(article.imageUrl);

         if (!finalImageUrl) {
           errors.push(`Skipped: "${article.title}" — no real image available.`);
           skipped++;
           continue;
         }

         await adminDb.collection("news").add({
          title: article.title,
          title_en: article.title,
          summary: article.summary || null,
          body: article.body || "",
          body_en: article.body || "",
          image: finalImageUrl,
          imageUrl: finalImageUrl,
          category: "SOCCER",
          newsType: finalCategory,
          sourceName: article.sourceName || "API Import",
          sourceUrl: article.sourceUrl || null,
          url: article.sourceUrl || "",
          isPublished: true,
          isFeatured: false,
          isActive: true,
          sourceType: "api",
          externalArticleId: article.externalId,
          publishedAt: new Date(article.publishedAt),
          timestamp: new Date(article.publishedAt),
          source: {
            type: "api",
            provider: article.sourceName || "api-import",
            externalId: article.externalId,
            lastSyncedAt: FieldValue.serverTimestamp(),
            lastManualEditAt: null,
          },
          manualOverrides: { enabled: false, fields: [] },
          createdBy: actor.uid,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        imported++;
      } catch (err) {
        errors.push(`Failed: "${article.title}" — ${err instanceof Error ? err.message : "Unknown error"}.`);
        skipped++;
      }
  }

  if (imported > 0) {
    await createAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      action: "create",
      resourceType: "news",
      description: `Imported ${imported} news articles from API.`,
    });
  }

  return { success: true, imported, skipped, errors };
}
