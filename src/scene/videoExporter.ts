import { ArrayBufferTarget, Muxer } from 'mp4-muxer';

export interface ExportVideoOptions {
  canvas: HTMLCanvasElement;
  viewportWidth: number;
  viewportHeight: number;
  durationSec?: number;
  fps?: number;
  filenameBase: string;
  beginExportViewport: (width: number, height: number) => void;
  renderDeterministicFrame: (u: number, dt: number) => void;
  restoreViewport: () => void;
  renderOfflineAudio: (durationSec: number, sampleRate?: number) => Promise<AudioBuffer | null>;
  getLiveAudioTrack: () => MediaStreamTrack | null;
  onProgress?: (pct: number) => void;
  onStatus?: (msg: string) => void;
  isCancelled: () => boolean;
}

interface ResolvedVideoPreset {
  width: number;
  height: number;
  codec: string;
  bitrate: number;
}

const DEFAULT_FPS = 30;
const DEFAULT_DURATION_SEC = 4.5;

const WEBCODECS_AVC_PROFILES = [
  'avc1.640033', // H.264 High Profile Level 5.1 (up to 4K)
  'avc1.640032', // H.264 High Profile Level 5.0 (QHD / 1440p+)
  'avc1.4d4032', // H.264 Main Profile Level 5.0
  'avc1.42002a', // H.264 Baseline Level 4.2 (1080p fallback)
];

/** Computes macroblock-aligned (multiple of 16) HD/QHD export dimensions matching viewport aspect. */
export function computeExportDimensions(
  viewportWidth: number,
  viewportHeight: number,
  targetShort = 1440,
  targetLong = 1920,
  maxLong = 2560
): { width: number; height: number } {
  const safeW = Math.max(16, viewportWidth);
  const safeH = Math.max(16, viewportHeight);
  const shortSide = Math.min(safeW, safeH);
  const longSide = Math.max(safeW, safeH);
  const scale = Math.min(maxLong / longSide, Math.max(targetShort / shortSide, targetLong / longSide));
  const round16 = (v: number) => Math.max(16, Math.round(v / 16) * 16);
  return {
    width: round16(safeW * scale),
    height: round16(safeH * scale),
  };
}

function yieldForUiPaint(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
    } else {
      window.setTimeout(resolve, 0);
    }
  });
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function resolveSupportedVideoPreset(
  viewportWidth: number,
  viewportHeight: number,
  fps: number
): Promise<ResolvedVideoPreset | null> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
    return null;
  }

  const tiers = [
    { ...computeExportDimensions(viewportWidth, viewportHeight, 1440, 1920, 2560), bitrate: 24_000_000 },
    { ...computeExportDimensions(viewportWidth, viewportHeight, 1080, 1920, 1920), bitrate: 18_000_000 },
  ];

  for (const tier of tiers) {
    for (const codec of WEBCODECS_AVC_PROFILES) {
      try {
        const res = await VideoEncoder.isConfigSupported({
          codec,
          width: tier.width,
          height: tier.height,
          bitrate: tier.bitrate,
          framerate: fps,
          latencyMode: 'quality',
        });
        if (res.supported) {
          return { width: tier.width, height: tier.height, codec, bitrate: tier.bitrate };
        }
      } catch {
        // try next profile
      }
    }
  }
  return null;
}

async function encodeOfflineAudioBuffer(
  audioBuffer: AudioBuffer,
  muxer: Muxer<ArrayBufferTarget>
): Promise<void> {
  if (typeof AudioEncoder === 'undefined' || typeof AudioData === 'undefined') return;

  const sampleRate = audioBuffer.sampleRate;
  const numberOfChannels = Math.min(2, audioBuffer.numberOfChannels);
  const audioConfig: AudioEncoderConfig = {
    codec: 'mp4a.40.2',
    sampleRate,
    numberOfChannels,
    bitrate: 192_000,
  };

  let encodeError: unknown = null;
  const encoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (err) => {
      encodeError = err;
    },
  });
  encoder.configure(audioConfig);

  const ch0 = audioBuffer.getChannelData(0);
  const ch1 = numberOfChannels > 1 ? audioBuffer.getChannelData(1) : ch0;
  const chunkFrames = 4096;

  for (let offset = 0; offset < audioBuffer.length; offset += chunkFrames) {
    if (encodeError) break;
    const frames = Math.min(chunkFrames, audioBuffer.length - offset);
    const planar = new Float32Array(frames * numberOfChannels);
    planar.set(ch0.subarray(offset, offset + frames), 0);
    if (numberOfChannels > 1) {
      planar.set(ch1.subarray(offset, offset + frames), frames);
    }
    const audioData = new AudioData({
      format: 'f32-planar',
      sampleRate,
      numberOfFrames: frames,
      numberOfChannels,
      timestamp: Math.round((offset / sampleRate) * 1_000_000),
      data: planar,
    });
    encoder.encode(audioData);
    audioData.close();
  }

  await encoder.flush();
  encoder.close();
}

