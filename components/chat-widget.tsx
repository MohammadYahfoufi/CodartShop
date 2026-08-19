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
    content: "Hi, I'm Codart AI. What can I help you find today?",
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

function MessageContent({ content, onProductOpen }: { content: string; onProductOpen: () => void }) {
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
        const isBullet = /^[-*]\s+/.test(text);
        const cleanText = text.replace(/^[-*]\s+/, '');

        if (!text && links.length === 0) {
          return <div key={`space-${lineIndex}`} className="h-1" aria-hidden="true" />;
        }

        return (
          <div key={`line-${lineIndex}`} className="space-y-2">
            {cleanText && (
              <p className={isBullet ? 'flex gap-2' : undefined}>
                {isBullet && <span className="mt-[0.65em] h-1 w-1 shrink-0 rounded-full bg-indigo-400" aria-hidden="true" />}
                <span><InlineText content={cleanText} /></span>
              </p>
            )}
            {links.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {links.map((link) => (
                  <Link
                    key={`${link.href}-${link.label}`}
                    href={link.href}
                    onClick={onProductOpen}
                    className="group inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white! shadow-sm transition hover:-translate-y-0.5 hover:bg-indigo-600 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  >
                    View {link.label}
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
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

  async function sendMessage(message: string) {
    const trimmed = message.trim();
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

  function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <section className="codart-chat-panel fixed bottom-4 right-4 z-80 flex h-[min(620px,calc(100dvh-32px))] w-[min(calc(100vw-32px),400px)] flex-col overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.22)] sm:bottom-6 sm:right-6" role="dialog" aria-label="Chat with Codart AI">
      <header className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-600 to-slate-900 text-white shadow-[0_8px_20px_rgba(79,70,229,0.25)]">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z" strokeLinejoin="round" />
              <path d="m18.5 15 .7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z" strokeLinejoin="round" />
            </svg>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" aria-label="Online" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-bold tracking-tight text-slate-950">Codart AI</h2>
              <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-indigo-600">Beta</span>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">Shopping help, usually in seconds</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600" aria-label="Close chat">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col bg-[#f7f8fc]">
        <div className="codart-chat-scroll flex-1 space-y-4 overflow-y-auto px-3 py-5 sm:px-4" role="log" aria-live="polite">
          {messages.map((message) => (
            <div key={message.id} className={`codart-chat-message flex items-end gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.role === 'assistant' && (
                <div className={`mb-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-xl ${message.error ? 'bg-red-100 text-red-600' : 'bg-slate-900 text-white'}`} aria-hidden="true">
                  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m10 2.5 1.2 3.7L15 7.5l-3.8 1.3L10 12.5 8.8 8.8 5 7.5l3.8-1.3L10 2.5Z" strokeLinejoin="round" /></svg>
                </div>
              )}
              <div className={`max-w-[82%] whitespace-pre-wrap px-3.5 py-2.5 text-[13px] leading-[1.6] shadow-sm ${message.role === 'user' ? 'rounded-[18px] rounded-br-md bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-indigo-200' : message.error ? 'rounded-[18px] rounded-bl-md border border-red-200 bg-red-50 text-red-700' : 'rounded-[18px] rounded-bl-md border border-slate-200/80 bg-white text-slate-700'}`}>
                <MessageContent content={message.content} onProductOpen={onClose} />
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-end gap-2 justify-start">
              <div className="mb-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-slate-900 text-white" aria-hidden="true">
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m10 2.5 1.2 3.7L15 7.5l-3.8 1.3L10 12.5 8.8 8.8 5 7.5l3.8-1.3L10 2.5Z" strokeLinejoin="round" /></svg>
              </div>
              <div className="rounded-[18px] rounded-bl-md border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center gap-1.5" aria-label="Codart AI is typing">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {!hasSentFirstQuestion && (
          <div className="flex gap-2 overflow-x-auto border-t border-slate-100 bg-white px-3 py-3 sm:px-4">
            {quickPrompts.map((prompt) => (
              <button key={prompt} type="button" onClick={() => void sendMessage(prompt)} disabled={loading} className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50">
                {prompt}
              </button>
            ))}
          </div>
        )}

        <footer className="border-t border-slate-100 bg-white px-3 pb-3 pt-2.5 sm:px-4">
          {signInRequired && <Link href="/login?next=/" className="mb-2.5 flex items-center justify-center rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white! transition hover:bg-indigo-500">Sign in to continue</Link>}
          <form onSubmit={handleSend} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5 pl-3 transition focus-within:border-indigo-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-50">
            <label htmlFor="codart-chat-input" className="sr-only">Message Codart AI</label>
            <input id="codart-chat-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder={loading ? 'Codart AI is thinking...' : 'Message Codart AI...'} disabled={loading} maxLength={2000} autoComplete="off" className="min-w-0 flex-1 border-0 bg-transparent py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400" />
            <button type="submit" disabled={loading || !input.trim()} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-900 text-white! shadow-sm transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400!" aria-label="Send message">
              {loading ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m4 4 12 6-12 6 2-6-2-6Z" strokeLinecap="round" strokeLinejoin="round" /><path d="M6 10h10" strokeLinecap="round" /></svg>
              )}
            </button>
          </form>
          <p className="mt-2 text-center text-[10px] text-slate-400">
            {remaining !== null ? `${remaining} messages left today` : 'AI can make mistakes. Check important details.'}
          </p>
        </footer>
      </div>
    </section>
  );
}
