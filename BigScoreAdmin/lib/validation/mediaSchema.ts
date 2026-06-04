import { z } from "zod";

const currentYear = new Date().getFullYear();

export const ratingOptions = ["G", "PG", "PG-13", "R", "NC-17", "Unrated"] as const;

export const mediaCategories = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "Horror",
  "Mystery",
  "Romance",
  "Science Fiction",
  "Sport",
  "Thriller",
  "War",
  "Western",
] as const;

export const mediaSchema = z
  .object({
    type: z.enum(["movie", "series"], { required_error: "Content type is required." }),
    title: z.string().min(1, "Title is required.").max(100, "Max 100 characters."),
    description: z.string().max(500, "Max 500 characters.").optional(),
    posterUrl: z.string().min(1, "Poster image is required."),
    backdropUrl: z.string().optional(),
    releaseYear: z.coerce
      .number()
      .int()
      .min(1900, "Year must be 1900 or later.")
      .max(currentYear + 1, `Year must be ${currentYear + 1} or earlier.`)
      .optional(),
    durationMinutes: z.coerce.number().int().min(1, "Must be 1 minute or more.").optional(),
    categories: z.array(z.string()),
    rating: z.enum(ratingOptions).optional(),
    videoUrl: z
      .union([z.literal(""), z.string().url("Must be a valid URL.")])
      .optional()
      .transform((v) => (v === "" ? undefined : v)),
    isActive: z.boolean(),
    isFeatured: z.boolean(),
    licenseStatus: z.enum(["verified", "pending", "expired"]),
    licenseExpiresAt: z.string().optional(),
    providerName: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.type !== "movie") return true;
      return data.durationMinutes !== undefined;
    },
    {
      message: "Duration is required for movies.",
      path: ["durationMinutes"],
    }
  );

export type MediaFormValues = z.infer<typeof mediaSchema>;
