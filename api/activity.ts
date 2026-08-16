import { createHmac, randomUUID } from "node:crypto";

type ActivityType = "visit" | "download";
type Platform = "mac-arm" | "mac-intel" | "windows";

const PLATFORMS = new Set<string>(["mac-arm", "mac-intel", "windows"]);

interface Req {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface Res {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

function json(res: Res, status: number, body: Record<string, unknown>): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function header(headers: Req["headers"], name: string): string | undefined {
  const value = headers[name];
  if (Array.isArray(value)) return value[0];
  return value || undefined;
}

function decodeGeoValue(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

function geoMeta(headers: Req["headers"]): Record<string, string> {
  const country = header(headers, "x-vercel-ip-country") ?? header(headers, "cf-ipcountry");
  const region =
    header(headers, "x-vercel-ip-country-region") ??
    header(headers, "cf-region") ??
    header(headers, "cf-region-code");
  const city = header(headers, "x-vercel-ip-city") ?? header(headers, "cf-ipcity");
  const meta: Record<string, string> = {};
  if (country) meta.country = country;
  if (region) meta.region = decodeGeoValue(region);
  if (city) meta.city = decodeGeoValue(city);
  return meta;
}

function parseBody(raw: unknown): { type: ActivityType; platform?: Platform } | null {
  let body = raw;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return null;
    }
  }
  if (!body || typeof body !== "object") return null;

  const { type, platform } = body as { type?: unknown; platform?: unknown };
  if (type !== "visit" && type !== "download") return null;
  if (platform !== undefined && (typeof platform !== "string" || !PLATFORMS.has(platform))) {
    return null;
  }
  return { type, platform: platform as Platform | undefined };
}

function envelope(input: { type: ActivityType; platform?: Platform }, geo: Record<string, string>) {
  if (input.type === "visit") {
    return {
      source: "tax-ui",
      type: "visit",
      speed: "signal",
      summary: "Someone visited Tax UI",
      visibility: "public",
      idempotency_key: `tax-ui:visit:${randomUUID()}`,
      subject: { kind: "page", label: "Tax UI", href: "/" },
      meta: { path: "/", title: "Tax UI", ...geo },
    };
  }

  return {
    source: "tax-ui",
    type: "download",
    speed: "event",
    summary: "Someone downloaded Tax UI",
    visibility: "public",
    idempotency_key: `tax-ui:download:${randomUUID()}`,
    subject: { kind: "download", label: "Tax UI" },
    meta: { ...(input.platform ? { platform: input.platform } : {}), ...geo },
  };
}

export default async function handler(req: Req, res: Res) {
  try {
    if (req.method !== "POST") {
      json(res, 405, { ok: false });
      return;
    }

    const secret = process.env.ACTIVITY_INGEST_HMAC_SECRET;
    if (!secret) {
      json(res, 200, { ok: true, skipped: true });
      return;
    }

    const parsed = parseBody(req.body);
    if (!parsed) {
      json(res, 400, { ok: false });
      return;
    }

    const raw = JSON.stringify(envelope(parsed, geoMeta(req.headers)));
    const signature = createHmac("sha256", secret).update(raw).digest("hex");
    const url = process.env.ACTIVITY_INGEST_URL || "https://brianlovin.com/api/activity";

    try {
      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-activity-signature": signature,
        },
        body: raw,
        signal: AbortSignal.timeout(800),
      });
    } catch {
      // fail open
    }

    json(res, 200, { ok: true });
  } catch {
    json(res, 200, { ok: true });
  }
}
