declare module '@xenova/transformers' {
  export const env: {
    cacheDir?: string;
    allowLocalModels?: boolean;
    [key: string]: unknown;
  };

  export type PipelineReturn = (input: string | Uint8Array | Float32Array | string[], options?: Record<string, unknown>) => Promise<unknown>;

  export function pipeline(task: string, model: string): Promise<PipelineReturn>;

  export type AutomaticSpeechRecognitionPipeline = PipelineReturn;
  export type TranslationPipeline = PipelineReturn;
  export type TextToSpeechPipeline = PipelineReturn;
}
