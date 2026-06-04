"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { queryWithFallback } from "@/lib/queryWithFallback";
import { db } from "@/lib/firebase/client";
import { NewsForm } from "@/components/forms/NewsForm";
import { Card, CardContent } from "@/components/ui/card";

export default function EditNewsPage() {
  const params = useParams();
  const articleId = params.id as string;
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await queryWithFallback({ collection: "news", docId: articleId });
        if (data.length > 0) {
          setData(data[0] as Record<string, unknown>);
        } else {
          setError("Article not found.");
        }
      } catch {
        setError("Failed to load article.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [articleId]);

  if (loading)
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16">
          <div className="h-8 w-64 animate-pulse rounded bg-bg-tertiary" />
        </CardContent>
      </Card>
    );

  if (error || !data)
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16">
          <p className="text-body text-accent-red">{error ?? "Article not found."}</p>
        </CardContent>
      </Card>
    );

  return <NewsForm initialData={data} articleId={articleId} />;
}
