"use client";

import { useEffect } from "react";
import { CloseIcon } from "@/components/icons";

export type ToastMessage = { id: number; message: string; tone?: "success" | "error" | "info" };

export function ToastStack({ toasts, dismiss }: { toasts: ToastMessage[]; dismiss: (id: number) => void }) {
  return <div className="toast-stack" aria-live="polite">{toasts.map((toast) => <ToastItem key={toast.id} toast={toast} dismiss={dismiss} />)}</div>;
}

function ToastItem({ toast, dismiss }: { toast: ToastMessage; dismiss: (id: number) => void }) {
  useEffect(() => { const timer = window.setTimeout(() => dismiss(toast.id), 4500); return () => window.clearTimeout(timer); }, [dismiss, toast.id]);
  return <div className={`toast toast-${toast.tone ?? "info"}`}><span>{toast.message}</span><button type="button" onClick={() => dismiss(toast.id)} aria-label="Dismiss notification"><CloseIcon /></button></div>;
}

export function ConfirmDialog({ title, message, confirmLabel = "Delete", busy = false, onCancel, onConfirm }: { title: string; message: string; confirmLabel?: string; busy?: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <><div className="confirmation-backdrop" onClick={busy ? undefined : onCancel} /><section className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title"><p className="eyebrow">Please confirm</p><h2 id="confirmation-title">{title}</h2><p>{message}</p><div><button type="button" onClick={onCancel} disabled={busy}>Cancel</button><button type="button" className="danger-confirm" onClick={onConfirm} disabled={busy}>{busy ? "Working…" : confirmLabel}</button></div></section></>;
}
