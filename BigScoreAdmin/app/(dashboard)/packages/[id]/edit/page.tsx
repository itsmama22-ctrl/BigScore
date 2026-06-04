"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { PackageForm } from "@/components/forms/PackageForm";
import { Card, CardContent } from "@/components/ui/card";
import { queryWithFallback } from "@/lib/queryWithFallback";
import type { ChannelFormValues } from "@/lib/validation/packageSchema";

interface ChannelDoc extends ChannelFormValues {
  id: string;
  streamUrls: string[];
}

export default function EditPackagePage() {
  const params = useParams();
  const packageId = params.id as string;

  const [pkgData, setPkgData] = useState<Record<string, unknown> | null>(null);
  const [channels, setChannels] = useState<ChannelDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const pkgResult = await Promise.race([
          (async () => {
            const pkgSnap = await getDoc(doc(db, "packages", packageId));
            if (!pkgSnap.exists()) return null;
            return { id: pkgSnap.id, ...pkgSnap.data() } as Record<string, unknown>;
          })(),
          new Promise<"__timeout__">((resolve) =>
            setTimeout(() => resolve("__timeout__"), 4000)
          ),
        ]);

        if (pkgResult === "__timeout__") {
          const fallback = await queryWithFallback({ collection: "packages", docId: packageId });
          if (fallback.length === 0) {
            setError("Package not found.");
            setLoading(false);
            return;
          }
          setPkgData(fallback[0] as Record<string, unknown>);
        } else if (pkgResult === null) {
          setError("Package not found.");
          setLoading(false);
          return;
        } else {
          setPkgData(pkgResult);
        }

        const channelResult = await Promise.race([
          (async () => {
            const channelsSnap = await getDocs(
              query(
                collection(db, "packages", packageId, "channels"),
                orderBy("displayOrder", "asc")
              )
            );
            const channelList: ChannelDoc[] = [];
            channelsSnap.forEach((chDoc) => {
              const d = chDoc.data();
              const rawStreamUrls = d.streamUrls;
              const streamUrls = Array.isArray(rawStreamUrls)
                ? rawStreamUrls.filter((u: unknown) => typeof u === "string" && u.trim())
                : [];
              channelList.push({
                id: chDoc.id,
                name: d.name ?? "",
                logoUrl: d.logoUrl ?? "",
                streamUrl: streamUrls[0] ?? d.streamUrl ?? "",
                streamUrls,
                streamProvider: d.streamProvider ?? "",
                quality: d.quality ?? "auto",
                isActive: d.isActive ?? true,
                displayOrder: d.displayOrder ?? 0,
                licenseStatus: d.licenseStatus ?? "verified",
                licenseExpiresAt: d.licenseExpiresAt?.toDate
                  ? new Date(d.licenseExpiresAt.toDate()).toISOString().slice(0, 10)
                  : d.licenseExpiresAt ?? "",
              });
            });
            return channelList;
          })(),
          new Promise<"__timeout__">((resolve) =>
            setTimeout(() => resolve("__timeout__"), 4000)
          ),
        ]);

        if (channelResult === "__timeout__") {
          const fallbackChannels = await queryWithFallback<ChannelDoc>({
            collection: "packages",
            parentId: packageId,
            subcollection: "channels",
            orderByField: "displayOrder",
            orderByDir: "asc",
          });
          setChannels(fallbackChannels);
        } else {
          setChannels(channelResult);
        }
      } catch (err) {
        console.error("[EditPackagePage] Failed to load:", err);
        setError("Failed to load package data. " + (err instanceof Error ? err.message : ""));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [packageId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16">
          <div className="h-8 w-64 animate-pulse rounded bg-bg-tertiary" />
          <div className="h-4 w-48 animate-pulse rounded bg-bg-tertiary" />
        </CardContent>
      </Card>
    );
  }

  if (error || !pkgData) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16">
          <p className="text-body text-accent-red">{error ?? "Package not found."}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <PackageForm
      initialData={pkgData as never}
      initialChannels={channels}
      packageId={packageId}
    />
  );
}
