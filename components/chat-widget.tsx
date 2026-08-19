'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';

type Message = {
  id: number;
  role: 'assistant' | 'user';
  content: string;
  error?: boolean;
};

type ChatResponse = {
  reply?: string;
  error?: string;
  messagesRemainingToday?: number | null;
};

const starterMessages: Message[] = [
  {
    id: 1,
    role: 'assistant',
    content: 'Hi. I can help with product recommendations and support.',
  },
];

class ChatRequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function InlineText({ content }: { content: string }) {
  const boldText = /\*\*([^*]+)\*\*/g;
  const parts: ReactNode[] = [];
  let start = 0;
  let match: RegExpExecArray | null;

  while ((match = boldText.exec(content)) !== null) {
    if (match.index > start) parts.push(content.slice(start, match.index));
    parts.push(
      <strong key={`${match[1]}-${match.index}`} className="font-semibold text-slate-900">
        {match[1]}
      </strong>,
    );
    start = match.index + match[0].length;
  }
  if (start < content.length) parts.push(content.slice(start));
  return <>{parts.length > 0 ? parts : content}</>;
}

function MessageContent({ content }: { content: string }) {
  const productLink = /(?:\[([^\]]+)\]\s*\(\s*)?(\/products\/[a-zA-Z0-9_-]+)\s*\)?/gi;

  return (
    <div className="space-y-2">
      {content.split('\n').map((line, lineIndex) => {
        const links: Array<{ href: string; label: string }> = [];
        const text = line.replace(productLink, (_match, label: string | undefined, href: string) => {
          links.push({
            href,
            label: label?.replace(/^view\s+/i, '').trim() || 'product',
          });
          return '';
        }).trim();

        if (!text && links.length === 0) {
          return <div key={`space-${lineIndex}`} className="h-1" aria-hidden="true" />;
        }

        return (
          <div key={`line-${lineIndex}`} className="space-y-2">
            {text && <p><InlineText content={text} /></p>}
            {links.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {links.map((link) => (
                  <Link
                    key={`${link.href}-${link.label}`}
                    href={link.href}
                    className="inline-flex items-center rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white! shadow-sm transition hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  >
                    View {link.label}
                    <span aria-hidden="true" className="ml-1">→</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

async function getReply(message: string, history: Message[]) {
  let response: Response;
  try {
    response = await fetch('/api/chatbot/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        history: history.slice(-10).map(({ role, content }) => ({ role, content })),
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    const timedOut = error instanceof DOMException
      && (error.name === 'TimeoutError' || error.name === 'AbortError');
    throw new ChatRequestError(
      timedOut ? 504 : 0,
      timedOut
        ? 'The AI assistant took too long to respond. Please try again.'
        : 'Could not connect to the AI assistant. Check your connection and try again.',
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new ChatRequestError(
      response.status,
      response.status === 404
        ? 'AI chat is not available on this deployment. Please refresh after the chatbot branch is deployed.'
        : 'The AI service returned an invalid response. Please try again later.',
    );
  }

  let data: ChatResponse;
  try {
    data = (await response.json()) as ChatResponse;
  } catch {
    throw new ChatRequestError(response.status, 'The AI service returned an invalid response. Please try again later.');
  }
  if (!response.ok) throw new ChatRequestError(response.status, data.error || 'Unable to generate a reply.');
  return data;
}

export default function ChatWidget({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>(starterMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [signInRequired, setSignInRequired] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const quickPrompts = useMemo(
    () => [
      'Recommend a product',
      'What categories do you have?',
      'I need help with an order',
    ],
    [],
  );
  const hasSentFirstQuestion = messages.some((message) => message.role === 'user');

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    setMessages((current) => [
      ...current,
      { id: Date.now(), role: 'user', content: trimmed },
    ]);
    setInput('');
    setLoading(true);
    setSignInRequired(false);

    try {
      const data = await getReply(trimmed, messages.slice(1));
      setRemaining(data.messagesRemainingToday ?? null);
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: 'assistant',
          content: data.reply || 'I could not generate a reply right now.',
        },
      ]);
    } catch (error) {
      const errorMessage = error instanceof ChatRequestError
        ? error.status === 429
          ? 'AI usage limit reached. Please try again later.'
          : error.message
        : 'The AI assistant encountered an unexpected error. Please try again.';
      setSignInRequired(errorMessage.toLowerCase().includes('sign in'));
      setMessages((current) => [
        ...current,
        { id: Date.now() + 2, role: 'assistant', content: errorMessage, error: true },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-80 flex w-[min(92vw,380px)] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(10,16,42,0.2)]">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-950 px-4 py-3 text-white">
        <div>
          <p className="text-sm font-semibold">Chat with AI</p>
          <p className="text-xs text-slate-300">Product recommendations and support</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-1.5 text-slate-300 transition hover:bg-slate-800 hover:text-white" aria-label="Close chat">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="flex h-105 flex-col bg-slate-50 p-3">
        <div className="mb-3 flex-1 space-y-2 overflow-y-auto rounded-2xl bg-white p-3 shadow-inner">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-6 ${message.role === 'user' ? 'bg-indigo-600 text-white' : message.error ? 'border border-red-200 bg-red-50 text-red-700' : 'border border-slate-200 bg-slate-50 text-slate-700'}`}>
                <MessageContent content={message.content} />
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                <div className="flex items-center gap-1" aria-label="Typing">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {!hasSentFirstQuestion && (
          <div className="mb-3 flex flex-wrap gap-2">
            {quickPrompts.map((prompt) => (
              <button key={prompt} type="button" onClick={() => setInput(prompt)} className="rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600">
                {prompt}
              </button>
            ))}
          </div>
        )}

        {signInRequired && <Link href="/login?next=/" className="mb-3 rounded-xl bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white">Sign in to continue</Link>}
        {remaining !== null && <p className="mb-2 text-center text-[11px] text-slate-500">{remaining} AI messages remaining today</p>}

        <form onSubmit={handleSend} className="rounded-2xl border border-slate-200 bg-white p-2">
          <input value={input} onChange={(event) => setInput(event.target.value)} placeholder={loading ? 'Thinking...' : 'Ask about products or the site...'} disabled={loading} maxLength={2000} className="w-full rounded-xl border border-transparent bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-indigo-300 focus:bg-white" />
          <div className="mt-2 flex justify-end">
            <button type="submit" disabled={loading} className="rounded-full bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white! transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? 'Sending...' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
