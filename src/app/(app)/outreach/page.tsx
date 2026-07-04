import { db, campaigns, leads, outreachMessages, contacts, applications, resumes } from "@/db";
import { desc } from "drizzle-orm";
import { getSettings } from "@/lib/settings";
import { OutreachView } from "@/components/outreach/OutreachView";

export const dynamic = "force-dynamic";

export default async function OutreachPage() {
  const [allCampaigns, allLeads, allMsgs, allContacts, allApps, allResumes, settings] =
    await Promise.all([
      db.select().from(campaigns).orderBy(desc(campaigns.createdAt)),
      db.select().from(leads),
      db.select().from(outreachMessages).orderBy(desc(outreachMessages.createdAt)),
      db.select().from(contacts),
      db.select().from(applications),
      db.select().from(resumes),
      getSettings(),
    ]);

  const contactMap = new Map(allContacts.map((c) => [c.id, c]));
  const appMap = new Map(allApps.map((a) => [a.id, a]));
  const leadMap = new Map(allLeads.map((l) => [l.id, l]));
  const campaignMap = new Map(allCampaigns.map((c) => [c.id, c]));

  const enrich = (m: typeof allMsgs[number]) => {
    const lead = leadMap.get(m.leadId);
    const campaign = lead ? campaignMap.get(lead.campaignId) : undefined;
    const contact = lead ? contactMap.get(lead.contactId) : undefined;
    const app = campaign ? appMap.get(campaign.applicationId) : undefined;
    return {
      id: m.id, stepPosition: m.stepPosition, type: m.type,
      subject: m.subject, body: m.body, status: m.status,
      sentAt: m.sentAt?.getTime() ?? null,
      gmailThreadId: m.gmailThreadId,
      persona: lead?.persona ?? "?",
      leadStatus: lead?.status ?? "?",
      campaignId: campaign?.id ?? null,
      contact: contact ? { name: contact.name, title: contact.title, email: contact.email } : null,
      company: app?.company ?? "?",
      appId: app?.id ?? null,
      appTitle: app?.title ?? "?",
    };
  };

  const queue = allMsgs.filter((m) => m.status === "drafted").map(enrich);
  const approvedCount = allMsgs.filter((m) => m.status === "approved").length;
  const history = allMsgs.filter((m) => m.status === "sent").map(enrich);

  const board = allCampaigns.map((c) => {
    const app = appMap.get(c.applicationId);
    const cLeads = allLeads.filter((l) => l.campaignId === c.id).map((l) => {
      const msgs = allMsgs.filter((m) => m.leadId === l.id);
      return {
        id: l.id, persona: l.persona, status: l.status,
        contact: contactMap.get(l.contactId)?.name ?? "?",
        sent: msgs.filter((m) => m.status === "sent").length,
        pending: msgs.filter((m) => ["drafted", "approved", "scheduled"].includes(m.status)).length,
      };
    });
    return {
      id: c.id, status: c.status, resumeId: c.resumeId,
      company: app?.company ?? "?", title: app?.title ?? "?", appId: app?.id ?? null,
      leads: cLeads,
      replied: cLeads.filter((l) => l.status === "replied").length,
    };
  });

  const sentAll = allMsgs.filter((m) => m.status === "sent" && m.type === "email");
  const personas = ["recruiter", "manager", "peer"] as const;
  const analytics = {
    sent: sentAll.length,
    dmTasks: allMsgs.filter((m) => m.status === "sent" && m.type === "dm_task").length,
    replied: allLeads.filter((l) => l.status === "replied").length,
    replyRate: allLeads.length
      ? Math.round((allLeads.filter((l) => l.status === "replied").length /
          Math.max(1, allLeads.filter((l) => l.status !== "active" || allMsgs.some((m) => m.leadId === l.id && m.status === "sent")).length)) * 100)
      : 0,
    byPersona: personas.map((p) => {
      const pl = allLeads.filter((l) => l.persona === p);
      const contacted = pl.filter((l) => allMsgs.some((m) => m.leadId === l.id && m.status === "sent"));
      return {
        persona: p,
        contacted: contacted.length,
        replied: pl.filter((l) => l.status === "replied").length,
      };
    }),
  };

  return (
    <OutreachView
      queue={queue}
      approvedCount={approvedCount}
      board={board}
      history={history}
      analytics={analytics}
      resumes={allResumes.map((r) => ({ id: r.id, name: r.name, isDefault: r.isDefault }))}
      settings={{
        paused: settings.outreachPaused,
        cap: settings.dailySendCap,
        windowStart: settings.sendWindowStart,
        windowEnd: settings.sendWindowEnd,
        gmailConnected: settings.gmailConnected,
      }}
    />
  );
}
