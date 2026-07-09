"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { applySuggestion, dismissSuggestion } from "@/actions/discovery";

const KIND_LABEL = {
  interview: "🎙 Interview email",
  rejection: "✕ Rejection",
  reply: "✉ Reply",
  offer: "🎉 Offer",
  applied: "🆕 New application",
} as const;

export type SuggestionItem = {
  id: string;
  kind: string;
  subject: string | null;
  fromAddr: string | null;
  snippet: string | null;
  app: { id: string; company: string } | null;
  proposedStageName: string | null;
  proposedTask: string | null;
  proposedCompany: string | null;
  proposedTitle: string | null;
};

export function SuggestionList({ items }: { items: SuggestionItem[] }) {
  const router = useRouter();
  if (items.length === 0) return null;

  return (
    <section className="glass mb-5 p-4">
      <h2 className="mb-3 text-sm font-semibold">
        📬 From your inbox
        <span className="ml-2 text-xs font-normal text-ink-faint">one click to apply, nothing happens without you</span>
      </h2>
      <div className="space-y-2">
        {items.map((s) => (
          <div key={s.id} className="glass flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm">
                <span className="font-medium">{KIND_LABEL[s.kind as keyof typeof KIND_LABEL] ?? s.kind}</span>
                {s.app ? (
                  <>
                    {" from "}
                    <Link href={`/applications/${s.app.id}`} className="text-accent hover:underline">
                      {s.app.company}
                    </Link>
                  </>
                ) : s.proposedCompany ? (
                  <span className="text-ink-dim">
                    {" — "}{s.proposedCompany}
                    {s.proposedTitle ? <span className="text-ink-faint"> · {s.proposedTitle}</span> : null}
                  </span>
                ) : null}
              </div>
              <div className="truncate text-xs text-ink-faint">
                “{s.subject ?? ""}” · {s.snippet?.slice(0, 90)}
              </div>
              <div className="mt-0.5 text-[11px] text-ink-dim">
                Will:{" "}
                {(s.kind === "applied"
                  ? [`add ${s.proposedCompany ?? "this company"} to your pipeline`, "log activity"]
                  : [
                      s.proposedStageName && `move to ${s.proposedStageName}`,
                      "log activity",
                      s.proposedTask && `add task “${s.proposedTask}”`,
                    ]
                ).filter(Boolean).join(" · ")}
              </div>
            </div>
            <button
              className="shrink-0 rounded-xl bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
              onClick={async () => {
                await applySuggestion(s.id);
                router.refresh();
                toast.success("Applied ✓");
              }}
            >
              ✓ Apply
            </button>
            <button
              className="glass-pill shrink-0 px-2.5 py-1.5 text-xs text-ink-faint hover:text-bad"
              onClick={async () => {
                await dismissSuggestion(s.id);
                router.refresh();
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
