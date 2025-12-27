import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Audio Language Transformer',
  description: 'Change spoken language in audio without losing background music.'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-6 py-16">
          <header className="flex flex-col gap-4 text-center">
            <h1 className="text-3xl font-semibold">Audio Language Transformer</h1>
            <p className="text-sm text-slate-300">
              Upload an audio file, choose a target language, and receive a translated version while
              preserving the original background music.
            </p>
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
