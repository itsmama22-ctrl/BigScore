"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { MatchForm } from "@/components/forms/MatchForm";
import { Card, CardContent } from "@/components/ui/card";

export default function EditMatchPage() {
  const params = useParams();
  const matchId = params.id as string;

  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMatch() {
      try {
        const snap = await getDoc(doc(db, "matches", matchId));
        if (snap.exists()) {
          setData({ id: snap.id, ...snap.data() } as Record<string, unknown>);
        } else {
          setError("Match not found.");
        }
      } catch {
        setError("Failed to load match data.");
      } finally {
        setLoading(false);
      }
    }
    fetchMatch();
  }, [matchId]);

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

  if (error || !data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16">
          <p className="text-body text-accent-red">{error ?? "Match not found."}</p>
        </CardContent>
      </Card>
    );
  }

  return <MatchForm initialData={data} matchId={matchId} />;
}
