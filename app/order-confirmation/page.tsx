import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = { title: "Order received" };

export default async function OrderConfirmationPage({ searchParams }: { searchParams: Promise<{ order?: string; total?: string }> }) {
  const parameters = await searchParams;
  const order = String(parameters.order ?? "").slice(0, 36);
  const total = Number(parameters.total);
  return <main className="confirmation-page"><section className="confirmation-card"><Link href="/" className="account-logo"><Image src="/codart-logo.png" alt="Codart" width={512} height={512} priority /></Link><span className="confirmation-check" aria-hidden="true">✓</span><p className="eyebrow">Order received</p><h1>Thank you.</h1><p>Your order has been saved and your WhatsApp conversation should now be open. We’ll confirm availability, delivery, and payment with you directly.</p>{order && <div className="confirmation-receipt"><span>Order number <strong>#{order.slice(0, 8).toUpperCase()}</strong></span>{Number.isFinite(total) && <span>Total <strong>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(total)}</strong></span>}</div>}<p className="confirmation-email">If you entered an email and receipt delivery is configured, a confirmation is on its way.</p><Link className="account-primary" href="/account">View your account</Link><Link className="auth-back" href="/">Continue shopping</Link></section></main>;
}
