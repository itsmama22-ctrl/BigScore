import { z } from "zod";

export const sports = [
  "Football",
  "Basketball",
  "Tennis",
  "Cricket",
  "Rugby",
  "Baseball",
  "Hockey",
  "Volleyball",
  "Handball",
  "Other",
] as const;

export const teamTypes = ["club", "national", "mixed"] as const;

export const competitionSchema = z.object({
  name: z.string().min(1, "Name is required.").max(60, "Max 60 characters."),
  country: z.string().min(1, "Country is required."),
  sport: z.enum(sports),
  teamType: z.enum(teamTypes).default("club"),
  logoUrl: z.string().optional(),
  isActive: z.boolean(),
  displayOrder: z.coerce.number().int().min(0).default(0),
});

export type CompetitionFormValues = z.infer<typeof competitionSchema>;