async function exportViaWebCodecsMp4(
  opts: ExportVideoOptions,
  preset: ResolvedVideoPreset,
  fps: number,
  durationSec: number
): Promise<boolean> {
  let audioBuffer: AudioBuffer | null = null;
  let hasAacSupport = false;
  if (typeof AudioEncoder !== 'undefined' && typeof AudioData !== 'undefined') {
    try {
      const aacCheck = await AudioEncoder.isConfigSupported({
        codec: 'mp4a.40.2',
        sampleRate: 48000,
        numberOfChannels: 2,
        bitrate: 192_000,
      });
      hasAacSupport = Boolean(aacCheck.supported);
    } catch {
      hasAacSupport = false;
    }
  }

  if (hasAacSupport) {
    audioBuffer = await opts.renderOfflineAudio(durationSec, 48000);
  }

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    fastStart: 'in-memory',
    video: {
      codec: 'avc',
      width: preset.width,
      height: preset.height,
      frameRate: fps,
    },
    ...(audioBuffer
      ? {
          audio: {
            codec: 'aac',
            numberOfChannels: Math.min(2, audioBuffer.numberOfChannels),
            sampleRate: audioBuffer.sampleRate,
          },
        }
      : {}),
  });

  let encodeError: unknown = null;
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (err) => {
      encodeError = err;
    },
  });

  videoEncoder.configure({
    codec: preset.codec,
    width: preset.width,
    height: preset.height,
    bitrate: preset.bitrate,
    framerate: fps,
    latencyMode: 'quality',
  });

  opts.onStatus?.(`Rendering ${preset.width}x${preset.height} HD showcase video...`);
  opts.beginExportViewport(preset.width, preset.height);

  try {
    const totalFrames = Math.max(2, Math.round(durationSec * fps));
    const dt = 1 / fps;
    const frameDurationUs = Math.round(1_000_000 / fps);

    for (let i = 0; i < totalFrames; i++) {
      if (opts.isCancelled()) return false;
      if (encodeError) throw encodeError;

      const u = i / (totalFrames - 1);
      opts.renderDeterministicFrame(u, dt);

      const frame = new VideoFrame(opts.canvas, {
        timestamp: i * frameDurationUs,
        duration: frameDurationUs,
      });
      videoEncoder.encode(frame, { keyFrame: i % fps === 0 });
      frame.close();

      while (videoEncoder.encodeQueueSize >= 4 && !opts.isCancelled() && !encodeError) {
        await new Promise((r) => window.setTimeout(r, 8));
      }

      opts.onProgress?.(Math.min(96, Math.round(((i + 1) / totalFrames) * 95)));
      await yieldForUiPaint();
    }

    if (opts.isCancelled()) return false;
    if (encodeError) throw encodeError;

    if (audioBuffer) {
      await encodeOfflineAudioBuffer(audioBuffer, muxer);
    }

    await videoEncoder.flush();
    muxer.finalize();

    const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
    triggerBlobDownload(blob, `${opts.filenameBase}.mp4`);
    opts.onProgress?.(100);
    opts.onStatus?.(`Saved ${preset.width}x${preset.height} holiday card MP4.`);
    return true;
  } finally {
    try {
      if (videoEncoder.state !== 'closed') videoEncoder.close();
    } catch {
      // ignore already closed encoder
    }
    opts.restoreViewport();
  }
}

