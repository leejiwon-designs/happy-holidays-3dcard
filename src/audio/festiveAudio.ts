import type { OrnamentId } from '../types/card';

// Warm 72 BPM Festive Jazz-Lo-Fi Chord Progression:
// Cmaj9 -> Am9 -> Dm9 -> G13 -> Fmaj9 -> Fm6 -> Em7 -> A7sus/G13
const FESTIVE_LOFI_CHORDS: Array<{ bass: number; tones: number[] }> = [
  { bass: 65.41, tones: [130.81, 164.81, 196.0, 246.94, 293.66] }, // Cmaj9 (steps 0..15)
  { bass: 55.0, tones: [110.0, 164.81, 196.0, 246.94, 261.63] },  // Am9   (steps 16..31)
  { bass: 73.42, tones: [146.83, 174.61, 220.0, 261.63, 329.63] }, // Dm9   (steps 32..47)
  { bass: 98.0, tones: [196.0, 246.94, 293.66, 329.63, 440.0] },  // G13   (steps 48..55)
  { bass: 87.31, tones: [174.61, 220.0, 261.63, 329.63, 392.0] },  // Fmaj9 (steps 56..63)
  { bass: 87.31, tones: [174.61, 207.65, 261.63, 293.66, 392.0] }, // Fm6   (steps 64..71)
  { bass: 82.41, tones: [164.81, 196.0, 246.94, 293.66, 392.0] },  // Em7   (steps 72..79)
  { bass: 98.0, tones: [196.0, 261.63, 293.66, 349.23, 440.0] },  // G9sus (steps 80..95)
];

// Cozy winter celesta / sleigh-bell pentatonic notes
const HOLIDAY_SPARKLES_HZ = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66];

interface MusicSynthBus {
  ctx: BaseAudioContext;
  gain: GainNode;
  echo: DelayNode | null;
  noiseBuffer: AudioBuffer | null;
}

