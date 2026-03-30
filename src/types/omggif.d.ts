declare module 'omggif' {
  export class GifReader {
    constructor(buf: Buffer | Uint8Array);
    width: number;
    height: number;
    numFrames(): number;
    frameInfo(frame_num: number): { width: number; height: number; delay: number };
    decodeAndBlitFrameBGRA(frame_num: number, pixels: Uint8Array): void;
    decodeAndBlitFrameRGBA(frame_num: number, pixels: Uint8Array): void;
  }

  export class GifWriter {
    constructor(buf: Buffer | Uint8Array, width: number, height: number, gopts?: { loop?: number });
    addFrame(x: number, y: number, width: number, height: number, data: Uint8Array, opts?: { delay?: number; palette?: number[] }): number;
    end(): number;
  }
}