'use client';

import { useState } from 'react';

const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' }
];

type StatusStep =
  | 'idle'
  | 'uploading'
  | 'transcribing'
  | 'translating'
  | 'synthesizing'
  | 'mixing'
  | 'completed'
  | 'error';

const STATUS_LABELS: Record<StatusStep, string> = {
  idle: 'Waiting for upload…',
  uploading: 'Uploading audio…',
  transcribing: 'Transcribing speech…',
  translating: 'Translating transcript…',
  synthesizing: 'Generating new narration…',
  mixing: 'Rebuilding soundtrack…',
  completed: 'Done!',
  error: 'Something went wrong. Please try again.'
};

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState('es');
  const [status, setStatus] = useState<StatusStep>('idle');
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      alert('Please select an audio file first.');
      return;
    }

    setStatus('uploading');
    setProgress(0.1);
    setDownloadUrl(null);

    const timeline: StatusStep[] = [
      'transcribing',
      'translating',
      'synthesizing',
      'mixing'
    ];
    const timeouts: Array<ReturnType<typeof setTimeout>> = [];
    timeline.forEach((step, index) => {
      const timeout = setTimeout(() => {
        setStatus(step);
        setProgress(0.2 + index * 0.2);
      }, (index + 1) * 5000);
      timeouts.push(timeout);
    });

    try {
      const formData = new FormData();
      formData.append('audio', file);
      formData.append('targetLanguage', language);

      const response = await fetch('/api/process-audio', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const reader = response.body?.getReader();
      const chunks: BlobPart[] = [];
      if (!reader) {
        throw new Error('Unable to read response stream.');
      }

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          const chunk = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
          chunks.push(chunk);
        }
      }

      const blob = new Blob(chunks, { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setStatus('completed');
      setProgress(1);
    } catch (error) {
      console.error(error);
      setStatus('error');
    } finally {
      timeouts.forEach(clearTimeout);
    }
  };

  return (
    <div className="form-card flex flex-col gap-8">
      <form
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <section className="flex flex-col gap-3">
          <label className="text-sm font-medium text-slate-200" htmlFor="audio">
            Audio File
          </label>
          <input
            id="audio"
            type="file"
            accept="audio/*"
            required
            onChange={(event) => {
              const selected = event.target.files?.[0] ?? null;
              setFile(selected);
              setStatus('idle');
              setProgress(0);
              setDownloadUrl(null);
            }}
            className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 shadow-inner"
          />
          <p className="text-xs text-slate-400">
            Works best with stereo files (mp3, wav, ogg). Maximum size 20MB recommended.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <label className="text-sm font-medium text-slate-200" htmlFor="language">
            Target Language
          </label>
          <select
            id="language"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 shadow-inner"
          >
            {SUPPORTED_LANGUAGES.map((entry) => (
              <option key={entry.code} value={entry.code}>
                {entry.label}
              </option>
            ))}
          </select>
        </section>

        <button
          type="submit"
          className="rounded-md bg-sky-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!file || status === 'uploading'}
        >
          Transform Audio
        </button>
      </form>

      <aside className="flex flex-col gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</p>
          <p className="text-sm text-slate-200">{STATUS_LABELS[status]}</p>
        </div>
        <div className="progress">
          <span style={{ transform: `scaleX(${progress})` }} />
        </div>
      </aside>

      {downloadUrl && (
        <section className="result-card flex flex-col gap-3">
          <p className="text-sm font-medium text-slate-100">Translated Mix</p>
          <audio controls src={downloadUrl} className="w-full" />
          <a
            href={downloadUrl}
            download="translated-audio.mp3"
            className="inline-flex w-fit items-center gap-2 rounded-md border border-sky-500 px-4 py-2 text-sm text-sky-300 transition hover:border-sky-300 hover:text-sky-100"
          >
            Download File
          </a>
        </section>
      )}
    </div>
  );
}
