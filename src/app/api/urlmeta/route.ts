import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

type Extracted = {
  title?: string;
  company?: string;
  location?: string;
  workMode?: string;
  jobType?: string;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  description?: string;
  pageText?: string;
  blocked?: boolean;
};

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(html: string) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
  ).trim();
}

function meta(html: string, prop: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`,
    "i"
  );
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`,
    "i"
  );
  const m = html.match(re) ?? html.match(alt);
  return m ? decodeEntities(m[1]) : undefined;
}

function parseJsonLd(html: string): Extracted {
  const out: Extracted = {};
  const blocks = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  for (const b of blocks) {
    try {
      const parsed = JSON.parse(b[1]);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        const node = item["@graph"]
          ? (item["@graph"] as Array<Record<string, unknown>>).find(
              (n) => n["@type"] === "JobPosting"
            )
          : item;
        if (!node || node["@type"] !== "JobPosting") continue;
        out.title = (node.title as string) ?? out.title;
        const org = node.hiringOrganization as { name?: string } | undefined;
        out.company = org?.name ?? out.company;
        const loc = node.jobLocation as
          | { address?: { addressLocality?: string; addressRegion?: string; addressCountry?: string } }
          | Array<{ address?: { addressLocality?: string; addressRegion?: string } }>
          | undefined;
        const addr = Array.isArray(loc) ? loc[0]?.address : loc?.address;
        if (addr) {
          out.location = [addr.addressLocality, addr.addressRegion]
            .filter(Boolean)
            .join(", ");
        }
        const jlt = node.jobLocationType as string | undefined;
        if (jlt?.toUpperCase().includes("TELECOMMUTE")) out.workMode = "remote";
        const et = node.employmentType as string | string[] | undefined;
        const etStr = (Array.isArray(et) ? et[0] : et)?.toUpperCase();
        if (etStr?.includes("FULL")) out.jobType = "full-time";
        else if (etStr?.includes("PART")) out.jobType = "part-time";
        else if (etStr?.includes("CONTRACT")) out.jobType = "contract";
        else if (etStr?.includes("INTERN")) out.jobType = "internship";
        const sal = node.baseSalary as
          | { currency?: string; value?: { minValue?: number; maxValue?: number; value?: number } }
          | undefined;
        if (sal?.value) {
          out.salaryMin = sal.value.minValue ?? sal.value.value;
          out.salaryMax = sal.value.maxValue ?? sal.value.value;
          out.currency = sal.currency;
        }
        if (typeof node.description === "string") {
          out.description = stripHtml(node.description).slice(0, 12000);
        }
        return out;
      }
    } catch {
      // ignore malformed JSON-LD blocks
    }
  }
  return out;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url } = (await req.json()) as { url?: string };
  if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });
  let parsed: URL;
  try {
    parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error("bad protocol");
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const res = await fetch(parsed.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      return NextResponse.json({ blocked: true, status: res.status } satisfies Extracted & { status: number });
    }

    const html = await res.text();
    const fromLd = parseJsonLd(html);
    const ogTitle = meta(html, "og:title") ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
    const ogSite = meta(html, "og:site_name");

    // Heuristic "Title at Company" / "Title - Company" split from og:title
    let title = fromLd.title;
    let company = fromLd.company;
    if (!title && ogTitle) {
      const cleaned = decodeEntities(ogTitle);
      const m = cleaned.match(/^(.+?)\s+(?:at|@|-|–|\|)\s+(.+?)(?:\s*[|–-].*)?$/);
      if (m) {
        title = m[1].trim();
        company = company ?? m[2].trim();
      } else {
        title = cleaned;
      }
    }
    if (!company && ogSite) company = decodeEntities(ogSite);

    const pageText = stripHtml(html).slice(0, 15000);
    // LinkedIn/Indeed etc. often return a login wall — flag when the page has no useful signal
    const blocked = !title && pageText.length < 400;

    const result: Extracted = {
      ...fromLd,
      title,
      company,
      pageText,
      blocked,
    };
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ blocked: true } satisfies Extracted);
  }
}
