import { buildSystemPrompt } from '@/lib/prompts/system';
import { formatContext, retrieveRelevantContext } from '@/lib/chatbot/rag';
import { getToolContext } from '@/lib/chatbot/data-tool';
import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

function shouldUseKnowledgeLookup(message: string) {
  const text = message.toLowerCase();
  const productOnlySignals =
    /\b(products?|product|items?|catalog|catalogue|categories?|category|recommend|recommendation|suggest|price|prices|pricing|available|availability)\b/i.test(
      text,
    );
  const knowledgeSignals =
    /\b(policy|return|refund|shipping|delivery|warranty|support|faq|help|hours|contact|location|track|order|orders|payment|checkout|account)\b/i.test(
      text,
    );

  return knowledgeSignals || !productOnlySignals;
}

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    if (typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { error: 'A message is required.' },
        { status: 400 },
      );
    }

    const useKnowledgeLookup = shouldUseKnowledgeLookup(message);
    const [relevantChunks, toolResults] = await Promise.all([
      useKnowledgeLookup ? retrieveRelevantContext(message) : Promise.resolve([]),
      getToolContext(message),
    ]);
    const contextBlock = useKnowledgeLookup
      ? formatContext(relevantChunks)
      : 'Knowledge lookup skipped for this product-focused request.';
    const toolBlock =
      toolResults.length > 0
        ? JSON.stringify(toolResults, null, 2)
        : 'No endpoint data was requested.';

    const contents: Array<{
      role: 'user' | 'model';
      parts: { text: string }[];
    }> = [
      {
        role: 'user',
        parts: [{ text: message }],
      },
    ];

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing GEMINI_API_KEY.' },
        { status: 500 },
      );
    }

    console.log('Calling Gemini API with', contents.length, 'messages');

    const ai = new GoogleGenAI({ apiKey });
    const systemInstruction = buildSystemPrompt('default', [
      'Use the following retrieved context when it helps answer the user:',
      contextBlock.slice(0, 1200),
      'Use the following tool output when the user asks about products or categories:',
      toolBlock,
      'For store-specific product, pricing, availability, policy, and FAQ questions, rely on the provided context and tool output only.',
      'If the needed information is missing or incomplete, say that clearly and do not guess.',
    ]);
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents,
      config: {
        systemInstruction,
      },
    });

    const reply = response.text || 'I could not generate a reply right now.';

    console.log('Gemini response received, length:', reply.length);

    return NextResponse.json({
      reply,
    });
  } catch (error) {
    console.error('Chat API error:', {
      message: error instanceof Error ? error.message : String(error),
      code:
        error instanceof Error && 'code' in error
          ? String((error as { code?: unknown }).code)
          : undefined,
      details: error instanceof Error ? error.toString() : String(error),
    });

    return NextResponse.json(
      { error: 'Failed to generate a response.' },
      { status: 500 },
    );
  }
}
