import { z } from "zod";

export const newsCategories = [
  "Match Report",
  "Transfer News",
  "Injury Update",
  "League News",
  "Interview",
  "Opinion",
  "Other",
] as const;

/** Languages supported by the iOS app for content translation. */
export const contentLanguages = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "ar", label: "العربية" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
] as const;

export const newsSchema = z.object({
  language: z.enum(["en", "ar", "fr", "es", "de", "pt"]),
  title: z.string().min(1, "Title is required.").max(100, "Max 100 characters."),
  summary: z.string().max(300, "Max 300 characters.").optional(),
  body: z.string().min(1, "Content is required."),
  imageUrl: z.string().optional(),
  category: z.enum(newsCategories),
  sourceName: z.string().optional(),
  sourceUrl: z
    .union([
      z.literal(""),
      z.string().url("Must be a valid URL."),
    ])
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  isPublished: z.boolean(),
  isFeatured: z.boolean(),
  publishedAt: z.string().optional(),
  sourceType: z.enum(["manual", "api"]),
  externalArticleId: z.string().optional(),

  // Multilingual fields — stored as flat keys on the document.
  // The iOS app reads e.g. "title_ar" when the user selects Arabic.
  title_ar: z.string().max(100).optional(),
  summary_ar: z.string().max(300).optional(),
  body_ar: z.string().optional(),
  title_fr: z.string().max(100).optional(),
  summary_fr: z.string().max(300).optional(),
  body_fr: z.string().optional(),
  title_es: z.string().max(100).optional(),
  summary_es: z.string().max(300).optional(),
  body_es: z.string().optional(),
  title_de: z.string().max(100).optional(),
  summary_de: z.string().max(300).optional(),
  body_de: z.string().optional(),
  title_pt: z.string().max(100).optional(),
  summary_pt: z.string().max(300).optional(),
  body_pt: z.string().optional(),
});

export type NewsFormValues = z.infer<typeof newsSchema>;
