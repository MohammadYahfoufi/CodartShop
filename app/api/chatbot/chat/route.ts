import { formatContext, retrieveRelevantContext } from '@/lib/chatbot/rag';
import { buildShoppingAssistantInstruction, ensureProductLinks } from '@/lib/chatbot/knowledge';
import { GoogleGenAI } from '@google/genai';
import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getAuthClaims } from '@/lib/supabase-auth-server';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const GROQ_MODEL = process.env.GROQ_CHAT_MODEL?.trim() || 'openai/gpt-oss-20b';
const GEMINI_MODEL = process.env.GEMINI_CHAT_MODEL?.trim() || 'gemini-3.7-flash';
const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_MESSAGE_LENGTH = 2_000;
const MAX_HISTORY_MESSAGES = 10;

function integerSetting(name: string, fallback: number, minimum: number, maximum: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback;
}

const USER_HOURLY_LIMIT = integerSetting('AI_CHAT_USER_HOURLY_LIMIT', 10, 1, 100);
const USER_DAILY_LIMIT = integerSetting('AI_CHAT_USER_DAILY_LIMIT', 30, 1, 500);
const NETWORK_HOURLY_LIMIT = integerSetting('AI_CHAT_NETWORK_HOURLY_LIMIT', 20, 1, 500);
const NETWORK_DAILY_LIMIT = integerSetting('AI_CHAT_NETWORK_DAILY_LIMIT', 60, 1, 2_000);
const GLOBAL_DAILY_LIMIT = integerSetting('AI_CHAT_GLOBAL_DAILY_LIMIT', 500, 1, 100_000);

type Provider = 'groq' | 'gemini';

type ClientMessage = {
  role: 'user' | 'assistant';
  content: string;
};

class ProviderError extends Error {
  constructor(
    readonly provider: Provider,
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function providerOrder(): Provider[] {
  return process.env.AI_CHAT_PRIMARY_PROVIDER?.trim().toLowerCase() === 'gemini'
    ? ['gemini', 'groq']
    : ['groq', 'gemini'];
}

function networkKey(request: Request, secret: string) {
  const forwarded = request.headers.get('x-vercel-forwarded-for')
    ?? request.headers.get('x-forwarded-for')
    ?? 'unknown';
  const address = forwarded.split(',')[0]?.trim() || 'unknown';
  return createHmac('sha256', secret).update(address).digest('hex');
}

export function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'codart-chatbot',
      primaryProvider: providerOrder()[0],
      models: { groq: GROQ_MODEL, gemini: GEMINI_MODEL },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

function parseHistory(value: unknown): ClientMessage[] {
  if (!Array.isArray(value)) return [];

  return value
    .slice(-MAX_HISTORY_MESSAGES)
    .filter(
      (item): item is ClientMessage =>
        Boolean(item) &&
        typeof item === 'object' &&
        ((item as ClientMessage).role === 'user' ||
          (item as ClientMessage).role === 'assistant') &&
        typeof (item as ClientMessage).content === 'string',
    )
    .map((item) => ({
      role: item.role,
      content: item.content.trim().slice(0, MAX_MESSAGE_LENGTH),
    }))
    .filter((item) => item.content.length > 0);
}

async function generateWithGroq(
  apiKey: string,
  systemInstruction: string,
  history: ClientMessage[],
  message: string,
) {
  const response = await fetch(GROQ_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemInstruction },
        ...history,
        { role: 'user', content: message },
      ],
      temperature: 0.2,
      max_completion_tokens: 400,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });

  const result = (await response.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string | null } }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new ProviderError(
      'groq',
      response.status,
      result.error?.message ?? 'Unknown Groq error',
    );
  }

  const reply = result.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new ProviderError('groq', 502, 'Groq returned an empty response.');
  return reply;
}

async function generateWithGemini(
  apiKey: string,
  systemInstruction: string,
  history: ClientMessage[],
  message: string,
) {
  try {
    const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 20_000 } });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        ...history.map((item) => ({
          role: item.role === 'assistant' ? ('model' as const) : ('user' as const),
          parts: [{ text: item.content }],
        })),
        { role: 'user', parts: [{ text: message }] },
      ],
      config: {
        systemInstruction,
        temperature: 0.2,
        maxOutputTokens: 400,
      },
    });
    const reply = response.text?.trim();
    if (!reply) throw new ProviderError('gemini', 502, 'Gemini returned an empty response.');
    return reply;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    const statusValue = typeof error === 'object' && error
      ? 'status' in error
        ? (error as { status?: unknown }).status
        : 'code' in error
          ? (error as { code?: unknown }).code
          : undefined
      : undefined;
    const message = error instanceof Error ? error.message : 'Unknown Gemini error';
    const status = Number(statusValue)
      || (/429|resource_exhausted/i.test(message) ? 429 : 502);
    throw new ProviderError(
      'gemini',
      status,
      message,
    );
  }
}

