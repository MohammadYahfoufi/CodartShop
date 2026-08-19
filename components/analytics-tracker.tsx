"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

type Metric = "page_view" | "click";

export function AnalyticsTracker() {
  const pathname = usePathname();
  const queue = useRef(new Map<string, { metric: Metric; key: string; count: number }>());
  const lastPath = useRef("");

  const record = useCallback((metric: Metric, key: string) => {
    const mapKey = `${metric}:${key}`;
    const current = queue.current.get(mapKey);
    if (current) current.count += 1;
    else queue.current.set(mapKey, { metric, key, count: 1 });
  }, []);

  const flush = useCallback((beacon = false) => {
    if (!queue.current.size) return;
    const events = [...queue.current.values()];
    queue.current.clear();
    const payload = JSON.stringify({ events });
    if (beacon && navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics", new Blob([payload], { type: "application/json" }));
      return;
    }
    void fetch("/api/analytics", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(() => {
      for (const event of events) {
        const mapKey = `${event.metric}:${event.key}`;
        const current = queue.current.get(mapKey);
        if (current) current.count += event.count;
        else queue.current.set(mapKey, event);
      }
    });
  }, []);

  useEffect(() => {
    if (pathname.startsWith("/admin") || lastPath.current === pathname) return;
    lastPath.current = pathname;
    record("page_view", pathname);
  }, [pathname, record]);

  useEffect(() => {
    const click = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-analytics]") : null;
      const key = target?.dataset.analytics;
      if (key) record("click", key);
    };
    const visibility = () => { if (document.visibilityState === "hidden") flush(true); };
    const timer = window.setInterval(() => flush(), 45_000);
    document.addEventListener("click", click);
    document.addEventListener("visibilitychange", visibility);
    return () => { window.clearInterval(timer); document.removeEventListener("click", click); document.removeEventListener("visibilitychange", visibility); flush(true); };
  }, [flush, record]);

  return null;
}
