import { createClient } from '@/lib/supabase/server';
import { buildSystemPrompt } from '@/lib/prompts/system';
import { formatContext, retrieveRelevantContext } from '@/lib/rag';
import { getToolContext } from '@/lib/data-tool';
import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

type ChatMessage = {
  role: 'assistant' | 'user';
  content: string;
};

export async function POST(req: Request) {
  try {
    const { message, conversationId } = await req.json();

    if (typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { error: 'A message is required.' },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error('Error getting user:', userError);
    }

    console.log('User authenticated:', !!user, user?.id);

    let currentConversationId = conversationId;
    let contents: Array<{ role: 'user' | 'model'; parts: { text: string }[] }> =
      [];
    const relevantChunks = await retrieveRelevantContext(message);
    const contextBlock = formatContext(relevantChunks);
    const toolResults = await getToolContext(message);
    const toolBlock =
      toolResults.length > 0
        ? JSON.stringify(toolResults, null, 2)
        : 'No endpoint data was requested.';

    // Only save conversations for authenticated users
    if (user) {
      if (!currentConversationId) {
        console.log('Creating new conversation for user:', user.id);
        const { data, error } = await supabase
          .from('conversations')
          .insert({
            user_id: user.id,
            title: message.split(' ').slice(0, 6).join(' '),
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating conversation:', error);
          throw error;
        }

        console.log('Conversation created:', data?.id);
        currentConversationId = data.id;
      }

      const { error: msgError } = await supabase.from('messages').insert({
        conversation_id: currentConversationId,
        role: 'user',
        content: message,
      });

      if (msgError) {
        console.error('Error inserting user message:', msgError);
        throw msgError;
      }

      const { data: history, error: historyError } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', currentConversationId)
        .order('created_at', { ascending: true })
        .limit(20);

      if (historyError) {
        console.error('Error fetching message history:', historyError);
        throw historyError;
      }

      const safeHistory = (history ?? []) as ChatMessage[];

      contents = safeHistory.map((msg) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));
    } else {
      // For unauthenticated users, just add the current message
      contents = [
        {
          role: 'user',
          parts: [{ text: message }],
        },
      ];
    }

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

    // Only save assistant response for authenticated users
    if (user && currentConversationId) {
      const { error: msgInsertError } = await supabase.from('messages').insert({
        conversation_id: currentConversationId,
        role: 'assistant',
        content: reply,
      });

      if (msgInsertError) {
        console.error('Error inserting assistant message:', msgInsertError);
        throw msgInsertError;
      }

      const { error: updateError } = await supabase
        .from('conversations')
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentConversationId);

      if (updateError) {
        console.error('Error updating conversation:', updateError);
        throw updateError;
      }
    }

    return NextResponse.json({
      conversationId: currentConversationId,
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
