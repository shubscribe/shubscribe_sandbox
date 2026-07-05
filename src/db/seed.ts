/* Demo data seeder — run with `npm run seed`.
   Everything it creates is flagged (applications.demo / contacts.origin="demo")
   and removable via Settings → Danger zone → "Clear demo data". */
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import * as schema from "./schema";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const db = drizzle(client, { schema });

const DAY = 86400000;
const now = Date.now();

const DEFAULT_STAGES = [
  { name: "Saved", color: "#9aa5c9", isTerminal: false },
  { name: "Applied", color: "#8b8bf5", isTerminal: false },
  { name: "Screening", color: "#5aa9e6", isTerminal: false },
  { name: "Interviewing", color: "#e09b3d", isTerminal: false },
  { name: "Offer", color: "#2fbfa4", isTerminal: false },
  { name: "Rejected", color: "#ef6292", isTerminal: true },
  { name: "Withdrawn", color: "#7d87b0", isTerminal: true },
];

const DEFAULT_SOURCES = [
  ["LinkedIn", "#0a66c2"],
  ["Indeed", "#2557a7"],
  ["ZipRecruiter", "#1d924a"],
  ["Dice", "#eb1c26"],
  ["Company site", "#8b8bf5"],
  ["Referral", "#e09b3d"],
  ["Cold outreach", "#ef6292"],
] as const;

// stagePath: the journey through stage names; appliedDaysAgo drives timing
const DEMO_APPS = [
  { company: "Vercel", title: "Senior Frontend Engineer", url: "https://vercel.com/careers", location: "Remote", workMode: "remote", jobType: "full-time", salaryMin: 160000, salaryMax: 210000, source: "LinkedIn", excitement: 5, appliedDaysAgo: 21, path: ["Applied", "Screening", "Interviewing"] },
  { company: "Stripe", title: "Full Stack Engineer, Dashboard", url: "https://stripe.com/jobs", location: "San Francisco, CA", workMode: "hybrid", jobType: "full-time", salaryMin: 170000, salaryMax: 230000, source: "Referral", referrer: "Priya S.", excitement: 5, appliedDaysAgo: 18, path: ["Applied", "Screening", "Interviewing", "Offer"] },
  { company: "Linear", title: "Product Engineer", url: "https://linear.app/careers", location: "Remote", workMode: "remote", jobType: "full-time", salaryMin: 150000, salaryMax: 190000, source: "Company site", excitement: 4, appliedDaysAgo: 14, path: ["Applied", "Screening"] },
  { company: "Notion", title: "Software Engineer, Growth", url: "https://notion.so/careers", location: "New York, NY", workMode: "hybrid", jobType: "full-time", salaryMin: 155000, salaryMax: 200000, source: "LinkedIn", excitement: 3, appliedDaysAgo: 25, path: ["Applied", "Rejected"] },
  { company: "Figma", title: "Frontend Engineer, Editor", url: "https://figma.com/careers", location: "San Francisco, CA", workMode: "hybrid", jobType: "full-time", salaryMin: 165000, salaryMax: 215000, source: "Indeed", excitement: 4, appliedDaysAgo: 12, path: ["Applied", "Screening", "Interviewing"] },
  { company: "Anthropic", title: "Member of Technical Staff", url: "https://anthropic.com/careers", location: "San Francisco, CA", workMode: "hybrid", jobType: "full-time", salaryMin: 250000, salaryMax: 350000, source: "Company site", excitement: 5, appliedDaysAgo: 10, path: ["Applied", "Screening"] },
  { company: "Datadog", title: "Software Engineer II", url: "https://datadoghq.com/careers", location: "New York, NY", workMode: "onsite", jobType: "full-time", salaryMin: 140000, salaryMax: 180000, source: "ZipRecruiter", excitement: 3, appliedDaysAgo: 16, path: ["Applied"] },
  { company: "Cloudflare", title: "Systems Engineer", url: "https://cloudflare.com/careers", location: "Austin, TX", workMode: "hybrid", jobType: "full-time", salaryMin: 145000, salaryMax: 185000, source: "Dice", excitement: 3, appliedDaysAgo: 9, path: ["Applied", "Screening"] },
  { company: "Ramp", title: "Full Stack Engineer", url: "https://ramp.com/careers", location: "New York, NY", workMode: "onsite", jobType: "full-time", salaryMin: 160000, salaryMax: 200000, source: "Referral", referrer: "Dev K.", excitement: 4, appliedDaysAgo: 8, path: ["Applied"] },
  { company: "Supabase", title: "Backend Engineer (Postgres)", url: "https://supabase.com/careers", location: "Remote", workMode: "remote", jobType: "full-time", salaryMin: 130000, salaryMax: 170000, source: "LinkedIn", excitement: 4, appliedDaysAgo: 6, path: ["Applied"] },
  { company: "Shopify", title: "Senior Developer, Checkout", url: "https://shopify.com/careers", location: "Remote", workMode: "remote", jobType: "full-time", salaryMin: 150000, salaryMax: 195000, source: "Indeed", excitement: 2, appliedDaysAgo: 20, path: ["Applied", "Withdrawn"] },
  { company: "Airbnb", title: "Frontend Engineer", url: "https://careers.airbnb.com", location: "San Francisco, CA", workMode: "hybrid", jobType: "full-time", salaryMin: 170000, salaryMax: 220000, source: "LinkedIn", excitement: 4, appliedDaysAgo: 4, path: ["Applied"] },
  { company: "Retool", title: "Product Engineer", url: "https://retool.com/careers", location: "San Francisco, CA", workMode: "hybrid", jobType: "full-time", salaryMin: 155000, salaryMax: 205000, source: "Cold outreach", excitement: 3, appliedDaysAgo: 3, path: ["Applied"] },
  { company: "Plaid", title: "Software Engineer, Integrations", url: "https://plaid.com/careers", location: "Remote", workMode: "remote", jobType: "full-time", salaryMin: 150000, salaryMax: 190000, source: "ZipRecruiter", excitement: 3, appliedDaysAgo: 2, path: ["Applied"] },
  { company: "OpenSea", title: "Senior Full Stack Engineer", url: "https://opensea.io/careers", location: "Remote", workMode: "remote", jobType: "contract", salaryMin: 140000, salaryMax: 175000, source: "Dice", excitement: 2, appliedDaysAgo: 28, path: ["Applied", "Rejected"] },
  { company: "Mercury", title: "Frontend Engineer", url: "https://mercury.com/careers", location: "Remote", workMode: "remote", jobType: "full-time", salaryMin: 145000, salaryMax: 185000, source: "Company site", excitement: 4, appliedDaysAgo: 0, path: [] }, // saved, not yet applied
];

