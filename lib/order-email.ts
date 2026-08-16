import "server-only";
import type { CheckoutDetails, OrderReceipt } from "@/lib/types";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export async function sendOrderReceivedEmail(details: CheckoutDetails, receipt: OrderReceipt) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.ORDER_FROM_EMAIL?.trim();
  if (!apiKey || !from || !details.email) return { sent: false, reason: "not-configured" as const };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [details.email],
      subject: `We received your Codart order #${receipt.id.slice(0, 8).toUpperCase()}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#111327"><div style="background:#101945;padding:28px;color:white"><h1 style="margin:0">Order received.</h1></div><div style="padding:30px;border:1px solid #e2e5ef"><p>Hi ${escapeHtml(details.name)},</p><p>We received order <strong>#${receipt.id.slice(0, 8).toUpperCase()}</strong> and will confirm it with you shortly.</p><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px 0;color:#686b80">Subtotal</td><td style="text-align:right">$${receipt.subtotal.toFixed(2)}</td></tr><tr><td style="padding:8px 0;color:#686b80">Delivery</td><td style="text-align:right">$${receipt.deliveryFee.toFixed(2)}</td></tr><tr><td style="padding:12px 0;border-top:1px solid #e2e5ef"><strong>Total</strong></td><td style="text-align:right;border-top:1px solid #e2e5ef"><strong>$${receipt.total.toFixed(2)}</strong></td></tr></table><p style="color:#686b80;font-size:13px">Delivery to: ${escapeHtml(details.address)}</p></div></div>`,
    }),
  });
  if (!response.ok) throw new Error(`Receipt email failed with status ${response.status}.`);
  return { sent: true };
}
