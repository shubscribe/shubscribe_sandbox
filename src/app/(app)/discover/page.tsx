import { db, discovered, searches, watchlist } from "@/db";
import { desc, eq, asc } from "drizzle-orm";
import { getSettings } from "@/lib/settings";
import { DiscoverView } from "@/components/discover/DiscoverView";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const [inbox, allSearches, watched, settings] = await Promise.all([
    db.select().from(discovered).where(eq(discovered.status, "new")).orderBy(desc(discovered.fitScore), desc(discovered.createdAt)),
    db.select().from(searches).orderBy(asc(searches.createdAt)),
    db.select().from(watchlist).orderBy(asc(watchlist.company)),
    getSettings(),
  ]);

  return (
    <DiscoverView
      inbox={inbox}
      searches={allSearches}
      watched={watched}
      keys={{
        adzuna: !!(settings.adzunaAppId && settings.adzunaAppKey),
        jsearch: !!settings.jsearchKey,
        ai: !!(settings.aiProvider && settings.aiApiKey),
      }}
      lastScanAt={settings.lastScanAt || null}
    />
  );
}
