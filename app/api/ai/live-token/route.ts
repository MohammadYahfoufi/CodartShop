import { GoogleGenAI, Modality } from "@google/genai";
import { createHmac } from "node:crypto";
import { getAuthClaims } from "@/lib/supabase-auth-server";
import { buildShoppingAssistantInstruction } from "@/lib/chatbot/knowledge";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MODEL = "gemini-3.1-flash-live-preview";

function integerSetting(name: string, fallback: number, minimum: number, maximum: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback;
}

const SESSION_MINUTES = integerSetting("AI_VOICE_MAX_SESSION_MINUTES", 5, 1, 15);
const USER_HOURLY_LIMIT = integerSetting("AI_VOICE_USER_HOURLY_LIMIT", 2, 1, 20);
const USER_DAILY_LIMIT = integerSetting("AI_VOICE_USER_DAILY_LIMIT", 3, 1, 100);
const NETWORK_HOURLY_LIMIT = integerSetting("AI_VOICE_NETWORK_HOURLY_LIMIT", 3, 1, 100);
const NETWORK_DAILY_LIMIT = integerSetting("AI_VOICE_NETWORK_DAILY_LIMIT", 6, 1, 500);
const GLOBAL_DAILY_LIMIT = integerSetting("AI_VOICE_GLOBAL_DAILY_LIMIT", 30, 1, 10_000);

function networkKey(request: Request, secret: string) {
  const forwarded = request.headers.get("x-vercel-forwarded-for")
    ?? request.headers.get("x-forwarded-for")
    ?? "unknown";
  const address = forwarded.split(",")[0]?.trim() || "unknown";
  return createHmac("sha256", secret).update(address).digest("hex");
}

export async function POST(request: Request) {
  try {
    const claims = await getAuthClaims();
    const userId = typeof claims?.sub === "string" ? claims.sub : "";
    if (!userId) return Response.json({ error: "Sign in before starting a voice call." }, { status: 401 });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return Response.json({ error: "Voice chat is not configured yet." }, { status: 503 });

    const { data: quota, error: quotaError } = await getSupabaseAdmin().rpc("claim_ai_voice_session", {
      p_user_id: userId,
      p_request_key: networkKey(request, process.env.AI_VOICE_RATE_LIMIT_SECRET ?? apiKey),
      p_user_hourly_limit: USER_HOURLY_LIMIT,
      p_user_daily_limit: USER_DAILY_LIMIT,
      p_network_hourly_limit: NETWORK_HOURLY_LIMIT,
      p_network_daily_limit: NETWORK_DAILY_LIMIT,
      p_global_daily_limit: GLOBAL_DAILY_LIMIT,
    });
    if (quotaError) {
      console.error("Voice quota check failed", quotaError);
      return Response.json({ error: "Voice limits are not configured. Run the AI voice security migration in Supabase." }, { status: 503 });
    }

    const claim = quota as { allowed?: boolean; reason?: string } | null;
    if (!claim?.allowed) {
      const message = claim?.reason === "global_daily"
        ? "The store's voice-chat limit has been reached for today."
        : claim?.reason?.startsWith("network_")
          ? "This network has reached its voice-chat limit. Please try again later."
        : claim?.reason === "user_daily"
          ? "You have reached your voice-chat limit for today."
          : "You have reached your voice-chat limit for this hour.";
      return Response.json({ error: message }, { status: 429 });
    }

    const systemInstruction = await buildShoppingAssistantInstruction();
    const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: "v1alpha" } });
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(Date.now() + SESSION_MINUTES * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(Date.now() + 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model: MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction,
          },
        },
        httpOptions: { apiVersion: "v1alpha" },
      },
    });

    if (!token.name) throw new Error("Gemini did not return a live token.");
    return Response.json(
      { token: token.name, model: MODEL, maxSessionMinutes: SESSION_MINUTES },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Gemini live token error", error);
    const statusValue = typeof error === "object" && error
      ? "status" in error
        ? (error as { status?: unknown }).status
        : "code" in error
          ? (error as { code?: unknown }).code
          : undefined
      : undefined;
    const detail = error instanceof Error ? error.message : "";
    const providerStatus = Number(statusValue)
      || (/429|resource_exhausted/i.test(detail) ? 429 : 502);
    if (providerStatus === 429) {
      return Response.json({ error: "Voice AI is busy. Please try again later." }, { status: 429 });
    }
    if (providerStatus === 401 || providerStatus === 403) {
      return Response.json({ error: "Voice chat configuration needs attention." }, { status: 503 });
    }
    return Response.json({ error: "Could not start voice chat. Please try again later." }, { status: 502 });
  }
}