async function main() {
  /* stages */
  let stages = await db.select().from(schema.stages);
  if (stages.length === 0) {
    await db.insert(schema.stages).values(DEFAULT_STAGES.map((s, i) => ({ ...s, position: i })));
    stages = await db.select().from(schema.stages);
    console.log("• created default stages");
  }
  const stageByName = new Map(stages.map((s) => [s.name, s]));

  /* sources */
  let sources = await db.select().from(schema.sources);
  if (sources.length === 0) {
    await db.insert(schema.sources).values(DEFAULT_SOURCES.map(([name, color]) => ({ name, color })));
    sources = await db.select().from(schema.sources);
    console.log("• created default sources");
  }
  const sourceByName = new Map(sources.map((s) => [s.name, s]));

  /* demo contacts */
  const demoContacts = [
    { name: "Priya Sharma", title: "Technical Recruiter", company: "Stripe", email: "priya@example.com", linkedinUrl: "https://linkedin.com/in/example", origin: "demo" },
    { name: "Marcus Lee", title: "Engineering Manager", company: "Vercel", email: "marcus@example.com", origin: "demo" },
    { name: "Ana Rodrigues", title: "Head of Talent", company: "Figma", linkedinUrl: "https://linkedin.com/in/example2", origin: "demo" },
  ];
  const insertedContacts = await db.insert(schema.contacts).values(demoContacts).returning();

  /* applications + journeys */
  let count = 0;
  for (const d of DEMO_APPS) {
    const appliedAt = d.path.length ? new Date(now - d.appliedDaysAgo * DAY) : null;
    const savedStage = stageByName.get("Saved");
    const finalStageName = d.path.length ? d.path[d.path.length - 1] : "Saved";
    const finalStage = stageByName.get(finalStageName) ?? savedStage;

    const [app] = await db
      .insert(schema.applications)
      .values({
        company: d.company,
        title: d.title,
        url: d.url,
        location: d.location,
        workMode: d.workMode,
        jobType: d.jobType,
        salaryMin: d.salaryMin,
        salaryMax: d.salaryMax,
        currency: "USD",
        sourceId: sourceByName.get(d.source)?.id ?? null,
        referrer: "referrer" in d ? (d as { referrer?: string }).referrer ?? null : null,
        excitement: d.excitement,
        stageId: finalStage?.id ?? null,
        appliedAt,
        demo: true,
        createdAt: new Date(now - (d.appliedDaysAgo + 1) * DAY),
        lastActivityAt: new Date(now - Math.min(d.appliedDaysAgo, Math.floor(Math.random() * 6)) * DAY),
      })
      .returning();

    /* activity trail with stage-change meta (feeds velocity + sankey) */
    const firstStage = d.path.length ? stageByName.get(d.path[0]) : savedStage;
    await db.insert(schema.activities).values({
      applicationId: app.id,
      type: "created",
      message: `Added ${d.title} at ${d.company}`,
      meta: JSON.stringify({ to: firstStage?.id ?? null }),
      createdAt: new Date(now - (d.appliedDaysAgo + 1) * DAY),
    });
    for (let i = 1; i < d.path.length; i++) {
      const from = stageByName.get(d.path[i - 1]);
      const to = stageByName.get(d.path[i]);
      const t = now - (d.appliedDaysAgo - (i * d.appliedDaysAgo) / d.path.length) * DAY;
      await db.insert(schema.activities).values({
        applicationId: app.id,
        type: "stage_change",
        message: `${d.company}: ${from?.name} → ${to?.name}`,
        meta: JSON.stringify({ from: from?.id ?? null, to: to?.id ?? null }),
        createdAt: new Date(t),
      });
    }

    /* interviews for apps that reached Interviewing+ */
    if (d.path.includes("Interviewing") || d.path.includes("Offer")) {
      await db.insert(schema.interviews).values({
        applicationId: app.id,
        round: "Recruiter screen",
        scheduledAt: new Date(now - Math.max(1, d.appliedDaysAgo - 5) * DAY),
        format: "phone",
        outcome: "passed",
      });
      await db.insert(schema.interviews).values({
        applicationId: app.id,
        round: "Technical interview",
        scheduledAt: new Date(now + (2 + (count % 4)) * DAY + 15 * 3600000),
        format: "video",
        interviewers: "TBD",
        prepNotes: "Review system design basics; re-read the JD.",
        outcome: "pending",
      });
    }

    /* a few tasks */
    if (count % 3 === 0 && d.path.length) {
      await db.insert(schema.tasks).values({
        applicationId: app.id,
        title: `Follow up with ${d.company}`,
        dueAt: new Date(now + ((count % 5) - 2) * DAY),
      });
    }

    /* link demo contacts */
    const match = insertedContacts.find((c) => c.company === d.company);
    if (match) {
      await db.insert(schema.applicationContacts).values({
        applicationId: app.id,
        contactId: match.id,
      });
    }
    count++;
  }

  /* demo discovered inbox rows (externalId prefixed demo- so "Clear demo data" removes them) */
  await db.insert(schema.discovered).values([
    {
      source: "remotive", externalId: "demo-1",
      company: "PostHog", title: "Full Stack Engineer - Product Analytics",
      url: "https://posthog.com/careers", location: "Remote", remote: true,
      salaryMin: 150000, salaryMax: 190000, currency: "USD",
      description: "Ship features across our React/Node analytics platform. Strong TypeScript required.",
      postedAt: new Date(now - 1 * DAY), fitScore: 86,
      fitReason: "Strong overlap with full-stack TypeScript experience and product focus.",
    },
    {
      source: "greenhouse", externalId: "demo-2",
      company: "Stripe", title: "Frontend Engineer, Payments UI",
      url: "https://stripe.com/jobs", location: "San Francisco, CA",
      salaryMin: 165000, salaryMax: 215000, currency: "USD",
      description: "Build the surfaces millions of businesses use to accept payments.",
      postedAt: new Date(now - 2 * DAY), fitScore: 78,
      fitReason: "Title matches target role; company already in your pipeline (different team).",
    },
    {
      source: "hn", externalId: "demo-3",
      company: "YC startup (stealth)", title: "Founding Engineer",
      url: "https://news.ycombinator.com", location: "Remote",
      description: "Seed-stage, building dev tools. Equity-heavy comp. React + Go stack.",
      postedAt: new Date(now - 3 * DAY), fitScore: 55,
      fitReason: "Interesting stack but comp structure and seniority are a stretch.",
    },
  ]);
  console.log("• seeded 3 demo discovered jobs");

  /* demo outreach campaign (cascades away with the demo application) */
  const [linearApp] = await db
    .select()
    .from(schema.applications)
    .where(eq(schema.applications.company, "Linear"));
  if (linearApp) {
    const campaignContacts = await db.insert(schema.contacts).values([
      { name: "Jordan Blake", title: "Technical Recruiter", company: "Linear", email: "jordan@example.com", origin: "demo" },
      { name: "Dev Patel", title: "Engineering Manager", company: "Linear", email: "dev@example.com", origin: "demo" },
      { name: "Sofia Almeida", title: "Product Engineer", company: "Linear", email: "sofia@example.com", origin: "demo" },
    ]).returning();

    const [campaign] = await db.insert(schema.campaigns).values({
      applicationId: linearApp.id,
      status: "active",
    }).returning();

    const [leadRecruiter] = await db.insert(schema.leads).values({
      campaignId: campaign.id, contactId: campaignContacts[0].id, persona: "recruiter", status: "active",
    }).returning();
    const [leadManager] = await db.insert(schema.leads).values({
      campaignId: campaign.id, contactId: campaignContacts[1].id, persona: "manager", status: "replied",
    }).returning();
    const [leadPeer] = await db.insert(schema.leads).values({
      campaignId: campaign.id, contactId: campaignContacts[2].id, persona: "peer", status: "active",
    }).returning();

    await db.insert(schema.outreachMessages).values([
      {
        leadId: leadRecruiter.id, stepPosition: 1, type: "email", status: "drafted",
        subject: "Product Engineer application — quick intro",
        body: "Hi Jordan,\n\nI applied for the Product Engineer role and wanted to introduce myself directly. I've spent the last few years building fast, polished product surfaces in React, and Linear's obsession with craft is exactly why I applied.\n\nWould you be open to a short chat about the role?\n\nThanks!",
      },
      {
        leadId: leadPeer.id, stepPosition: 1, type: "email", status: "drafted",
        subject: "Fellow product eng — question about the team",
        body: "Hi Sofia,\n\nI'm in the pipeline for the Product Engineer opening and would love a peer's take: what's the part of the work that surprised you most after joining?\n\nAny insight would be hugely appreciated — happy to keep it to one reply!",
      },
      {
        leadId: leadManager.id, stepPosition: 1, type: "email", status: "sent",
        subject: "Interest in the Product Engineer opening",
        body: "Hi Dev,\n\nI recently applied for the Product Engineer opening on your team. I've shipped dashboard and workflow surfaces used by millions and I'd love to bring that to Linear.\n\nWould you have 15 minutes this week?",
        sentAt: new Date(now - 2 * DAY),
      },
    ]);
    console.log("• seeded 1 demo outreach campaign (3 leads, 2 queued drafts, 1 sent + replied)");
  }

  /* one unlinked general task */
  await db.insert(schema.tasks).values({
    title: "Refresh resume with latest project",
    dueAt: new Date(now + 1 * DAY),
  });

  console.log(`✔ seeded ${count} demo applications (flagged — clear anytime in Settings)`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
