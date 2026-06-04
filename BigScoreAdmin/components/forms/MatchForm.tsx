"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  collection,
  query as firestoreQuery,
  orderBy,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import {
  matchSchema,
  type MatchFormValues,
} from "@/lib/validation/matchSchema";
import { useAuth } from "@/hooks/useAuth";
import {
  createMatchAction,
  updateMatchAction,
} from "@/app/actions/matches";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox, type ComboboxOption } from "@/components/forms/Combobox";

import { cn } from "@/lib/utils";
import {
  Save,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Video,
} from "lucide-react";

interface TeamOption {
  id: string;
  name: string;
  sport?: string;
  competitionIds: string[];
  isNational: boolean;
  type: "club" | "national";
  country: string;
}

interface CompetitionOption {
  id: string;
  name: string;
  country?: string;
  sport?: string;
  teamType: "club" | "national" | "mixed";
}

function inferTeamTypeFromCompetitionName(name: string): "club" | "national" {
  const nameLower = name.toLowerCase();

  if (nameLower.includes("world cup") && !nameLower.includes("club world cup")) return "national";
  if (nameLower.includes("fifa world cup")) return "national";
  if (nameLower.includes("euro")) {
    if (nameLower.includes("league") || nameLower.includes("europa")) return "club";
    return "national";
  }
  if (nameLower.includes("european championship")) return "national";
  if (nameLower.includes("copa america")) return "national";
  if (nameLower.includes("african cup") || nameLower.includes("afcon")) return "national";
  if (nameLower.includes("asian cup")) return "national";
  if (nameLower.includes("arab cup")) return "national";
  if (nameLower.includes("nations league")) return "national";
  if (nameLower.includes("gold cup")) return "national";
  if (nameLower.includes("friendly")) return "national";
  if (nameLower.includes("international")) return "national";
  if (nameLower.includes("world cup qualification") || nameLower.includes("world cup qualif")) return "national";
  if (nameLower.includes("euro qualification") || nameLower.includes("euro qualif")) return "national";

  if (nameLower.includes("club world cup")) return "club";
  if (nameLower.includes("champions league")) return "club";
  if (nameLower.includes("europa league")) return "club";
  if (nameLower.includes("europa conference")) return "club";
  if (nameLower.includes("uefa conference")) return "club";
  if (nameLower.includes("copa libertadores")) return "club";
  if (nameLower.includes("caf champions")) return "club";
  if (nameLower.includes("caf confederation")) return "club";
  if (nameLower.includes("afc champions")) return "club";
  if (nameLower.includes("afc cup")) return "club";
  if (nameLower.includes("premier league")) return "club";
  if (nameLower.includes("la liga")) return "club";
  if (nameLower.includes("bundesliga")) return "club";
  if (nameLower.includes("serie a")) return "club";
  if (nameLower.includes("ligue 1")) return "club";
  if (nameLower.includes("eredivisie")) return "club";
  if (nameLower.includes("primeira liga")) return "club";
  if (nameLower.includes("liga portugal")) return "club";
  if (nameLower.includes("süper lig")) return "club";
  if (nameLower.includes("super lig")) return "club";
  if (nameLower.includes("brasileirão")) return "club";
  if (nameLower.includes("brasileirao")) return "club";
  if (nameLower.includes("primera división")) return "club";
  if (nameLower.includes("liga profesional")) return "club";
  if (nameLower.includes("major league soccer")) return "club";
  if (nameLower.includes("mls")) return "club";
  if (nameLower.includes("liga mx")) return "club";
  if (nameLower.includes("pro league") && nameLower.includes("saudi")) return "club";
  if (nameLower.includes("saudi pro league")) return "club";
  if (nameLower.includes("stars league")) return "club";
  if (nameLower.includes("qatar stars")) return "club";
  if (nameLower.includes("premier league") && nameLower.includes("egypt")) return "club";
  if (nameLower.includes("egyptian premier")) return "club";
  if (nameLower.includes("premier soccer league")) return "club";
  if (nameLower.includes("south african premier")) return "club";
  if (nameLower.includes("botola")) return "club";

  return "club";
}

