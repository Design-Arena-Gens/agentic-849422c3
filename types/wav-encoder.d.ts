declare module 'wav-encoder' {
  export interface EncodeOptions {
    sampleRate: number;
    channelData: Float32Array[];
  }

  export function encode(options: EncodeOptions): Promise<ArrayBuffer>;
}
