import { z } from "zod";

const courseSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  name: z.string().min(1),
  time_zone: z.string().nullable().optional(),
});

const assignmentSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  due_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  published: z.boolean().optional(),
});

export type CanvasCourse = z.infer<typeof courseSchema>;
export type CanvasAssignment = z.infer<typeof assignmentSchema>;

export class CanvasError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public retryable = false,
  ) {
    super(message);
  }
}

export function canvasConfig(userId: string) {
  const owner = process.env.CANVAS_OWNER_USER_ID;
  if (!owner) throw new CanvasError("CANVAS_NOT_CONFIGURED", "Canvas owner is not configured", 503);
  if (owner !== userId) throw new CanvasError("CANVAS_NOT_AVAILABLE", "Canvas import is unavailable for this account", 403);

  const token = process.env.CANVAS_ACCESS_TOKEN;
  const rawUrl = process.env.CANVAS_BASE_URL;
  if (!token || !rawUrl) throw new CanvasError("CANVAS_NOT_CONFIGURED", "Canvas URL or token is missing", 503);

  let base: URL;
  try {
    base = new URL(rawUrl);
  } catch {
    throw new CanvasError("CANVAS_NOT_CONFIGURED", "Canvas URL is invalid", 503);
  }
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash || base.pathname !== "/") {
    throw new CanvasError("CANVAS_NOT_CONFIGURED", "Canvas URL must be an HTTPS origin", 503);
  }
  return { base, token };
}

function nextLink(header: string | null) {
  const part = header?.split(/,(?=\s*<)/).find((item) => /;\s*rel="?next"?\s*(?:;|$)/i.test(item));
  return part?.match(/<([^>]+)>/)?.[1] ?? null;
}

export async function canvasPages<T>(
  config: ReturnType<typeof canvasConfig>,
  path: string,
  schema: z.ZodType<T>,
  maxItems: number,
): Promise<T[]> {
  let url: URL | null = new URL(path, config.base);
  const result: T[] = [];
  const seen = new Set<string>();

  for (let page = 0; url && page < 20; page++) {
    if (url.origin !== config.base.origin || !url.pathname.startsWith("/api/v1/")) {
      throw new CanvasError("CANVAS_BAD_PAGE", "Canvas returned an unsafe page link", 502);
    }
    if (seen.has(url.href)) throw new CanvasError("CANVAS_BAD_PAGE", "Canvas pagination looped", 502);
    seen.add(url.href);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${config.token}`, Accept: "application/json+canvas-string-ids" },
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new CanvasError("CANVAS_UNREACHABLE", "Could not reach Canvas", 502, true);
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new CanvasError("CANVAS_AUTH_FAILED", "Canvas rejected the token or access to this course", 502);
      }
      if (response.status === 429) throw new CanvasError("CANVAS_RATE_LIMITED", "Canvas is rate limiting requests", 503, true);
      throw new CanvasError("CANVAS_REQUEST_FAILED", `Canvas returned HTTP ${response.status}`, 502, response.status >= 500);
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new CanvasError("CANVAS_BAD_DATA", "Canvas returned invalid JSON", 502);
    }
    const parsed = z.array(schema).safeParse(data);
    if (!parsed.success) throw new CanvasError("CANVAS_BAD_DATA", "Canvas returned unexpected data", 502);
    result.push(...parsed.data);
    if (result.length > maxItems) throw new CanvasError("CANVAS_TOO_LARGE", "Canvas list is too large for one import", 502);
    const link = nextLink(response.headers.get("link"));
    url = link ? new URL(link, config.base) : null;
  }
  if (url) throw new CanvasError("CANVAS_TOO_LARGE", "Canvas has too many pages for one import", 502);
  return result;
}

export function listCanvasCourses(config: ReturnType<typeof canvasConfig>) {
  return canvasPages(config, "/api/v1/courses?enrollment_state=active&enrollment_type=student&per_page=100", courseSchema, 500);
}

export function listCanvasAssignments(config: ReturnType<typeof canvasConfig>, courseId: string) {
  return canvasPages(config, `/api/v1/courses/${encodeURIComponent(courseId)}/assignments?per_page=100`, assignmentSchema, 1000);
}

export function htmlToPlainText(html: string) {
  const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return html
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*br\s*\/?\s*>|<\s*\/\s*(p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (_full, entity: string) => {
      if (entity.startsWith("#")) {
        const point = entity[1]?.toLowerCase() === "x" ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
        return Number.isInteger(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : "";
      }
      return entities[entity.toLowerCase()] ?? " ";
    })
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
