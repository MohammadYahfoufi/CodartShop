import { buildSystemPrompt } from '@/lib/prompts/system';
import { formatContext, retrieveRelevantContext } from '@/lib/chatbot/rag';
import { getToolContext } from '@/lib/chatbot/data-tool';
import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { message, conversationId } = await req.json();

    if (typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { error: 'A message is required.' },
        { status: 400 },
      );
    }

    const relevantChunks = await retrieveRelevantContext(message);
    const contextBlock = formatContext(relevantChunks);
    const toolResults = await getToolContext(message);
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
      contextBlock,
      'Use the following tool output when the user asks about products or categories:',
      toolBlock,
      'If the retrieved context does not help, answer from general knowledge and say so when needed.',
    ]);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction,
      },
    });

    const reply = response.text || 'I could not generate a reply right now.';

    console.log('Gemini response received, length:', reply.length);

    return NextResponse.json({
      conversationId,
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
