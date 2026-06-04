import { z } from "zod";

export const teamSchema = z.object({
  name: z.string().min(1, "Name is required.").max(60, "Max 60 characters."),
  shortName: z.string().max(10, "Max 10 characters.").optional(),
  logoUrl: z.string().optional(),
  country: z.string().min(1, "Country is required."),
  sport: z.string().min(1, "Sport is required."),
  isActive: z.boolean(),
});

export type TeamFormValues = z.infer<typeof teamSchema>;
