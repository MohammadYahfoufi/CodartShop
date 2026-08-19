import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getSupabaseAdmin, isLocalPersistenceEnabled, isSupabaseConfigured, isSupabaseTemporarilyUnavailable, markSupabaseUnavailable } from "@/lib/supabase-server";

export type AnalyticsEvent = { metric: "page_view" | "click"; key: string; count: number };
export type AnalyticsRow = { day: string; metric: "page_view" | "click"; event_key: string; event_count: number };

const analyticsFile = path.join(process.cwd(), "data", "analytics.json");

async function readLocalAnalytics(): Promise<AnalyticsRow[]> {
  try { const rows = JSON.parse(await readFile(analyticsFile, "utf8")) as AnalyticsRow[]; return Array.isArray(rows) ? rows : []; }
  catch { return []; }
}

async function writeLocalAnalytics(rows: AnalyticsRow[]) {
  await mkdir(path.dirname(analyticsFile), { recursive: true });
  await writeFile(analyticsFile, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
}

export async function recordAnalytics(events: AnalyticsEvent[]) {
  if (isSupabaseConfigured && !isSupabaseTemporarilyUnavailable()) {
    try {
      const { error } = await getSupabaseAdmin().rpc("increment_analytics_batch", { events });
      if (error) throw error;
      return;
    } catch (error) {
      markSupabaseUnavailable();
      console.warn("Analytics is using local fallback:", error);
    }
  }
  if (!isLocalPersistenceEnabled) return;
  const today = new Date().toISOString().slice(0, 10);
  const rows = await readLocalAnalytics();
  for (const event of events) {
    const existing = rows.find((row) => row.day === today && row.metric === event.metric && row.event_key === event.key);
    if (existing) existing.event_count += event.count;
    else rows.push({ day: today, metric: event.metric, event_key: event.key, event_count: event.count });
  }
  await writeLocalAnalytics(rows);
}

export async function getAnalytics(days = 30): Promise<AnalyticsRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - Math.max(1, days) + 1);
  const date = since.toISOString().slice(0, 10);
  if (isSupabaseConfigured && !isSupabaseTemporarilyUnavailable()) {
    try {
      const { data, error } = await getSupabaseAdmin().from("analytics_daily").select("day,metric,event_key,event_count").gte("day", date).order("day");
      if (error) throw error;
      return (data ?? []).map((row) => ({ ...row, event_count: Number(row.event_count) })) as AnalyticsRow[];
    } catch (error) {
      markSupabaseUnavailable();
      console.warn("Unable to load Supabase analytics; using local data:", error);
    }
  }
  return (await readLocalAnalytics()).filter((row) => row.day >= date);
}