export async function POST(req: Request) {
  try {
    let body: { message?: unknown; history?: unknown };
    try {
      body = (await req.json()) as { message?: unknown; history?: unknown };
    } catch {
      return NextResponse.json(
        { error: 'The chat request is not valid.' },
        { status: 400 },
      );
    }
    const message = typeof body.message === 'string' ? body.message.trim() : '';

    if (!message) {
      return NextResponse.json(
        { error: 'A message is required.' },
        { status: 400 },
      );
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer.` },
        { status: 400 },
      );
    }

    const claims = await getAuthClaims();
    const userId = typeof claims?.sub === 'string' ? claims.sub : '';
    if (!userId) {
      return NextResponse.json(
        { error: 'Sign in before using AI chat.' },
        { status: 401 },
      );
    }

    const keys: Partial<Record<Provider, string>> = {
      groq: process.env.GROQ_API_KEY?.trim(),
      gemini: process.env.GEMINI_API_KEY?.trim(),
    };
    const providers = providerOrder().filter((provider) => Boolean(keys[provider]));

    if (providers.length === 0) {
      return NextResponse.json(
        { error: 'AI chat is not configured. Add GROQ_API_KEY or GEMINI_API_KEY and redeploy.' },
        { status: 503 },
      );
    }

    const quotaSecret = process.env.AI_CHAT_RATE_LIMIT_SECRET
      ?? process.env.AI_VOICE_RATE_LIMIT_SECRET
      ?? keys[providers[0]]!;
    const { data: quota, error: quotaError } = await getSupabaseAdmin().rpc(
      'claim_ai_chat_message',
      {
        p_user_id: userId,
        p_request_key: networkKey(req, quotaSecret),
        p_user_hourly_limit: USER_HOURLY_LIMIT,
        p_user_daily_limit: USER_DAILY_LIMIT,
        p_network_hourly_limit: NETWORK_HOURLY_LIMIT,
        p_network_daily_limit: NETWORK_DAILY_LIMIT,
        p_global_daily_limit: GLOBAL_DAILY_LIMIT,
      },
    );
    if (quotaError) {
      console.error('AI chat quota check failed', quotaError);
      return NextResponse.json(
        { error: 'AI chat limits are not configured. Run the AI chat security migration in Supabase.' },
        { status: 503 },
      );
    }

    const claim = quota as {
      allowed?: boolean;
      reason?: string;
      userDailyRemaining?: number;
    } | null;
    if (!claim?.allowed) {
      const error = claim?.reason === 'global_daily'
        ? 'The store\'s AI chat limit has been reached for today.'
        : claim?.reason?.startsWith('network_')
          ? 'This network has reached its AI chat limit. Please try again later.'
          : claim?.reason === 'user_daily'
            ? 'You have reached your AI chat limit for today.'
            : 'You have reached your AI chat limit for this hour.';
      return NextResponse.json({ error }, { status: 429 });
    }

    const history = parseHistory(body.history);
    const relevantChunks = await retrieveRelevantContext(message);
    const systemInstruction = await buildShoppingAssistantInstruction(
      formatContext(relevantChunks),
    );

    const failures: ProviderError[] = [];
    for (const provider of providers) {
      try {
        const apiKey = keys[provider]!;
        const reply = provider === 'groq'
          ? await generateWithGroq(apiKey, systemInstruction, history, message)
          : await generateWithGemini(apiKey, systemInstruction, history, message);
        const replyWithLinks = await ensureProductLinks(reply).catch((error) => {
          console.error('Could not add product links to AI reply:', error);
          return reply;
        });
        return NextResponse.json(
          {
            reply: replyWithLinks,
            provider,
            messagesRemainingToday: claim.userDailyRemaining ?? null,
          },
          {
            headers: {
              'Cache-Control': 'no-store',
              'X-AI-Provider': provider,
            },
          },
        );
      } catch (error) {
        const failure = error instanceof ProviderError
          ? error
          : new ProviderError(
              provider,
              502,
              error instanceof Error ? error.message : 'Unknown provider error',
            );
        failures.push(failure);
        console.error(`${provider} chat provider failed:`, {
          status: failure.status,
          message: failure.message,
        });
      }
    }

    const allRateLimited = failures.every((failure) => failure.status === 429);
    const allAuthenticationFailed = failures.every(
      (failure) => failure.status === 401 || failure.status === 403,
    );
    const status = allRateLimited ? 429 : allAuthenticationFailed ? 503 : 502;
    const error = allRateLimited
      ? 'Both AI providers have reached their current limits. Please try again later.'
      : allAuthenticationFailed
        ? 'AI chat authentication failed. Check the Groq and Gemini API keys, then redeploy.'
        : 'Both AI providers are temporarily unavailable. Please try again shortly.';
    return NextResponse.json({ error }, { status });
  } catch (error) {
    console.error('AI chat route error:', {
      message: error instanceof Error ? error.message : String(error),
      code:
        error instanceof Error && 'code' in error
          ? String((error as { code?: unknown }).code)
          : undefined,
      details: error instanceof Error ? error.toString() : String(error),
    });

    return NextResponse.json(
      { error: 'The AI assistant could not respond. Please try again later.' },
      { status: 500 },
    );
  }
}
