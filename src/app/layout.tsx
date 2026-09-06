import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Aerchain QuoteEngine | Autonomous RFx Normalization & Interrogation',
  description: 'Enterprise Procurement Evaluation Tool for Corrugated Packaging',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Mina:wght@400;700&family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-h-screen bg-slate-950 text-slate-50 font-sans">
        {children}
      </body>
    </html>
  );
}
