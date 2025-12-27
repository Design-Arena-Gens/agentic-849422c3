import { NextRequest, NextResponse } from 'next/server';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { pipeline, env } from '@xenova/transformers';
import type {
  AutomaticSpeechRecognitionPipeline,
  TextToSpeechPipeline,
  TranslationPipeline
} from '@xenova/transformers';
import WavEncoder from 'wav-encoder';
import { convertToWav, createInstrumental, mixTracks, normalizeVoice } from '@/lib/audio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

env.allowLocalModels = false;
env.cacheDir = path.join(tmpdir(), 'transformers-cache');

type SupportedLanguage = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt';

const TTS_MODEL: Record<SupportedLanguage, string> = {
  en: 'Xenova/mms-tts-en',
  es: 'Xenova/mms-tts-es',
  fr: 'Xenova/mms-tts-fr',
  de: 'Xenova/mms-tts-de',
  it: 'Xenova/mms-tts-it',
  pt: 'Xenova/mms-tts-pt'
};

const TRANSLATION_LANG: Record<SupportedLanguage, string> = {
  en: 'en',
  es: 'es',
  fr: 'fr',
  de: 'de',
  it: 'it',
  pt: 'pt'
};

let asrPipelinePromise: Promise<AutomaticSpeechRecognitionPipeline> | null = null;
let translationPipelinePromise: Promise<TranslationPipeline> | null = null;
const ttsPipelines = new Map<SupportedLanguage, Promise<TextToSpeechPipeline>>();

const getASR = () => {
  if (!asrPipelinePromise) {
    asrPipelinePromise = pipeline('automatic-speech-recognition', 'Xenova/whisper-small');
  }
  return asrPipelinePromise;
};

const getTranslator = () => {
  if (!translationPipelinePromise) {
    translationPipelinePromise = pipeline('translation', 'Xenova/m2m100_418M');
  }
  return translationPipelinePromise;
};

const getTTS = (language: SupportedLanguage) => {
  if (!ttsPipelines.has(language)) {
    ttsPipelines.set(language, pipeline('text-to-speech', TTS_MODEL[language]));
  }
  return ttsPipelines.get(language)!;
};

const isSupportedLanguage = (input: string): input is SupportedLanguage =>
  Object.prototype.hasOwnProperty.call(TTS_MODEL, input);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio');
    const targetLanguageRaw = formData.get('targetLanguage') ?? 'es';

    if (!(audioFile instanceof File)) {
      return new NextResponse('Missing audio file payload', { status: 400 });
    }

    if (typeof targetLanguageRaw !== 'string' || !isSupportedLanguage(targetLanguageRaw)) {
      return new NextResponse('Unsupported target language', { status: 400 });
    }

    const targetLanguage = targetLanguageRaw;

    const workspace = await mkdtemp(path.join(tmpdir(), 'audio-transform-'));

    try {
      const originalExt = path.extname(audioFile.name) || '.wav';
      const originalPath = path.join(workspace, `original${originalExt}`);
      const wavPath = path.join(workspace, 'original.wav');
      const instrumentalPath = path.join(workspace, 'instrumental.wav');
      const voicePath = path.join(workspace, 'voice.wav');
      const voiceProcessedPath = path.join(workspace, 'voice-processed.wav');
      const mixPath = path.join(workspace, 'mix.mp3');

      const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
      await writeFile(originalPath, audioBuffer);

      await convertToWav(originalPath, wavPath);
      await createInstrumental(wavPath, instrumentalPath);

      const asr = await getASR();
      const asrResult = (await asr(wavPath, {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: false
      })) as { text?: string; language?: string } | string;

      const transcriptText =
        typeof asrResult === 'string'
          ? asrResult
          : typeof asrResult.text === 'string'
            ? asrResult.text
            : '';

      if (!transcriptText) {
        throw new Error('Unable to derive transcript from audio.');
      }

      const detectedLanguage = (typeof asrResult === 'object' && asrResult?.language) as
        | SupportedLanguage
        | undefined;

      const translator = await getTranslator();
      const translationResult = (await translator(transcriptText, {
        src_lang:
          detectedLanguage && isSupportedLanguage(detectedLanguage)
            ? TRANSLATION_LANG[detectedLanguage]
            : TRANSLATION_LANG.en,
        tgt_lang: TRANSLATION_LANG[targetLanguage]
      })) as
        | string
        | { translation_text?: string }
        | Array<{ translation_text?: string } | string>;

      const translatedText = Array.isArray(translationResult)
        ? typeof translationResult[0] === 'string'
          ? translationResult[0]
          : translationResult[0]?.translation_text ?? ''
        : typeof translationResult === 'string'
          ? translationResult
          : translationResult?.translation_text ?? '';

      if (!translatedText) {
        throw new Error('Translation failed to produce output.');
      }

      const tts = await getTTS(targetLanguage);
      const ttsResult = (await tts(translatedText)) as {
        audio: Float32Array | Float32Array[];
        sampling_rate: number;
      };
      const sampleRate = ttsResult.sampling_rate;
      const audioData = ttsResult.audio;
      const channelData = (Array.isArray(audioData) ? audioData : [audioData]).map((channel) =>
        channel instanceof Float32Array ? channel : new Float32Array(channel)
      );

      const wavArrayBuffer = await WavEncoder.encode({
        sampleRate,
        channelData
      });

      await writeFile(voicePath, Buffer.from(wavArrayBuffer));
      await normalizeVoice(voicePath, voiceProcessedPath);

      await mixTracks(instrumentalPath, voiceProcessedPath, mixPath);

      const output = await readFile(mixPath);

      return new NextResponse(output, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Disposition': 'attachment; filename="translated-mix.mp3"'
        }
      });
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  } catch (error) {
    console.error(error);
    return new NextResponse('Failed to process audio', { status: 500 });
  }
}
