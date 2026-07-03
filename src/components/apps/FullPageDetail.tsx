"use client";

import { useRouter } from "next/navigation";
import { AppDetail } from "./AppDetail";
import type { AppFull, Stage, Source, Tag } from "@/lib/data";

export function FullPageDetail({
  app,
  stages,
  sources,
  tags,
}: {
  app: AppFull;
  stages: Stage[];
  sources: Source[];
  tags: Tag[];
}) {
  const router = useRouter();
  return (
    <AppDetail
      app={app}
      stages={stages}
      sources={sources}
      tags={tags}
      onChanged={() => router.refresh()}
      onClosed={() => router.push("/applications")}
    />
  );
}
