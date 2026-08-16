import { recordAnalytics, type AnalyticsEvent } from "@/lib/analytics";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!Array.isArray(body?.events) || body.events.length > 50) return Response.json({ error: "Invalid analytics batch." }, { status: 400 });
    const events: AnalyticsEvent[] = body.events.flatMap((event: unknown) => {
      if (!event || typeof event !== "object") return [];
      const value = event as Record<string, unknown>;
      const metric = value.metric;
      const key = String(value.key ?? "").trim().slice(0, 180);
      const count = Math.min(1000, Math.max(1, Math.floor(Number(value.count) || 1)));
      return (metric === "page_view" || metric === "click") && key ? [{ metric, key, count }] : [];
    });
    if (events.length) await recordAnalytics(events);
    return new Response(null, { status: 204 });
  } catch {
    return Response.json({ error: "Unable to record analytics." }, { status: 500 });
  }
}
