"use client";

import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type CallStatus = "idle" | "connecting" | "live" | "error";

function encodePcm16(samples: Float32Array) {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary);
}

function resample(input: Float32Array, inputRate: number, outputRate: number) {
  if (inputRate === outputRate) return input;
  const outputLength = Math.max(1, Math.round(input.length * outputRate / inputRate));
  const output = new Float32Array(outputLength);
  const ratio = inputRate / outputRate;
  for (let index = 0; index < outputLength; index += 1) {
    const position = index * ratio;
    const before = Math.floor(position);
    const after = Math.min(before + 1, input.length - 1);
    const weight = position - before;
    output[index] = input[before] * (1 - weight) + input[after] * weight;
  }
  return output;
}

function decodePcm16(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const view = new DataView(bytes.buffer);
  const samples = new Float32Array(Math.floor(bytes.length / 2));
  for (let index = 0; index < samples.length; index += 1) samples[index] = view.getInt16(index * 2, true) / 0x8000;
  return samples;
}

function VoiceIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"/><path d="M5.5 11.5v.5a6.5 6.5 0 0 0 13 0v-.5M12 18.5V22M8.5 22h7"/></svg>;
}

export function VoiceAssistant() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<CallStatus>("idle");
  const [error, setError] = useState("");
  const [userText, setUserText] = useState("");
  const [assistantText, setAssistantText] = useState("");
  const sessionRef = useRef<Session | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextPlayTimeRef = useRef(0);
  const endingRef = useRef(false);
  const sessionTimerRef = useRef<number | null>(null);

  function clearPlayback() {
    for (const source of sourcesRef.current) {
      try { source.stop(); } catch { /* Source may already be stopped. */ }
    }
    sourcesRef.current.clear();
    nextPlayTimeRef.current = outputContextRef.current?.currentTime ?? 0;
  }

  function playAudio(base64: string) {
    const context = outputContextRef.current;
    if (!context) return;
    const samples = decodePcm16(base64);
    const buffer = context.createBuffer(1, samples.length, 24000);
    buffer.copyToChannel(samples, 0);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    const startAt = Math.max(context.currentTime, nextPlayTimeRef.current);
    source.start(startAt);
    nextPlayTimeRef.current = startAt + buffer.duration;
    sourcesRef.current.add(source);
    source.onended = () => sourcesRef.current.delete(source);
  }

  function handleMessage(message: LiveServerMessage) {
    const content = message.serverContent;
    if (content?.interrupted) clearPlayback();
    if (content?.inputTranscription?.text) setUserText(content.inputTranscription.text);
    if (content?.outputTranscription?.text) setAssistantText((text) => `${text}${content.outputTranscription?.text ?? ""}`);
    for (const part of content?.modelTurn?.parts ?? []) if (part.inlineData?.data) playAudio(part.inlineData.data);
    if (content?.turnComplete) setAssistantText((text) => text.trim());
  }

  async function cleanUp() {
    if (sessionTimerRef.current !== null) window.clearTimeout(sessionTimerRef.current);
    sessionTimerRef.current = null;
    processorRef.current?.disconnect();
    processorRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    clearPlayback();
    await inputContextRef.current?.close().catch(() => undefined);
    await outputContextRef.current?.close().catch(() => undefined);
    inputContextRef.current = null;
    outputContextRef.current = null;
    sessionRef.current?.close();
    sessionRef.current = null;
  }

  async function endCall() {
    endingRef.current = true;
    sessionRef.current?.sendRealtimeInput({ audioStreamEnd: true });
    await cleanUp();
    setStatus("idle");
    endingRef.current = false;
  }

  async function startCall() {
    setStatus("connecting");
    setError("");
    setUserText("");
    setAssistantText("");
    endingRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      streamRef.current = stream;
      const response = await fetch("/api/ai/live-token", { method: "POST" });
      const payload = await response.json() as { token?: string; model?: string; maxSessionMinutes?: number; error?: string };
      if (!response.ok || !payload.token || !payload.model) throw new Error(payload.error ?? "Could not start voice chat.");

      const outputContext = new AudioContext({ sampleRate: 24000 });
      await outputContext.resume();
      outputContextRef.current = outputContext;
      nextPlayTimeRef.current = outputContext.currentTime;

      const ai = new GoogleGenAI({ apiKey: payload.token, httpOptions: { apiVersion: "v1alpha" } });
      const session = await ai.live.connect({
        model: payload.model,
        callbacks: {
          onmessage: handleMessage,
          onerror: (event) => { void cleanUp(); setError(event.message || "The voice connection encountered an error."); setStatus("error"); },
          onclose: () => { if (!endingRef.current) { void cleanUp(); setStatus((current) => current === "connecting" ? "error" : "idle"); } },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      });
      sessionRef.current = session;

      const inputContext = new AudioContext();
      await inputContext.resume();
      inputContextRef.current = inputContext;
      const microphone = inputContext.createMediaStreamSource(stream);
      const processor = inputContext.createScriptProcessor(2048, 1, 1);
      const silentOutput = inputContext.createGain();
      silentOutput.gain.value = 0;
      processor.onaudioprocess = (event) => {
        if (!sessionRef.current) return;
        const samples = resample(event.inputBuffer.getChannelData(0), inputContext.sampleRate, 16000);
        sessionRef.current.sendRealtimeInput({ audio: { data: encodePcm16(samples), mimeType: "audio/pcm;rate=16000" } });
      };
      microphone.connect(processor);
      processor.connect(silentOutput);
      silentOutput.connect(inputContext.destination);
      processorRef.current = processor;
      setStatus("live");
      const sessionMinutes = Math.max(1, payload.maxSessionMinutes ?? 5);
      sessionTimerRef.current = window.setTimeout(() => {
        setError(`Voice calls are limited to ${sessionMinutes} minutes.`);
        void endCall();
      }, sessionMinutes * 60 * 1000);
    } catch (caught) {
      await cleanUp();
      setError(caught instanceof Error ? caught.message : "Could not start voice chat.");
      setStatus("error");
    }
  }

  useEffect(() => () => {
    if (sessionTimerRef.current !== null) window.clearTimeout(sessionTimerRef.current);
    processorRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    for (const source of sourcesRef.current) {
      try { source.stop(); } catch { /* Source may already be stopped. */ }
    }
    void inputContextRef.current?.close();
    void outputContextRef.current?.close();
    sessionRef.current?.close();
  }, []);

  return <div className={`voice-assistant ${open ? "is-open" : ""}`}>
    {open && <section className="voice-panel" role="dialog" aria-label="Codart AI voice assistant">
      <div className="voice-panel-head"><div><span>CODART AI</span><h2>AI Shopping Assistant</h2></div><button type="button" onClick={() => { if (status === "live") void endCall(); setOpen(false); }} aria-label="Close voice assistant">×</button></div>
      <p className="voice-intro">Ask for help choosing products or navigating the store. Your microphone is used only while the call is active.</p>
      <div className={`voice-orb ${status === "live" ? "is-live" : ""}`}><VoiceIcon /></div>
      <p className="voice-status">{status === "connecting" ? "Connecting securely…" : status === "live" ? "Listening — speak naturally" : status === "error" ? "Call unavailable" : "Ready when you are"}</p>
      {(userText || assistantText) && <div className="voice-transcript" aria-live="polite">{userText && <p><strong>You</strong>{userText}</p>}{assistantText && <p><strong>Codart AI</strong>{assistantText}</p>}</div>}
      {error && <p className="voice-error">{error}{error.toLowerCase().includes("sign in") && <> <Link href="/login?next=/">Sign in</Link></>}</p>}
      {status === "live" || status === "connecting" ? <button type="button" className="voice-end" onClick={() => void endCall()} disabled={status === "connecting"}>End call</button> : <button type="button" className="voice-start" onClick={() => void startCall()}>Start voice call</button>}
      <small>Powered by Gemini. AI responses may be inaccurate.</small>
    </section>}
    <button type="button" className="voice-launcher" onClick={() => setOpen((value) => !value)} aria-label={open ? "Close AI voice assistant" : "Open AI voice assistant"} aria-expanded={open}><VoiceIcon /><span>Talk to AI</span></button>
  </div>;
}