export class FestiveAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private mediaDest: MediaStreamAudioDestinationNode | null = null;
  private sfxGain: GainNode | null = null;
  private delayNode: DelayNode | null = null;

  private musicGain: GainNode | null = null;
  private musicEchoNode: DelayNode | null = null;
  private musicCrackleSource: AudioBufferSourceNode | null = null;
  private musicNoiseBuffer: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private musicNextStepTime = 0;
  private musicStep = 0;

  private soundEnabled = true;
  private musicEnabled = true;
  private musicVolume = 0.78;
  private hasStartedMusicOnce = false;

  private getEffectiveMusicGain(): number {
    if (!this.musicEnabled || this.musicVolume <= 0) return 0.0;
    return Math.pow(this.musicVolume, 1.2) * 0.92;
  }

  public unlock(startMusicIfEnabled = true): void {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.95;

      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.value = -12;
      compressor.knee.value = 18;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.005;
      compressor.release.value = 0.16;

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.soundEnabled ? 1.0 : 0.0;

      this.delayNode = this.ctx.createDelay(0.5);
      this.delayNode.delayTime.value = 0.16;
      const delayFeedback = this.ctx.createGain();
      delayFeedback.gain.value = 0.22;
      const delayFilter = this.ctx.createBiquadFilter();
      delayFilter.type = 'lowpass';
      delayFilter.frequency.value = 2800;

      this.sfxGain.connect(compressor);
      this.sfxGain.connect(this.delayNode);
      this.delayNode.connect(delayFilter);
      delayFilter.connect(delayFeedback);
      delayFeedback.connect(this.delayNode);
      delayFilter.connect(compressor);

      // Festive Lo-Fi Music Bus + Warm Tape Delay
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.0;
      this.musicGain.connect(compressor);

      this.musicEchoNode = this.ctx.createDelay(0.6);
      this.musicEchoNode.delayTime.value = 0.36;
      const musicEchoFb = this.ctx.createGain();
      musicEchoFb.gain.value = 0.26;
      const musicEchoFilter = this.ctx.createBiquadFilter();
      musicEchoFilter.type = 'lowpass';
      musicEchoFilter.frequency.value = 1400;
      this.musicEchoNode.connect(musicEchoFilter);
      musicEchoFilter.connect(musicEchoFb);
      musicEchoFb.connect(this.musicEchoNode);
      musicEchoFilter.connect(this.musicGain);

      compressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      if (typeof this.ctx.createMediaStreamDestination === 'function') {
        this.mediaDest = this.ctx.createMediaStreamDestination();
        this.masterGain.connect(this.mediaDest);
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    if (startMusicIfEnabled && this.musicEnabled && this.ctx && this.musicTimer === null) {
      this.hasStartedMusicOnce = true;
      this.startMusicLoop();
    }
  }

  public getRecordableAudioTrack(): MediaStreamTrack | null {
    if (!this.ctx || this.ctx.state !== 'running' || !this.mediaDest) return null;
    if (!this.musicEnabled && !this.soundEnabled) return null;
    return this.mediaDest.stream.getAudioTracks()[0] ?? null;
  }

  public setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(enabled ? 1.0 : 0.0, this.ctx.currentTime, 0.03);
    }
  }

  public setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    if (enabled) {
      this.unlock(true);
      if (this.ctx && this.musicTimer === null) {
        this.startMusicLoop();
      } else if (this.ctx && this.musicGain) {
        this.musicGain.gain.setTargetAtTime(this.getEffectiveMusicGain(), this.ctx.currentTime, 0.25);
      }
    } else {
      this.stopMusicLoop();
    }
  }

  public setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.musicVolume > 0 && !this.musicEnabled) {
      this.musicEnabled = true;
      this.unlock(true);
    }
    if (this.ctx && this.musicGain) {
      this.musicGain.gain.setTargetAtTime(this.getEffectiveMusicGain(), this.ctx.currentTime, 0.04);
    }
  }

  public startCardMusic(): void {
    this.hasStartedMusicOnce = true;
    this.unlock(true);
    if (this.musicEnabled && this.ctx && this.musicGain) {
      this.musicGain.gain.setTargetAtTime(this.getEffectiveMusicGain(), this.ctx.currentTime, 0.35);
    }
  }

  public playCardOpen(): void {
    if (!this.soundEnabled) return;
    this.unlock(this.hasStartedMusicOnce);
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    // Soft cardstock paper unfold rustle
    const noiseBuf = this.ensureNoiseBuffer();
    if (noiseBuf) {
      const src = this.ctx.createBufferSource();
      src.buffer = noiseBuf;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(900, now);
      bp.frequency.exponentialRampToValueAtTime(2200, now + 0.35);
      bp.Q.value = 1.4;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.11, now + 0.12);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.sfxGain);
      src.start(now);
      src.stop(now + 0.58);
    }

    // Warm festive harp/celesta arpeggio flourish
    const arpeggio = [523.25, 659.25, 783.99, 987.77, 1046.5];
    arpeggio.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const t = now + 0.08 + idx * 0.065;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.065, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.52);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.55);
    });
  }

  public playStyleSwitch(): void {
    if (!this.soundEnabled) return;
    this.unlock(this.hasStartedMusicOnce);
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const freqs = [587.33, 783.99, 987.77];
    freqs.forEach((f, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const t = now + idx * 0.045;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  public playRibbonBounce(): void {
    if (!this.soundEnabled) return;
    this.unlock(this.hasStartedMusicOnce);
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    // Playful bouncy velvet-ribbon pop + twinkling high chime
    const pop = this.ctx.createOscillator();
    pop.type = 'sine';
    pop.frequency.setValueAtTime(340, now);
    pop.frequency.exponentialRampToValueAtTime(680, now + 0.08);
    const pg = this.ctx.createGain();
    pg.gain.setValueAtTime(0.0001, now);
    pg.gain.linearRampToValueAtTime(0.085, now + 0.012);
    pg.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    pop.connect(pg);
    pg.connect(this.sfxGain);
    pop.start(now);
    pop.stop(now + 0.18);

    [1174.66, 1567.98].forEach((f, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const t = now + 0.035 + idx * 0.045;
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f, t);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.045, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
      o.connect(g);
      g.connect(this.sfxGain);
      o.start(t);
      o.stop(t + 0.28);
    });
  }

  public playOrnamentAttach(ornamentId: OrnamentId): void {
    if (!this.soundEnabled) return;
    this.unlock(this.hasStartedMusicOnce);
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    // Crisp festive tree bell snap
    const bell = this.ctx.createOscillator();
    bell.type = 'sine';
    bell.frequency.setValueAtTime(1174.66, now);
    bell.frequency.exponentialRampToValueAtTime(1567.98, now + 0.08);
    const bellGain = this.ctx.createGain();
    bellGain.gain.setValueAtTime(0.0001, now);
    bellGain.gain.linearRampToValueAtTime(0.085, now + 0.01);
    bellGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
    bell.connect(bellGain);
    bellGain.connect(this.sfxGain);
    bell.start(now);
    bell.stop(now + 0.36);

    // Subtle touch of the ornament's signature sound
    this.playOrnamentVoice(ornamentId, 0.55);
  }

  public playOrnamentRemove(): void {
    if (!this.soundEnabled) return;
    this.unlock(this.hasStartedMusicOnce);
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.14);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.06, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playOrnamentVoice(ornamentId: OrnamentId, scale = 1.0): void {
    if (!this.soundEnabled) return;
    this.unlock(this.hasStartedMusicOnce);
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const v = Math.max(0.25, Math.min(1.0, scale));

    switch (ornamentId) {
      case 'espresso-martini': {
        // Crystal martini glass clink
        [2350, 3510].forEach((f, i) => {
          if (!this.ctx || !this.sfxGain) return;
          const o = this.ctx.createOscillator();
          o.type = 'sine';
          o.frequency.setValueAtTime(f, now + i * 0.04);
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.0001, now + i * 0.04);
          g.gain.linearRampToValueAtTime(0.055 * v, now + i * 0.04 + 0.006);
          g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.04 + 0.42);
          o.connect(g);
          g.connect(this.sfxGain);
          o.start(now + i * 0.04);
          o.stop(now + i * 0.04 + 0.45);
        });
        break;
      }
      case 'kirby': {
        // Cheerful "po-yo!" upward puffball chirp
        [520, 780, 1040].forEach((f, i) => {
          if (!this.ctx || !this.sfxGain) return;
          const t = now + i * 0.075;
          const o = this.ctx.createOscillator();
          o.type = 'triangle';
          o.frequency.setValueAtTime(f * 0.88, t);
          o.frequency.exponentialRampToValueAtTime(f * 1.18, t + 0.065);
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.08 * v, t + 0.012);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
          o.connect(g);
          g.connect(this.sfxGain);
          o.start(t);
          o.stop(t + 0.16);
        });
        break;
      }
      case 'rubber-duck': {
        // Cute dual rubber duck quack
        [0, 0.14].forEach((off) => {
          if (!this.ctx || !this.sfxGain) return;
          const t = now + off;
          const o = this.ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(420, t);
          o.frequency.exponentialRampToValueAtTime(300, t + 0.1);
          const bp = this.ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.setValueAtTime(1150, t);
          bp.Q.value = 3.6;
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.075 * v, t + 0.015);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
          o.connect(bp);
          bp.connect(g);
          g.connect(this.sfxGain);
          o.start(t);
          o.stop(t + 0.13);
        });
        break;
      }
      case 'cinnamoroll': {
        // Fluffy cloud celesta chime
        [1046.5, 1318.5, 1567.98].forEach((f, i) => {
          if (!this.ctx || !this.sfxGain) return;
          const t = now + i * 0.055;
          const o = this.ctx.createOscillator();
          o.type = 'sine';
          o.frequency.setValueAtTime(f, t);
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.06 * v, t + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
          o.connect(g);
          g.connect(this.sfxGain);
          o.start(t);
          o.stop(t + 0.37);
        });
        break;
      }
      case 'lord-farquaad': {
        // Tiny royal Duloc horn fanfare
        [392.0, 523.25, 659.25].forEach((f, i) => {
          if (!this.ctx || !this.sfxGain) return;
          const t = now + i * 0.09;
          const o = this.ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(f, t);
          const lp = this.ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = 1400;
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.048 * v, t + 0.015);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
          o.connect(lp);
          lp.connect(g);
          g.connect(this.sfxGain);
          o.start(t);
          o.stop(t + 0.24);
        });
        break;
      }
      case 'french-fries':
      case 'empanada': {
        // Warm crispy snack pop & marimba double-tap
        [587.33, 880.0].forEach((f, i) => {
          if (!this.ctx || !this.sfxGain) return;
          const t = now + i * 0.065;
          const o = this.ctx.createOscillator();
          o.type = 'triangle';
          o.frequency.setValueAtTime(f, t);
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.07 * v, t + 0.008);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
          o.connect(g);
          g.connect(this.sfxGain);
          o.start(t);
          o.stop(t + 0.18);
        });
        break;
      }
      case 'kiwi': {
        // Bright juicy xylophone plucks
        [698.46, 880.0].forEach((f, i) => {
          if (!this.ctx || !this.sfxGain) return;
          const t = now + i * 0.05;
          const o = this.ctx.createOscillator();
          o.type = 'sine';
          o.frequency.setValueAtTime(f, t);
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.07 * v, t + 0.006);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
          o.connect(g);
          g.connect(this.sfxGain);
          o.start(t);
          o.stop(t + 0.24);
        });
        break;
      }
      case 'volleyball': {
        // Springy rubber-ball boing
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(210, now);
        o.frequency.exponentialRampToValueAtTime(460, now + 0.07);
        o.frequency.exponentialRampToValueAtTime(280, now + 0.19);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.1 * v, now + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
        o.connect(g);
        g.connect(this.sfxGain);
        o.start(now);
        o.stop(now + 0.24);
        break;
      }
      case 'cat': {
        // Sweet kitty meow glide
        const o = this.ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime(640, now);
        o.frequency.exponentialRampToValueAtTime(860, now + 0.09);
        o.frequency.exponentialRampToValueAtTime(510, now + 0.27);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.075 * v, now + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.29);
        o.connect(g);
        g.connect(this.sfxGain);
        o.start(now);
        o.stop(now + 0.31);
        break;
      }
      case 'dog': {
        // Playful double puppy woof
        [0, 0.13].forEach((off, idx) => {
          if (!this.ctx || !this.sfxGain) return;
          const t = now + off;
          const o = this.ctx.createOscillator();
          o.type = 'triangle';
          o.frequency.setValueAtTime(idx === 0 ? 310 : 350, t);
          o.frequency.exponentialRampToValueAtTime(165, t + 0.09);
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.09 * v, t + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
          o.connect(g);
          g.connect(this.sfxGain);
          o.start(t);
          o.stop(t + 0.12);
        });
        break;
      }
      case 'wallet':
      case 'tequila-bottle':
      case 'eiffel-tower': {
        // Crisp chime sparkle
        [1480, 1975].forEach((f, i) => {
          if (!this.ctx || !this.sfxGain) return;
          const t = now + i * 0.05;
          const o = this.ctx.createOscillator();
          o.type = 'sine';
          o.frequency.setValueAtTime(f, t);
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.06 * v, t + 0.008);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
          o.connect(g);
          g.connect(this.sfxGain);
          o.start(t);
          o.stop(t + 0.3);
        });
        break;
      }
      case 'laptop':
      case 'pizza-slice':
      case 'banana': {
        // Bright retro cozy chime arpeggio
        [659.25, 880, 1318.5].forEach((f, i) => {
          if (!this.ctx || !this.sfxGain) return;
          const t = now + i * 0.05;
          const o = this.ctx.createOscillator();
          o.type = 'triangle';
          o.frequency.setValueAtTime(f, t);
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.06 * v, t + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
          o.connect(g);
          g.connect(this.sfxGain);
          o.start(t);
          o.stop(t + 0.26);
        });
        break;
      }
      case 'film-slate': {
        // Crisp director slate clap + bright movie premiere bell
        const clap = this.ctx.createOscillator();
        clap.type = 'triangle';
        clap.frequency.setValueAtTime(1180, now);
        clap.frequency.exponentialRampToValueAtTime(220, now + 0.045);
        const cg = this.ctx.createGain();
        cg.gain.setValueAtTime(0.0001, now);
        cg.gain.linearRampToValueAtTime(0.11 * v, now + 0.004);
        cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
        clap.connect(cg);
        cg.connect(this.sfxGain);
        clap.start(now);
        clap.stop(now + 0.08);

        const chime = this.ctx.createOscillator();
        chime.type = 'sine';
        chime.frequency.setValueAtTime(1318.5, now + 0.065);
        const chg = this.ctx.createGain();
        chg.gain.setValueAtTime(0.0001, now + 0.065);
        chg.gain.linearRampToValueAtTime(0.055 * v, now + 0.075);
        chg.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
        chime.connect(chg);
        chg.connect(this.sfxGain);
        chime.start(now + 0.065);
        chime.stop(now + 0.3);
        break;
      }
      case 'hamster':
      case 'honey-bee': {
        // Cute upward critter squeak / buzz chirp
        const o = this.ctx.createOscillator();
        o.type = ornamentId === 'honey-bee' ? 'sawtooth' : 'sine';
        o.frequency.setValueAtTime(ornamentId === 'honey-bee' ? 280 : 690, now);
        o.frequency.exponentialRampToValueAtTime(ornamentId === 'honey-bee' ? 390 : 1080, now + 0.12);
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1800;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.065 * v, now + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
        o.connect(lp);
        lp.connect(g);
        g.connect(this.sfxGain);
        o.start(now);
        o.stop(now + 0.18);
        break;
      }
      case 'fish':
      case 'daisy':
      case 'mistletoe':
      case 'acrylic-paint': {
        // Gentle water droplet / soft botanical chime
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(520, now);
        o.frequency.exponentialRampToValueAtTime(1040, now + 0.09);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.075 * v, now + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
        o.connect(g);
        g.connect(this.sfxGain);
        o.start(now);
        o.stop(now + 0.22);
        break;
      }
    }
  }

  private buildNoiseBuffer(ctx: BaseAudioContext): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * 2.0);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      let s = (Math.random() * 2 - 1) * 0.22;
      if (Math.random() < 0.0014) {
        s += (Math.random() * 2 - 1) * 0.85;
      }
      data[i] = s;
    }
    return buffer;
  }

  private ensureNoiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    if (this.musicNoiseBuffer) return this.musicNoiseBuffer;
    this.musicNoiseBuffer = this.buildNoiseBuffer(this.ctx);
    return this.musicNoiseBuffer;
  }

  private startMusicLoop(): void {
    if (!this.ctx || !this.musicGain || this.musicTimer !== null) return;
    this.ensureNoiseBuffer();

    const now = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setTargetAtTime(this.getEffectiveMusicGain(), now, 0.35);

    if (!this.musicCrackleSource && this.musicNoiseBuffer) {
      this.musicCrackleSource = this.attachVinylCrackle(this.ctx, this.musicGain, this.musicNoiseBuffer, now);
    }

    this.musicNextStepTime = now + 0.06;
    const liveBus: MusicSynthBus = {
      ctx: this.ctx,
      gain: this.musicGain,
      echo: this.musicEchoNode,
      noiseBuffer: this.musicNoiseBuffer,
    };
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicEnabled || this.ctx.state !== 'running') return;
      const stepDur = 60 / 72 / 4; // 72 BPM sixteenth-note grid
      while (this.musicNextStepTime < this.ctx.currentTime + 0.24) {
        this.scheduleLofiStepOn(liveBus, this.musicStep, this.musicNextStepTime, stepDur);
        const swingOffset = this.musicStep % 2 === 0 ? 0.022 : -0.022;
        this.musicNextStepTime += stepDur + swingOffset * stepDur * 2;
        this.musicStep = (this.musicStep + 1) % 96;
      }
    }, 60);
  }

  private attachVinylCrackle(
    ctx: BaseAudioContext,
    targetGain: GainNode,
    noiseBuffer: AudioBuffer,
    startTime: number
  ): AudioBufferSourceNode {
    const crackle = ctx.createBufferSource();
    crackle.buffer = noiseBuffer;
    crackle.loop = true;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1750;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 4800;

    const crackleGain = ctx.createGain();
    crackleGain.gain.value = 0.06;

    crackle.connect(hp);
    hp.connect(lp);
    lp.connect(crackleGain);
    crackleGain.connect(targetGain);
    crackle.start(startTime);
    return crackle;
  }

  /**
   * Renders an offline stereo AudioBuffer matching the active 72 BPM festive lo-fi loop
   * so high-res WebCodecs video exports receive synced crystal-clear AAC audio faster than real time.
   */
  public async renderOfflineMusicTrack(durationSec: number, sampleRate = 48000): Promise<AudioBuffer | null> {
    if (!this.musicEnabled || this.musicVolume <= 0 || typeof OfflineAudioContext === 'undefined') {
      return null;
    }

    const totalSamples = Math.max(1, Math.ceil(durationSec * sampleRate));
    const offline = new OfflineAudioContext(2, totalSamples, sampleRate);

    const master = offline.createGain();
    master.gain.setValueAtTime(0.0001, 0);
    master.gain.linearRampToValueAtTime(0.95, Math.min(0.18, durationSec * 0.15));
    const fadeOutStart = Math.max(0.2, durationSec - 0.35);
    master.gain.setValueAtTime(0.95, fadeOutStart);
    master.gain.linearRampToValueAtTime(0.0001, durationSec);

    const compressor = offline.createDynamicsCompressor();
    compressor.threshold.value = -12;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.16;

    const musicGain = offline.createGain();
    musicGain.gain.value = this.getEffectiveMusicGain();

    const echo = offline.createDelay(0.6);
    echo.delayTime.value = 0.36;
    const echoFb = offline.createGain();
    echoFb.gain.value = 0.26;
    const echoFilter = offline.createBiquadFilter();
    echoFilter.type = 'lowpass';
    echoFilter.frequency.value = 1400;
    echo.connect(echoFilter);
    echoFilter.connect(echoFb);
    echoFb.connect(echo);
    echoFilter.connect(musicGain);

    musicGain.connect(compressor);
    compressor.connect(master);
    master.connect(offline.destination);

    const noiseBuffer = this.buildNoiseBuffer(offline);
    const crackle = this.attachVinylCrackle(offline, musicGain, noiseBuffer, 0);
    crackle.stop(durationSec);

    const bus: MusicSynthBus = { ctx: offline, gain: musicGain, echo, noiseBuffer };
    const stepDur = 60 / 72 / 4;
    let step = this.musicStep % 96;
    let t = 0.02;
    while (t < durationSec - 0.02) {
      this.scheduleLofiStepOn(bus, step, t, stepDur);
      const swingOffset = step % 2 === 0 ? 0.022 : -0.022;
      t += stepDur + swingOffset * stepDur * 2;
      step = (step + 1) % 96;
    }

    return offline.startRendering();
  }

  private stopMusicLoop(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.22);
    }
    if (this.musicCrackleSource) {
      try {
        this.musicCrackleSource.stop(this.ctx ? this.ctx.currentTime + 0.25 : 0);
      } catch {
        // Ignore already stopped source
      }
      this.musicCrackleSource = null;
    }
  }

  private scheduleLofiStepOn(bus: MusicSynthBus, step: number, time: number, stepDur: number): void {
    const bar16 = Math.floor(step / 16);
    const stepInBar = step % 16;

    let chordIdx = 0;
    let isChordHit = false;
    let chordLen = 16;

    if (bar16 === 0) {
      chordIdx = 0;
      isChordHit = stepInBar === 0;
    } else if (bar16 === 1) {
      chordIdx = 1;
      isChordHit = stepInBar === 0;
    } else if (bar16 === 2) {
      chordIdx = 2;
      isChordHit = stepInBar === 0;
    } else if (bar16 === 3) {
      chordIdx = stepInBar < 8 ? 3 : 4;
      isChordHit = stepInBar === 0 || stepInBar === 8;
      chordLen = 8;
    } else if (bar16 === 4) {
      chordIdx = stepInBar < 8 ? 5 : 6;
      isChordHit = stepInBar === 0 || stepInBar === 8;
      chordLen = 8;
    } else {
      chordIdx = 7;
      isChordHit = stepInBar === 0;
    }

    const chord = FESTIVE_LOFI_CHORDS[chordIdx];

    if (isChordHit) {
      const dur = stepDur * chordLen * 0.94;
      chord.tones.forEach((freq, idx) => {
        this.playRhodesToneOn(bus, freq, time + idx * 0.022, dur, idx === 0 ? 0.14 : 0.105);
      });
      this.playSubBassOn(bus, chord.bass, time, dur * 0.85);
    }

    if (stepInBar === 10 && Math.random() < 0.55) {
      const tone = chord.tones[(step + 2) % chord.tones.length];
      this.playRhodesToneOn(bus, tone, time, stepDur * 4.2, 0.06);
    }

    if (
      (stepInBar === 2 || stepInBar === 6 || stepInBar === 11 || stepInBar === 14) &&
      Math.random() < 0.62
    ) {
      const note = HOLIDAY_SPARKLES_HZ[(step * 3 + chordIdx * 2) % HOLIDAY_SPARKLES_HZ.length];
      this.playWinterCelestaOn(bus, note, time, 0.55);
    }

    if (stepInBar % 4 === 2 && Math.random() < 0.72) {
      this.playSleighBrushOn(bus, time, 0.045);
    }

    if (stepInBar === 0 || stepInBar === 10 || (stepInBar === 7 && bar16 % 2 === 1 && Math.random() < 0.45)) {
      this.playLofiKickOn(bus, time);
    }
    if (stepInBar === 4 || stepInBar === 12) {
      this.playLofiSnareOn(bus, time);
    }
  }

  private playRhodesToneOn(bus: MusicSynthBus, freq: number, time: number, dur: number, peak: number): void {
    const osc = bus.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    osc.detune.setValueAtTime((Math.random() - 0.5) * 9, time);

    const filter = bus.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(980, time);
    filter.frequency.exponentialRampToValueAtTime(420, time + dur);

    const gain = bus.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(peak, time + 0.045);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(bus.gain);
    if (bus.echo) gain.connect(bus.echo);

    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  private playSubBassOn(bus: MusicSynthBus, freq: number, time: number, dur: number): void {
    const osc = bus.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);

    const gain = bus.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.22, time + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    osc.connect(gain);
    gain.connect(bus.gain);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  private playWinterCelestaOn(bus: MusicSynthBus, freq: number, time: number, dur: number): void {
    const osc = bus.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);

    const gain = bus.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.055, time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    osc.connect(gain);
    gain.connect(bus.gain);
    if (bus.echo) gain.connect(bus.echo);

    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  private playSleighBrushOn(bus: MusicSynthBus, time: number, peak: number): void {
    if (!bus.noiseBuffer) return;
    const src = bus.ctx.createBufferSource();
    src.buffer = bus.noiseBuffer;
    const bp = bus.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(5200, time);
    bp.Q.value = 3.2;

    const g = bus.ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(peak, time + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.075);

    src.connect(bp);
    bp.connect(g);
    g.connect(bus.gain);
    src.start(time, Math.random() * 1.1, 0.09);
  }

  private playLofiKickOn(bus: MusicSynthBus, time: number): void {
    const osc = bus.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(112, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.14);

    const gain = bus.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.28, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);

    osc.connect(gain);
    gain.connect(bus.gain);
    osc.start(time);
    osc.stop(time + 0.22);
  }

  private playLofiSnareOn(bus: MusicSynthBus, time: number): void {
    if (!bus.noiseBuffer) return;
    const noise = bus.ctx.createBufferSource();
    noise.buffer = bus.noiseBuffer;

    const filter = bus.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1450, time);
    filter.Q.value = 0.8;

    const gain = bus.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.11, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.11);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(bus.gain);
    noise.start(time, Math.random() * 1.2, 0.12);
  }

  public dispose(): void {
    this.stopMusicLoop();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