const SPORTS = [
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

const languageOptions = [
  { code: "en", label: "English" },
  { code: "ar", label: "Arabic" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "tr", label: "Turkish" },
  { code: "nl", label: "Dutch" },
  { code: "ru", label: "Russian" },
] as const;

const watchQualityOptions = [
  { value: "auto", label: "Auto" },
  { value: "1080p", label: "1080p" },
  { value: "720p", label: "720p" },
  { value: "480p", label: "480p" },
];

const licenseStatusOptions = [
  { value: "", label: "Not set" },
  { value: "verified", label: "Verified" },
  { value: "pending", label: "Pending" },
  { value: "expired", label: "Expired" },
  { value: "not_required", label: "Not Required" },
];

const statusOptions = [
  { value: "scheduled", label: "Scheduled" },
  { value: "live", label: "Live" },
  { value: "halftime", label: "Halftime" },
  { value: "finished", label: "Finished" },
  { value: "postponed", label: "Postponed" },
  { value: "cancelled", label: "Cancelled" },
];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function toDateInputValue(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const hours = pad2(d.getHours());
  const minutes = pad2(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function firestoreDateToInputValue(
  dateLike: { seconds: number } | string | Date | undefined
): string {
  if (!dateLike) return "";
  if (typeof dateLike === "string") return toDateInputValue(dateLike);
  if (dateLike instanceof Date) return toDateInputValue(dateLike);
  if ("seconds" in dateLike) return toDateInputValue(new Date(dateLike.seconds * 1000));
  return "";
}

function getLabelForLanguageCode(code: string): string {
  const found = languageOptions.find((l) => l.code === code);
  return found?.label ?? code.toUpperCase();
}

function transformStreamsForForm(streams: unknown[]): MatchFormValues["streams"] {
  return streams.map((s: unknown) => {
    const stream = s as Record<string, unknown>;
    const languageCode = (stream.language as string) ?? (stream.languageCode as string) ?? "en";
    const label = (stream.label as string) ?? getLabelForLanguageCode(languageCode);
    return {
      language: languageCode,
      label,
      url: (stream.url as string) ?? "",
      isEnabled: Boolean(stream.isEnabled ?? stream.enabled ?? false),
      order: Number(stream.order ?? 0),
      quality: (stream.quality as MatchFormValues["streams"][0]["quality"]) ?? undefined,
    };
  });
}

function getOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  return undefined;
}

function computeInitialValues(
  initial?: Partial<MatchFormValues & Record<string, unknown>>
): MatchFormValues {
  const initialStreams = initial?.streams;
  const streams = Array.isArray(initialStreams) ? transformStreamsForForm(initialStreams) : [];

  const getNestedId = (obj: unknown): string | undefined => {
    const record = obj as Record<string, unknown> | undefined;
    return record?.id ? String(record.id) : undefined;
  };

  const getNestedStr = (obj: unknown, key: string): string | undefined => {
    const record = obj as Record<string, unknown> | undefined;
    const val = record?.[key];
    return val !== undefined && val !== null ? String(val) : undefined;
  };

  const compObj = initial?.competition as Record<string, unknown> | undefined;
  const homeObj = initial?.homeTeam as Record<string, unknown> | undefined;
  const awayObj = initial?.awayTeam as Record<string, unknown> | undefined;

  const competitionId = String(
    initial?.competitionId ?? getNestedId(compObj) ?? ""
  );
  const homeTeamId = String(
    initial?.homeTeamId ?? getNestedId(homeObj) ?? ""
  );
  const awayTeamId = String(
    initial?.awayTeamId ?? getNestedId(awayObj) ?? ""
  );
  const sport = String(
    initial?.sport ?? getNestedStr(compObj, "sport") ?? "Football"
  );

  return {
    competitionId,
    sport,
    homeTeamId,
    awayTeamId,
    stadium: String(initial?.stadium ?? initial?.stadiumName ?? ""),
    venueDisplayText: String(initial?.venueDisplayText ?? ""),
    startDate: firestoreDateToInputValue(initial?.startDate as never),
    timezone: String(initial?.timezone ?? "UTC"),
    status: (initial?.status as MatchFormValues["status"]) ?? "scheduled",
    homeScore: getOptionalNumber(initial?.homeScore) ?? getOptionalNumber(initial?.scoreHome),
    awayScore: getOptionalNumber(initial?.awayScore) ?? getOptionalNumber(initial?.scoreAway),
    currentMinute: getOptionalNumber(initial?.currentMinute) ?? getOptionalNumber(initial?.minute),
    period: String(initial?.period ?? ""),
    enableWatchMode: Boolean(initial?.enableWatchMode ?? false),
    streamUrl: String(initial?.streamUrl ?? ""),
    streamProvider: String(initial?.streamProvider ?? ""),
    streamQuality: (initial?.streamQuality as MatchFormValues["streamQuality"]) ?? "auto",
    licenseStatus: (initial?.licenseStatus as MatchFormValues["licenseStatus"]) ?? undefined,
    licenseExpiresAt: firestoreDateToInputValue(initial?.licenseExpiresAt as never),
    isPublished: Boolean(initial?.isPublished ?? true),
    isActive: Boolean(initial?.isActive ?? true),
    sourceType: (initial?.sourceType as MatchFormValues["sourceType"]) ?? "manual",
    externalApiMatchId: String(initial?.externalApiMatchId ?? ""),
    displayOrder: Number(initial?.displayOrder ?? 0),
    streams,
  };
}

interface MatchFormProps {
  initialData?: Partial<MatchFormValues & Record<string, unknown>>;
  matchId?: string;
}

const fieldMeta: Record<string, { label: string; placeholder?: string; helper?: string }> = {
  competitionId: { label: "Competition", placeholder: "Select competition" },
  sport: { label: "Sport", placeholder: "Select sport" },
  homeTeamId: { label: "Home Team", placeholder: "Select home team" },
  awayTeamId: { label: "Away Team", placeholder: "Select away team" },
  stadium: { label: "Stadium / Venue", placeholder: "Enter stadium or venue name" },
  startDate: { label: "Date & Time", placeholder: "" },
  status: { label: "Status", placeholder: "Select status" },
  homeScore: { label: "Home Score", placeholder: "0" },
  awayScore: { label: "Away Score", placeholder: "0" },
  currentMinute: { label: "Current Minute", placeholder: "0" },
  streamUrl: { label: "Stream URL", placeholder: "https://..." },
  streamQuality: { label: "Stream Quality" },
  licenseStatus: { label: "License Status" },
  licenseExpiresAt: { label: "License Expiration", placeholder: "" },
};

function selectField(
  value: string,
  onChange: (v: string) => void,
  options: { value: string; label: string }[],
  placeholder?: string
) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-border-default bg-bg-tertiary px-3 py-2.5 text-body text-text-primary focus:border-border-focus focus:outline-none"
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function MatchForm({ initialData, matchId }: MatchFormProps) {
  const router = useRouter();
  const { adminProfile } = useAuth();
  const isEdit = !!matchId;

  const [competitions, setCompetitions] = useState<CompetitionOption[]>([]);
  const [allTeams, setAllTeams] = useState<TeamOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const defaults = useMemo(() => computeInitialValues(initialData), [initialData]);

  const getNestedName = (obj: unknown): string | undefined => {
    const record = obj as Record<string, unknown> | undefined;
    const name = record?.name;
    return name !== undefined && name !== null && String(name).trim() !== "" ? String(name) : undefined;
  };

  const initialRec = initialData as Record<string, unknown> | undefined;
  const homeTeamFallback =
    (initialRec?.homeTeamName ? String(initialRec.homeTeamName) : undefined) ??
    getNestedName(initialRec?.homeTeam);

  const awayTeamFallback =
    (initialRec?.awayTeamName ? String(initialRec.awayTeamName) : undefined) ??
    getNestedName(initialRec?.awayTeam);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<MatchFormValues>({
    resolver: zodResolver(matchSchema),
    defaultValues: defaults,
  });

  const watchStatus = watch("status");
  const watchSport = watch("sport");
  const watchCompetitionId = watch("competitionId");
  const watchEnableWatchMode = watch("enableWatchMode");
  const watchStreamUrl = watch("streamUrl");

  const showScores = watchStatus !== "scheduled";
  const showMinute = watchStatus === "live" || watchStatus === "halftime";

  const selectedCompetition = useMemo(
    () => competitions.find((c) => c.id === watchCompetitionId) || null,
    [competitions, watchCompetitionId]
  );

  const watchHomeTeamId = watch("homeTeamId");
  const watchAwayTeamId = watch("awayTeamId");

  const filteredTeams = useMemo(() => {
    let teams = [...allTeams];

    if (watchSport) {
      teams = teams.filter((t) => !t.sport || t.sport === watchSport);
    }

      if (selectedCompetition) {
        if (selectedCompetition.teamType === "national") {
          teams = teams.filter((t) => t.isNational);
        } else if (selectedCompetition.teamType === "club") {
          teams = teams.filter((t) => !t.isNational && t.competitionIds?.includes(watchCompetitionId));
        }
      }

    const filteredIds = new Set(teams.map((t) => t.id));
    const selectedTeams = allTeams.filter(
      (t) => (watchHomeTeamId && t.id === watchHomeTeamId) || (watchAwayTeamId && t.id === watchAwayTeamId)
    );
    for (const st of selectedTeams) {
      if (!filteredIds.has(st.id)) {
        teams.push(st);
      }
    }

    return teams;
  }, [allTeams, watchSport, selectedCompetition, watchCompetitionId, watchHomeTeamId, watchAwayTeamId]);

  const filteredCompetitions = useMemo(
    () =>
      watchSport
        ? competitions.filter(
            (c) => !c.sport || c.sport === watchSport
          )
        : competitions,
    [competitions, watchSport]
  );

  const competitionComboboxOptions: ComboboxOption[] = useMemo(
    () =>
      filteredCompetitions.map((c) => ({
        id: c.id,
        name: c.name,
        subtitle: c.country || c.sport,
        badge: c.teamType,
        badgeVariant:
          c.teamType === "national"
            ? "blue"
            : c.teamType === "club"
            ? "green"
            : "default",
      })),
    [filteredCompetitions]
  );

  const teamComboboxOptions: ComboboxOption[] = useMemo(
    () =>
      filteredTeams.map((t) => ({
        id: t.id,
        name: t.name,
        subtitle: t.country || t.sport,
        badge: t.isNational ? "National" : "Club",
        badgeVariant: t.isNational ? "blue" : "green",
      })),
    [filteredTeams]
  );

  useEffect(() => {
    async function loadData() {
      try {
        const [compSnap, teamSnap] = await Promise.all([
          getDocs(firestoreQuery(collection(db, "competitions"), orderBy("name"))),
          getDocs(firestoreQuery(collection(db, "teams"), orderBy("name"))),
        ]);

        setCompetitions(
          compSnap.docs.map((d) => {
            const dt = d.data();
            const storedTeamType = (dt.teamType as "club" | "national" | "mixed") ?? undefined;
            const inferredTeamType = inferTeamTypeFromCompetitionName(String(dt.name ?? d.id));
            return {
              id: d.id,
              name: dt.name ?? d.id,
              country: dt.country,
              sport: dt.sport,
              teamType: storedTeamType ?? inferredTeamType,
            };
          })
        );

        setAllTeams(
          teamSnap.docs.map((d) => {
            const dt = d.data();
            return {
              id: d.id,
              name: dt.name ?? d.id,
              sport: dt.sport,
              competitionIds: (dt.competitionIds as string[]) ?? [],
              isNational: Boolean(dt.isNational),
              type: (dt.type as "club" | "national") ?? (dt.isNational ? "national" : "club"),
              country: dt.country ?? "",
            };
          })
        );
      } catch {
        // Competitions/teams may not exist yet — non-blocking.
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Reset home/away team when competition changes (but not on initial load)
  const initialCompetitionIdRef = useRef(defaults.competitionId);

  useEffect(() => {
    if (watchCompetitionId && watchCompetitionId !== initialCompetitionIdRef.current) {
      setValue("homeTeamId", "");
      setValue("awayTeamId", "");
    }
  }, [watchCompetitionId, setValue]);

  async function onSubmit(data: MatchFormValues) {
    if (!adminProfile) return;

    setSaving(true);
    setToast(null);

    try {
      const result = isEdit
        ? await updateMatchAction({
            matchId: matchId!,
            data,
            actorUid: adminProfile.uid,
            actorEmail: adminProfile.email,
            actorRole: adminProfile.role,
          })
        : await createMatchAction({
            data,
            actorUid: adminProfile.uid,
            actorEmail: adminProfile.email,
            actorRole: adminProfile.role,
          });

      if (result.success) {
        setToast({
          type: "success",
          message: isEdit
            ? "Match updated successfully."
            : "Match created successfully.",
        });
        setTimeout(() => router.push("/matches"), 800);
      } else {
        setToast({
          type: "error",
          message: result.error ?? "An error occurred. Please try again.",
        });
      }
    } catch {
      setToast({
        type: "error",
        message: "An unexpected error occurred.",
      });
    } finally {
      setSaving(false);
    }
  }

  const fieldError = (field: keyof MatchFormValues): string | undefined =>
    errors[field]?.message as string | undefined;

  return (
    <div className="flex flex-col gap-6">
      {/* Toast notification */}
      {toast && (
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg border px-4 py-3",
            toast.type === "success"
              ? "border-accent-green/30 bg-accent-green/10"
              : "border-accent-red/30 bg-accent-red/10"
          )}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-accent-green" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 text-accent-red" />
          )}
          <p className="text-body text-text-primary flex-1">{toast.message}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/matches")}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-h2 text-text-primary">
              {isEdit ? "Edit Match" : "Add Match"}
            </h1>
            <p className="text-body text-text-tertiary">
              {isEdit
                ? "Update match details and streaming configuration"
                : "Create a new match with team and streaming details"}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="flex flex-col gap-6">
          {/* Section 1: Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-label text-text-secondary">
                    Sport
                  </label>
                  {selectField(
                    watchSport,
                    (v) => setValue("sport", v, { shouldValidate: true }),
                    SPORTS.map((s) => ({ value: s, label: s })),
                    "Select sport"
                  )}
                  {fieldError("sport") && (
                    <p className="mt-1 text-caption text-accent-red">{fieldError("sport")}</p>
                  )}
                </div>

                  <div>
                    <Combobox
                      label={fieldMeta.competitionId.label}
                      placeholder="Type to search competition..."
                      options={competitionComboboxOptions}
                      value={watch("competitionId")}
                      onChange={(v) => setValue("competitionId", v, { shouldValidate: true })}
                      error={fieldError("competitionId")}
                      helperText={selectedCompetition ? (selectedCompetition.teamType === "national"
                        ? "National competition — only national teams will be shown below."
                        : selectedCompetition.teamType === "club"
                        ? "Club competition — only club teams will be shown below."
                        : "") : undefined}
                    />
                  </div>

                 <Combobox
                    label={fieldMeta.homeTeamId.label}
                    placeholder="Type to search home team..."
                    options={teamComboboxOptions}
                    value={watch("homeTeamId")}
                    onChange={(v) => setValue("homeTeamId", v, { shouldValidate: true })}
                    error={fieldError("homeTeamId")}
                    fallbackName={homeTeamFallback}
                    allowCustom
                     emptyMessage={
                       selectedCompetition
                         ? selectedCompetition.teamType === "national"
                           ? `No national teams found. Go to Config → Sync Management → Sync National Teams to sync national teams (France, Brazil, etc.).`
                           : selectedCompetition.teamType === "club"
                             ? `No teams synced for "${selectedCompetition.name}". Go to Config → Sync Management → Sync Club Teams to sync teams for this league.`
                             : `No teams found. Go to Teams page to create teams first.`
                         : "No teams found. Go to Teams page to create teams first."
                     }
                     helperText={
                       selectedCompetition
                         ? selectedCompetition.teamType === "national"
                           ? "Showing all national teams (they play in multiple competitions)."
                           : selectedCompetition.teamType === "club"
                             ? `Showing only teams from "${selectedCompetition.name}". Not seeing your team? Sync Club Teams first.`
                             : "Showing all teams."
                         : "Select a competition first to filter teams."
                     }
                  />

                  <Combobox
                    label={fieldMeta.awayTeamId.label}
                    placeholder="Type to search away team..."
                    options={teamComboboxOptions}
                    value={watch("awayTeamId")}
                    onChange={(v) => setValue("awayTeamId", v, { shouldValidate: true })}
                    error={fieldError("awayTeamId")}
                    fallbackName={awayTeamFallback}
                    allowCustom
                     emptyMessage={
                       selectedCompetition
                         ? selectedCompetition.teamType === "national"
                           ? `No national teams found. Go to Config → Sync Management → Sync National Teams to sync national teams (France, Brazil, etc.).`
                           : selectedCompetition.teamType === "club"
                             ? `No teams synced for "${selectedCompetition.name}". Go to Config → Sync Management → Sync Club Teams to sync teams for this league.`
                             : `No teams found. Go to Teams page to create teams first.`
                         : "No teams found. Go to Teams page to create teams first."
                     }
                     helperText={
                       selectedCompetition
                         ? selectedCompetition.teamType === "national"
                           ? "Showing all national teams (they play in multiple competitions)."
                           : selectedCompetition.teamType === "club"
                             ? `Showing only teams from "${selectedCompetition.name}". Not seeing your team? Sync Club Teams first.`
                             : "Showing all teams."
                         : "Select a competition first to filter teams."
                     }
                  />

                <div>
                  <Controller
                    name="stadium"
                    control={control}
                    render={({ field }) => (
                      <Input
                        label={fieldMeta.stadium.label}
                        placeholder={fieldMeta.stadium.placeholder}
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        error={fieldError("stadium")}
                      />
                    )}
                  />
                </div>

                <div>
                  <Controller
                    name="startDate"
                    control={control}
                    render={({ field }) => (
                      <Input
                        label={fieldMeta.startDate.label}
                        type="datetime-local"
                        value={field.value}
                        onChange={field.onChange}
                        error={fieldError("startDate")}
                      />
                    )}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-label text-text-secondary">
                    Status
                  </label>
                  <select
                    value={watchStatus}
                    onChange={(e) =>
                      setValue("status", e.target.value as MatchFormValues["status"], {
                        shouldValidate: true,
                      })
                    }
                    className="w-full rounded-lg border border-border-default bg-bg-tertiary px-3 py-2.5 text-body text-text-primary focus:border-border-focus focus:outline-none"
                  >
                    {statusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {fieldError("status") && (
                    <p className="mt-1 text-caption text-accent-red">
                      {fieldError("status")}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Score Info */}
          {showScores && (
            <Card>
              <CardHeader>
                <CardTitle>Score Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Controller
                    name="homeScore"
                    control={control}
                    render={({ field }) => (
                      <Input
                        label={fieldMeta.homeScore.label}
                        type="number"
                        min={0}
                        placeholder={fieldMeta.homeScore.placeholder}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ""
                              ? undefined
                              : parseInt(e.target.value, 10)
                          )
                        }
                        error={fieldError("homeScore")}
                      />
                    )}
                  />

                  <Controller
                    name="awayScore"
                    control={control}
                    render={({ field }) => (
                      <Input
                        label={fieldMeta.awayScore.label}
                        type="number"
                        min={0}
                        placeholder={fieldMeta.awayScore.placeholder}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ""
                              ? undefined
                              : parseInt(e.target.value, 10)
                          )
                        }
                        error={fieldError("awayScore")}
                      />
                    )}
                  />

                  {showMinute && (
                    <Controller
                      name="currentMinute"
                      control={control}
                      render={({ field }) => (
                        <Input
                          label={fieldMeta.currentMinute.label}
                          type="number"
                          min={0}
                          placeholder={fieldMeta.currentMinute.placeholder}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === ""
                                ? undefined
                                : parseInt(e.target.value, 10)
                            )
                          }
                          error={fieldError("currentMinute")}
                        />
                      )}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Section 3: Streaming Config */}
          <Card>
            <CardHeader>
              <CardTitle>Streaming Configuration</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <Controller
                name="enableWatchMode"
                control={control}
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    label="Enable Watch Mode"
                    description="Allows users to watch this match live through the app."
                  />
                )}
              />

              {watchEnableWatchMode && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Controller
                    name="streamUrl"
                    control={control}
                    render={({ field }) => (
                      <Input
                        label={fieldMeta.streamUrl.label}
                        type="url"
                        placeholder={fieldMeta.streamUrl.placeholder}
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        error={fieldError("streamUrl")}
                      />
                    )}
                  />

                  <div>
                    <label className="mb-1.5 block text-label text-text-secondary">
                      {fieldMeta.streamQuality.label}
                    </label>
                    {selectField(
                      watch("streamQuality"),
                      (v) =>
                        setValue(
                          "streamQuality",
                          v as MatchFormValues["streamQuality"],
                          { shouldValidate: true }
                        ),
                      watchQualityOptions
                    )}
                  </div>
                </div>
              )}

              {watchStreamUrl && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-label text-text-secondary">
                      {fieldMeta.licenseStatus.label}
                    </label>
                    {selectField(
                      watch("licenseStatus") ?? "",
                      (v) =>
                        setValue(
                          "licenseStatus",
                          (v || undefined) as MatchFormValues["licenseStatus"],
                          { shouldValidate: true }
                        ),
                      licenseStatusOptions
                    )}
                    {fieldError("licenseStatus") && (
                      <p className="mt-1 text-caption text-accent-red">
                        {fieldError("licenseStatus")}
                      </p>
                    )}
                  </div>

                  <Controller
                    name="licenseExpiresAt"
                    control={control}
                    render={({ field }) => (
                      <Input
                        label={fieldMeta.licenseExpiresAt.label}
                        type="date"
                        value={field.value ?? ""}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 4: Stream Links */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Stream Links</CardTitle>
                  <p className="mt-1 text-body-sm text-text-tertiary">
                    Multi-language stream URLs for the iOS player
                  </p>
                </div>
                 <Button
                   type="button"
                   variant="outline"
                   size="sm"
                    onClick={() => {
                      const current = watch("streams") ?? [];
                      setValue("streams", [
                        ...current,
                        { language: "en", label: `S${current.length + 1}`, url: "", isEnabled: true, order: current.length },
                      ], { shouldValidate: false });
                    }}
                 >
                   <Plus className="h-4 w-4" /> Add Stream
                 </Button>
              </div>
            </CardHeader>
            <CardContent>
              {(!watch("streams") || watch("streams").length === 0) && (
                <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-muted p-8">
                  <Video className="h-8 w-8 text-text-disabled" />
                  <p className="text-body-sm text-text-tertiary">No stream links added yet. Add a stream to enable watch mode per language.</p>
                </div>
              )}

              {watch("streams")?.map((stream, idx) => (
                <div key={idx} className="mb-4 rounded-lg border border-border-muted bg-bg-primary p-4">
                  <div className="mb-3 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        const current = watch("streams");
                        setValue("streams", current.filter((_, i) => i !== idx), { shouldValidate: false });
                      }}
                      className="rounded-md p-1 text-text-tertiary hover:bg-bg-tertiary hover:text-accent-red"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                     <div>
                       <label className="mb-1 block text-caption text-text-tertiary">Name</label>
                       <input
                         placeholder="S1"
                         value={stream.label}
                         onChange={(e) => {
                           const current = [...(watch("streams") ?? [])];
                           current[idx] = { ...current[idx], label: e.target.value };
                           setValue("streams", current, { shouldValidate: false });
                         }}
                         className="w-full rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-body text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none"
                       />
                     </div>
                    <div>
                      <label className="mb-1 block text-caption text-text-tertiary">Stream URL</label>
                      <input
                        type="url"
                        placeholder="https://..."
                        value={stream.url}
                        onChange={(e) => {
                          const current = [...(watch("streams") ?? [])];
                          current[idx] = { ...current[idx], url: e.target.value };
                          setValue("streams", current, { shouldValidate: false });
                        }}
                        className="w-full rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-body text-text-primary placeholder:text-text-disabled focus:border-border-focus focus:outline-none"
                      />
                    </div>
                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <label className="mb-1 block text-caption text-text-tertiary">Order</label>
                        <input
                          type="number"
                          min={0}
                          value={stream.order}
                          onChange={(e) => {
                            const current = [...(watch("streams") ?? [])];
                            current[idx] = { ...current[idx], order: parseInt(e.target.value) || 0 };
                            setValue("streams", current, { shouldValidate: false });
                          }}
                          className="w-full rounded-lg border border-border-default bg-bg-tertiary px-3 py-2 text-body text-text-primary focus:border-border-focus focus:outline-none"
                        />
                      </div>
                       <div className="flex items-center gap-2 pb-2">
                         <input
                           type="checkbox"
                           checked={stream.isEnabled}
                           onChange={(e) => {
                             const current = [...(watch("streams") ?? [])];
                             current[idx] = { ...current[idx], isEnabled: e.target.checked };
                             setValue("streams", current, { shouldValidate: false });
                           }}
                           className="h-4 w-4 rounded border-border-default bg-bg-tertiary text-accent-green focus:ring-border-focus"
                           id={`stream-en-${idx}`}
                         />
                         <label htmlFor={`stream-en-${idx}`} className="text-body-sm text-text-secondary">Enabled</label>
                       </div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

           {/* Section 5: Publishing */}
           <Card>
             <CardHeader>
               <CardTitle>Publishing</CardTitle>
             </CardHeader>
             <CardContent className="space-y-6">
               <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                 <div>
                   <label className="mb-1.5 block text-label text-text-secondary">
                     Source Type
                   </label>
                   <select
                     value={watch("sourceType")}
                     onChange={(e) =>
                       setValue("sourceType", e.target.value as MatchFormValues["sourceType"], {
                         shouldValidate: true,
                       })
                     }
                     className="w-full rounded-lg border border-border-default bg-bg-tertiary px-3 py-2.5 text-body text-text-primary focus:border-border-focus focus:outline-none"
                   >
                     <option value="manual">Manual</option>
                     <option value="api">API Synced</option>
                     <option value="hybrid">Hybrid</option>
                   </select>
                   <p className="mt-1 text-caption text-text-tertiary">
                     Manual matches appear before API matches when displayOrder is the same.
                   </p>
                 </div>

                 <Controller
                   name="displayOrder"
                   control={control}
                   render={({ field }) => (
                      <Input
                        label="Display Order"
                        type="number"
                        min={0}
                        placeholder="0"
                        value={field.value}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? 0 : parseInt(e.target.value, 10))
                        }
                        error={fieldError("displayOrder")}
                      />
                   )}
                 />
               </div>

               <Controller
                 name="isPublished"
                 control={control}
                 render={({ field }) => (
                   <Switch
                     checked={field.value}
                     onCheckedChange={field.onChange}
                     label="Published"
                     description="Publish this match so it appears in the iOS app."
                   />
                 )}
               />
             </CardContent>
           </Card>

          {/* Submit */}
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={saving}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              <Save className="h-4 w-4" />
              {isEdit ? "Update Match" : "Create Match"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/matches")}
            >
              Cancel
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
