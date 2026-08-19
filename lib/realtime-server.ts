import "server-only";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase-server";
export { realtimeTopics } from "@/lib/realtime-topics";

export async function broadcastStoreEvent(topic: string, event: string) {
  if (!isSupabaseConfigured) return;
  const supabase = getSupabaseAdmin();
  const channel = supabase.channel(topic, { config: { broadcast: { ack: true } } });
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Realtime connection timed out.")), 2500);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") { clearTimeout(timeout); resolve(); }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") { clearTimeout(timeout); reject(new Error(`Realtime channel ${status.toLowerCase()}.`)); }
      });
    });
    await channel.send({ type: "broadcast", event, payload: {} });
  } catch (error) {
    console.warn("Realtime notification skipped:", error instanceof Error ? error.message : error);
  } finally {
    await supabase.removeChannel(channel);
  }
}
