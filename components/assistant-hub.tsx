'use client';

import { useState } from 'react';
import ChatWidget from '@/components/chat-widget';
import { VoiceAssistant } from '@/components/voice-assistant';

type AssistantMode = 'closed' | 'menu' | 'chat' | 'voice';

function ChatIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6.5h14v10H9l-4 3v-13Z" /><path d="M8.5 10h7M8.5 13h4.5" /></svg>;
}

function VoiceIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" /><path d="M5.5 11.5v.5a6.5 6.5 0 0 0 13 0v-.5M12 18.5V22M8.5 22h7" /></svg>;
}

function SparkIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 1.7 5.3L19 9l-5.3 1.7L12 16l-1.7-5.3L5 9l5.3-1.7L12 2Z" /><path d="m18.5 15 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" /></svg>;
}

export function AssistantHub() {
  const [mode, setMode] = useState<AssistantMode>('closed');

  if (mode === 'chat') return <ChatWidget onClose={() => setMode('closed')} />;
  if (mode === 'voice') return <VoiceAssistant onClose={() => setMode('closed')} />;

  const menuOpen = mode === 'menu';
  return (
    <div className="ai-hub">
      {menuOpen && (
        <section className="ai-hub-menu" role="dialog" aria-label="Choose AI assistant mode">
          <div className="ai-hub-menu-head">
            <div><span>CODART AI</span><h2>How can I help?</h2></div>
            <button type="button" onClick={() => setMode('closed')} aria-label="Close AI menu">×</button>
          </div>
          <p>Choose how you would like to speak with the shopping assistant.</p>
          <button type="button" className="ai-mode-card" onClick={() => setMode('chat')}>
            <i><ChatIcon /></i><span><strong>Chat with AI</strong><small>Type questions and get product help</small></span><b>→</b>
          </button>
          <button type="button" className="ai-mode-card" onClick={() => setMode('voice')}>
            <i><VoiceIcon /></i><span><strong>Talk to AI</strong><small>Have a live voice conversation</small></span><b>→</b>
          </button>
          <small className="ai-hub-note">Sign-in and daily usage limits protect availability for everyone.</small>
        </section>
      )}
      <button type="button" className="voice-launcher ai-hub-launcher" onClick={() => setMode(menuOpen ? 'closed' : 'menu')} aria-label={menuOpen ? 'Close AI options' : 'Open AI assistant'} aria-expanded={menuOpen}>
        {menuOpen ? <span className="ai-hub-close">×</span> : <SparkIcon />}
        <span>{menuOpen ? 'Close' : 'Ask AI'}</span>
      </button>
    </div>
  );
}
