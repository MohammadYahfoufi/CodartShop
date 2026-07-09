import type { Metadata } from 'next';
import { ChatWidget } from '../components/chat-widget';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Codart — Future-ready tech',
    template: '%s — Codart',
  },
  description:
    'Curated technology for better work, play, and everything in between.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="min-h-full">
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
