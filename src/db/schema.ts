import { sqliteTable, text, integer, primaryKey, uniqueIndex } from "drizzle-orm/sqlite-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const now = () =>
  integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date());

export const stages = sqliteTable("stages", {
  id: id(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#8b8bf5"),
  position: integer("position").notNull().default(0),
  // terminal stages (Rejected, Withdrawn…) are excluded from "active" counts and staleness
  isTerminal: integer("is_terminal", { mode: "boolean" }).notNull().default(false),
  createdAt: now(),
});

export const sources = sqliteTable("sources", {
  id: id(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#7dd3fc"),
  createdAt: now(),
});

export const tags = sqliteTable("tags", {
  id: id(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#f9a8d4"),
  createdAt: now(),
});

export const applications = sqliteTable("applications", {
  id: id(),
  company: text("company").notNull(),
  title: text("title").notNull(),
  url: text("url"),
  location: text("location"),
  workMode: text("work_mode"), // remote | hybrid | onsite
  jobType: text("job_type"), // full-time | contract | internship | part-time
  salaryMin: integer("salary_min"),
  salaryMax: integer("salary_max"),
  salaryAsk: integer("salary_ask"),
  currency: text("currency").default("USD"),
  sourceId: text("source_id").references(() => sources.id, { onDelete: "set null" }),
  referrer: text("referrer"),
  excitement: integer("excitement"), // 1-5
  stageId: text("stage_id").references(() => stages.id, { onDelete: "set null" }),
  appliedAt: integer("applied_at", { mode: "timestamp_ms" }),
  notes: text("notes"),
  jdText: text("jd_text"), // raw job description for reference / re-extraction
  prepPack: text("prep_pack"), // v4: AI interview prep, generated when stage hits Interviewing
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  demo: integer("demo", { mode: "boolean" }).notNull().default(false),
  lastActivityAt: integer("last_activity_at", { mode: "timestamp_ms" }).$defaultFn(
    () => new Date()
  ),
  createdAt: now(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()),
});

export const applicationTags = sqliteTable(
  "application_tags",
  {
    applicationId: text("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.applicationId, t.tagId] })]
);

export const interviews = sqliteTable("interviews", {
  id: id(),
  applicationId: text("application_id")
    .notNull()
    .references(() => applications.id, { onDelete: "cascade" }),
  round: text("round").notNull(), // e.g. "Recruiter screen", "Technical"
  scheduledAt: integer("scheduled_at", { mode: "timestamp_ms" }),
  format: text("format"), // phone | video | onsite
  interviewers: text("interviewers"),
  prepNotes: text("prep_notes"),
  outcome: text("outcome"), // pending | passed | failed | cancelled
  createdAt: now(),
});

export const tasks = sqliteTable("tasks", {
  id: id(),
  applicationId: text("application_id").references(() => applications.id, {
    onDelete: "cascade",
  }),
  title: text("title").notNull(),
  notes: text("notes"), // e.g. full DM text ready to copy
  linkUrl: text("link_url"), // e.g. the lead's LinkedIn profile
  dueAt: integer("due_at", { mode: "timestamp_ms" }),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  createdAt: now(),
});

export const contacts = sqliteTable("contacts", {
  id: id(),
  name: text("name").notNull(),
  title: text("title"),
  company: text("company"),
  email: text("email"),
  phone: text("phone"),
  linkedinUrl: text("linkedin_url"),
  notes: text("notes"),
  origin: text("origin").notNull().default("manual"), // manual | apollo
  createdAt: now(),
});

export const applicationContacts = sqliteTable(
  "application_contacts",
  {
    applicationId: text("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.applicationId, t.contactId] })]
);

// per-application history + global feed
export const activities = sqliteTable("activities", {
  id: id(),
  applicationId: text("application_id").references(() => applications.id, {
    onDelete: "cascade",
  }),
  type: text("type").notNull(), // created | stage_change | note | task | interview | contact | follow_up | archived
  message: text("message").notNull(),
  meta: text("meta"), // JSON, e.g. {"from":stageId,"to":stageId} for stage_change
  createdAt: now(),
});

// single-user key/value store: profile, goals, API keys, onboarding state
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/* ---------- v2: automated job discovery ---------- */

export const searches = sqliteTable("searches", {
  id: id(),
  name: text("name").notNull(),
  keywords: text("keywords").notNull(), // space-separated; all must appear in title+description
  location: text("location"),
  remoteOnly: integer("remote_only", { mode: "boolean" }).notNull().default(false),
  salaryMin: integer("salary_min"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: now(),
});

// companies whose Greenhouse/Lever boards get polled
export const watchlist = sqliteTable("watchlist", {
  id: id(),
  company: text("company").notNull(),
  ats: text("ats").notNull(), // greenhouse | lever
  slug: text("slug").notNull(), // board token, e.g. "stripe"
  keywords: text("keywords"), // optional filter; empty = all postings
  createdAt: now(),
});

export const discovered = sqliteTable(
  "discovered",
  {
    id: id(),
    source: text("source").notNull(), // adzuna | jsearch | remotive | remoteok | hn | greenhouse | lever
    externalId: text("external_id").notNull(),
    searchId: text("search_id"),
    company: text("company").notNull(),
    title: text("title").notNull(),
    url: text("url"),
    location: text("location"),
    remote: integer("remote", { mode: "boolean" }),
    salaryMin: integer("salary_min"),
    salaryMax: integer("salary_max"),
    currency: text("currency"),
    description: text("description"),
    postedAt: integer("posted_at", { mode: "timestamp_ms" }),
    fitScore: integer("fit_score"),
    fitReason: text("fit_reason"),
    status: text("status").notNull().default("new"), // new | approved | dismissed
    createdAt: now(),
  },
  (t) => [uniqueIndex("discovered_source_ext").on(t.source, t.externalId)]
);

/* ---------- v3: outreach automation ---------- */

export const resumes = sqliteTable("resumes", {
  id: id(),
  name: text("name").notNull(), // display name, e.g. "Frontend resume"
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  data: text("data").notNull(), // base64
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: now(),
});

// user-editable sequence, seeded persona-aware; one row per step
export const sequenceSteps = sqliteTable("sequence_steps", {
  id: id(),
  persona: text("persona").notNull(), // recruiter | manager | peer
  position: integer("position").notNull(), // 1-based
  type: text("type").notNull(), // email | dm_task
  delayDays: integer("delay_days").notNull().default(0), // days after previous step sent
  framing: text("framing").notNull(), // hint fed to the LLM
  createdAt: now(),
});

export const campaigns = sqliteTable("campaigns", {
  id: id(),
  applicationId: text("application_id")
    .notNull()
    .references(() => applications.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("active"), // active | paused | stopped | done
  resumeId: text("resume_id").references(() => resumes.id, { onDelete: "set null" }), // null = default resume
  createdAt: now(),
});

export const leads = sqliteTable("leads", {
  id: id(),
  campaignId: text("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  contactId: text("contact_id")
    .notNull()
    .references(() => contacts.id, { onDelete: "cascade" }),
  persona: text("persona").notNull(), // recruiter | manager | peer
  status: text("status").notNull().default("active"), // active | replied | stopped | done
  createdAt: now(),
});

export const outreachMessages = sqliteTable("outreach_messages", {
  id: id(),
  leadId: text("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  stepPosition: integer("step_position").notNull(),
  type: text("type").notNull(), // email | dm_task
  subject: text("subject"),
  body: text("body").notNull(),
  status: text("status").notNull().default("drafted"), // drafted | approved | scheduled | sent | skipped | cancelled
  scheduledFor: integer("scheduled_for", { mode: "timestamp_ms" }),
  sentAt: integer("sent_at", { mode: "timestamp_ms" }),
  gmailThreadId: text("gmail_thread_id"),
  createdAt: now(),
});

// one-click-confirm suggestions derived from Gmail scanning
export const suggestions = sqliteTable("suggestions", {
  id: id(),
  applicationId: text("application_id").references(() => applications.id, {
    onDelete: "cascade",
  }),
  gmailThreadId: text("gmail_thread_id").notNull(),
  subject: text("subject"),
  fromAddr: text("from_addr"),
  snippet: text("snippet"),
  kind: text("kind").notNull(), // interview | rejection | reply
  proposedStageId: text("proposed_stage_id"),
  proposedTask: text("proposed_task"),
  status: text("status").notNull().default("pending"), // pending | applied | dismissed
  createdAt: now(),
});