async function exportViaHighResMediaRecorder(
  opts: ExportVideoOptions,
  fps: number,
  durationSec: number
): Promise<boolean> {
  if (typeof MediaRecorder === 'undefined' || typeof opts.canvas.captureStream !== 'function') {
    opts.onStatus?.('Video export is not supported in this browser.');
    return false;
  }

  const size = computeExportDimensions(opts.viewportWidth, opts.viewportHeight, 1080, 1920, 1920);
  const mimeCandidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp9',
    'video/mp4;codecs=avc1.640032,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  const chosenMime = mimeCandidates.find((m) => {
    try {
      return MediaRecorder.isTypeSupported(m);
    } catch {
      return false;
    }
  });

  opts.beginExportViewport(size.width, size.height);
  const canvasStream = opts.canvas.captureStream(fps);
  const audioTrack = opts.getLiveAudioTrack();
  const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];
  if (audioTrack) tracks.push(audioTrack);
  const combinedStream = new MediaStream(tracks);

  const recorder = chosenMime
    ? new MediaRecorder(combinedStream, { mimeType: chosenMime, videoBitsPerSecond: 20_000_000 })
    : new MediaRecorder(combinedStream, { videoBitsPerSecond: 20_000_000 });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) chunks.push(ev.data);
  };

  try {
    return await new Promise<boolean>((resolve) => {
      let stopped = false;
      const startMs = performance.now();
      const durationMs = durationSec * 1000;

      recorder.onstop = () => {
        canvasStream.getTracks().forEach((t) => t.stop());
        if (!opts.isCancelled() && chunks.length > 0) {
          const actualMime = recorder.mimeType || chosenMime || 'video/webm';
          const ext = actualMime.includes('mp4') ? 'mp4' : 'webm';
          const blob = new Blob(chunks, { type: actualMime });
          triggerBlobDownload(blob, `${opts.filenameBase}.${ext}`);
          opts.onProgress?.(100);
          opts.onStatus?.(`Saved ${size.width}x${size.height} holiday card video.`);
          resolve(true);
        } else {
          resolve(false);
        }
      };

      recorder.onerror = () => {
        stopped = true;
        canvasStream.getTracks().forEach((t) => t.stop());
        opts.onStatus?.('Could not export video.');
        resolve(false);
      };

      opts.onStatus?.(`Recording ${size.width}x${size.height} showcase video...`);
      recorder.start(500);

      let prevMs = startMs;
      const tick = (nowMs: number) => {
        if (stopped || opts.isCancelled()) {
          if (recorder.state === 'recording') {
            try {
              recorder.stop();
            } catch {
              // ignore
            }
          }
          return;
        }
        const dt = Math.min(0.05, Math.max(0.001, (nowMs - prevMs) * 0.001));
        prevMs = nowMs;
        const u = Math.min(1, Math.max(0, (nowMs - startMs) / durationMs));
        opts.renderDeterministicFrame(u, dt);
        opts.onProgress?.(Math.min(99, Math.round(u * 100)));
        if (u >= 1) {
          stopped = true;
          if (recorder.state === 'recording') recorder.stop();
        } else {
          requestAnimationFrame(tick);
        }
      };

      requestAnimationFrame(tick);
    });
  } finally {
    opts.restoreViewport();
  }
}

/**
 * Exports a studio-sharp HD/QHD 360-degree turntable video of the decorated holiday card.
 * Prefers deterministic WebCodecs High-Profile MP4 (zero dropped frames, 24 Mbps, synced AAC audio)
 * and falls back cleanly to high-bitrate MediaRecorder when WebCodecs is unavailable.
 */
export async function exportHighResShowcaseVideo(opts: ExportVideoOptions): Promise<boolean> {
  const fps = opts.fps ?? DEFAULT_FPS;
  const durationSec = opts.durationSec ?? DEFAULT_DURATION_SEC;

  const preset = await resolveSupportedVideoPreset(opts.viewportWidth, opts.viewportHeight, fps);
  if (preset) {
    try {
      const ok = await exportViaWebCodecsMp4(opts, preset, fps, durationSec);
      if (ok || opts.isCancelled()) return ok;
    } catch {
      // fall through to high-res MediaRecorder fallback
    }
  }

  return exportViaHighResMediaRecorder(opts, fps, durationSec);
}
