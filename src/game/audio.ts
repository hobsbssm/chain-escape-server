import type { WorldId } from '../shared/types.ts';

/**
 * Real audio for Chain Escape (replaces the old oscillator-only synth).
 *
 * - Music: one licensed 40s loop per world, Kevin MacLeod (CC-BY 3.0/4.0),
 *   trimmed + faded with ffmpeg, in public/assets/audio/music/<world>.ogg.
 * - SFX: real files from OpenGameArt (CC0 / CC-BY 3.0) in
 *   public/assets/audio/sfx/*.ogg. See UPGRADE_NOTES_audio.md for the full
 *   source + licence list per file.
 * - Footsteps and chain clinks have no suitable real file yet, so they still
 *   use the old tiny oscillator synth (same public API, no caller changes).
 * - If a file fails to load/decode, that sound falls back to silence or to
 *   the old synth tone — the game never breaks.
 *
 * Public API is unchanged: unlock / setMuted / isMuted / setVolumes /
 * startWorldMusic / stopMusic / playJump / playLand / playFootstep /
 * playChainClink / playEvent. Added (additive only): startMusic (alias of
 * startWorldMusic), playClick, preload.
 */

const AUDIO_BASE = `${import.meta.env.BASE_URL}assets/audio/`;

const WORLD_MUSIC: Record<WorldId, string> = {
  sky_islands: 'music/sky_islands.ogg',
  ancient_jungle: 'music/ancient_jungle.ogg',
  frozen_peak: 'music/frozen_peak.ogg',
  lava_factory: 'music/lava_factory.ogg',
  lost_temple: 'music/lost_temple.ogg',
  the_abyss: 'music/the_abyss.ogg',
};

const SFX_FILES = {
  jump: 'sfx/jump.ogg',
  land: 'sfx/land.ogg',
  star: 'sfx/star.ogg',
  click: 'sfx/click.ogg',
  victory: 'sfx/victory.ogg',
  fall: 'sfx/fall.ogg',
  rescue: 'sfx/rescue.ogg',
  checkpoint: 'sfx/checkpoint.ogg',
} as const;

type SfxName = keyof typeof SFX_FILES;
type GameEvent =
  | 'checkpoint'
  | 'rescue'
  | 'fall'
  | 'star'
  | 'key'
  | 'knockdown'
  | 'gate_open'
  | 'victory';

/** Event -> real file. Events missing here keep the old synth tone. */
const EVENT_SFX: Partial<Record<GameEvent, SfxName>> = {
  checkpoint: 'checkpoint',
  rescue: 'rescue',
  fall: 'fall',
  star: 'star',
  key: 'star',
  knockdown: 'land',
  victory: 'victory',
};

class GameAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private muted = false;
  private sfxVolume = 0.75;
  private musicVolume = 0.45;
  private currentWorld: WorldId = 'sky_islands';
  private lastChainSoundMs = 0;

  /** Decoded buffers + in-flight loads, keyed by path relative to AUDIO_BASE. */
  private buffers = new Map<string, AudioBuffer>();
  private loading = new Map<string, Promise<AudioBuffer | null>>();
  private failed = new Set<string>();

  /** Currently playing music loop (real file). */
  private musicSource: AudioBufferSourceNode | null = null;
  /** Fallback oscillator loop, used only when the music file cannot load. */
  private musicTimer: number | null = null;
  private musicStep = 0;
  private musicLoadToken = 0;
  private preloadStarted = false;
  /** startWorldMusic was called before any unlock() created the context. */
  private musicPending = false;

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.applyGains();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.musicPending) {
      this.musicPending = false;
      this.startWorldMusic(this.currentWorld);
    }
    // Warm the cache on the first user gesture so the first jump/click
    // plays instantly instead of waiting for a fetch + decode.
    this.preload();
  }

  /** Preload every SFX + music loop in the background (best effort). */
  public preload(): void {
    if (this.preloadStarted || !this.ctx) return;
    this.preloadStarted = true;
    for (const file of Object.values(SFX_FILES)) {
      void this.loadBuffer(file);
    }
    for (const file of Object.values(WORLD_MUSIC)) {
      void this.loadBuffer(file);
    }
  }

  private loadBuffer(path: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(path);
    if (cached) return Promise.resolve(cached);
    const inFlight = this.loading.get(path);
    if (inFlight) return inFlight;
    if (this.failed.has(path) || !this.ctx) return Promise.resolve(null);
    const ctx = this.ctx;
    const promise = fetch(AUDIO_BASE + path)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        this.buffers.set(path, buffer);
        this.loading.delete(path);
        return buffer;
      })
      .catch(() => {
        this.failed.add(path);
        this.loading.delete(path);
        return null;
      });
    this.loading.set(path, promise);
    return promise;
  }

  /** Play a decoded buffer on the SFX bus. Returns false if unavailable. */
  private playBuffer(
    path: string,
    opts: { rate?: number; volume?: number } = {},
  ): boolean {
    const buffer = this.buffers.get(path);
    if (!this.ctx || !this.sfxGain || !buffer || this.muted) return false;
    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.setValueAtTime(opts.rate ?? 1, now);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(opts.volume ?? 1, now);
    source.connect(gain);
    gain.connect(this.sfxGain);
    source.start(now);
    return true;
  }

  /** Fire-and-forget: play now if cached, else load then play (or synth). */
  private playSfxOrFallback(
    name: SfxName,
    opts: { rate?: number; volume?: number } = {},
    fallback?: () => void,
  ): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    if (this.playBuffer(SFX_FILES[name], opts)) return;
    if (this.failed.has(SFX_FILES[name])) {
      fallback?.();
      return;
    }
    void this.loadBuffer(SFX_FILES[name]).then((buffer) => {
      if (buffer) this.playBuffer(SFX_FILES[name], opts);
      else fallback?.();
    });
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyGains();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setVolumes(sfx: number, music: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, sfx));
    this.musicVolume = Math.max(0, Math.min(1, music));
    this.applyGains();
  }

  private applyGains(): void {
    if (!this.ctx || !this.masterGain || !this.sfxGain || !this.musicGain)
      return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 1, now, 0.03);
    this.sfxGain.gain.setTargetAtTime(this.sfxVolume, now, 0.03);
    this.musicGain.gain.setTargetAtTime(this.musicVolume, now, 0.05);
  }

  public startWorldMusic(worldId: WorldId): void {
    this.currentWorld = worldId;
    this.stopMusic();
    if (!this.ctx || !this.musicGain) {
      // Called before the first user gesture: start once unlock() runs.
      this.musicPending = true;
      return;
    }
    const token = ++this.musicLoadToken;
    const path = WORLD_MUSIC[worldId] ?? WORLD_MUSIC.sky_islands;
    const buffer = this.buffers.get(path);
    if (buffer) {
      this.startMusicLoop(buffer);
      return;
    }
    if (this.failed.has(path)) {
      this.startFallbackMusicLoop();
      return;
    }
    void this.loadBuffer(path).then((loaded) => {
      // Ignore stale loads if the player already switched worlds.
      if (token !== this.musicLoadToken) return;
      if (loaded) this.startMusicLoop(loaded);
      else this.startFallbackMusicLoop();
    });
  }

  /** Alias kept for callers that use the shorter name. */
  public startMusic(worldId: WorldId): void {
    this.startWorldMusic(worldId);
  }

  private startMusicLoop(buffer: AudioBuffer): void {
    if (!this.ctx || !this.musicGain) return;
    this.stopMusicSource();
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.musicGain);
    source.start();
    this.musicSource = source;
  }

  private stopMusicSource(): void {
    if (this.musicSource) {
      try {
        this.musicSource.stop();
      } catch {
        /* already stopped */
      }
      this.musicSource.disconnect();
      this.musicSource = null;
    }
  }

  /**
   * Tiny fallback loop (the old single-note arpeggio) used only when the
   * world's music file fails to load, so the game is never left silent.
   */
  private startFallbackMusicLoop(): void {
    if (!this.ctx || !this.musicGain) return;
    this.stopMusicSource();
    if (this.musicTimer !== null) return;
    this.musicStep = 0;
    const tempoMs =
      this.currentWorld === 'lava_factory'
        ? 420
        : this.currentWorld === 'the_abyss'
          ? 660
          : 530;
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicGain || this.muted || this.ctx.state !== 'running')
        return;
      const scales: Record<WorldId, number[]> = {
        sky_islands: [261.63, 329.63, 392.0, 493.88, 523.25, 392.0],
        ancient_jungle: [246.94, 293.66, 369.99, 440.0, 493.88, 369.99],
        frozen_peak: [293.66, 349.23, 440.0, 523.25, 587.33, 440.0],
        lava_factory: [146.83, 174.61, 220.0, 233.08, 196.0, 146.83],
        lost_temple: [220.0, 261.63, 311.13, 392.0, 440.0, 329.63],
        the_abyss: [196.0, 246.94, 293.66, 369.99, 440.0, 293.66],
      };
      const notes = scales[this.currentWorld] ?? scales.sky_islands;
      const freq = notes[this.musicStep % notes.length];
      this.musicStep += 1;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = this.currentWorld === 'lava_factory' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(now);
      osc.stop(now + 0.75);
    }, tempoMs);
  }

  public stopMusic(): void {
    this.musicLoadToken += 1;
    this.stopMusicSource();
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  /** Small synth tone, used only as a fallback when a file cannot play. */
  private synthTone(
    freqFrom: number,
    freqTo: number,
    dur: number,
    type: OscillatorType = 'sine',
    vol = 0.18,
  ): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), now + dur);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  public playJump(isDouble = false): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.playSfxOrFallback(
      'jump',
      { rate: isDouble ? 1.25 : 1 },
      () => this.synthTone(isDouble ? 340 : 210, isDouble ? 720 : 480, 0.16, isDouble ? 'triangle' : 'sine'),
    );
  }

  public playLand(intensity = 1): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.playSfxOrFallback(
      'land',
      { volume: Math.min(1, 0.5 + 0.35 * intensity) },
      () => this.synthTone(140, 48, 0.14, 'triangle', Math.min(0.26, 0.14 * intensity)),
    );
  }

  public playClick(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.playSfxOrFallback('click', {}, () => this.synthTone(880, 660, 0.05, 'square', 0.08));
  }

  public playFootstep(surface: 'stone' | 'ice' | 'metal' | 'wood' | 'void'): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    if (surface === 'metal') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(360 + Math.random() * 60, now);
    } else if (surface === 'ice') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(780 + Math.random() * 140, now);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(130 + Math.random() * 35, now);
    }
    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  public playChainClink(tension: number): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const nowMs = performance.now();
    if (nowMs - this.lastChainSoundMs < 240) return;
    this.lastChainSoundMs = nowMs;

    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc1.type = 'triangle';
    osc2.type = 'sine';
    const base = 920 + tension * 520 + Math.random() * 120;
    osc1.frequency.setValueAtTime(base, now);
    osc2.frequency.setValueAtTime(base * 1.47, now);
    gain.gain.setValueAtTime(0.045 + tension * 0.065, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.12);
    osc2.stop(now + 0.12);
  }

  public playEvent(event: GameEvent): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    if (event === 'gate_open') {
      // No real file for this yet: keep the old low rumble synth.
      const now = this.ctx.currentTime;
      const playTone = (freq: number, delay: number, dur: number, type: OscillatorType = 'triangle', vol = 0.12) => {
        if (!this.ctx || !this.sfxGain) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now + delay);
        g.gain.setValueAtTime(0.001, now + delay);
        g.gain.linearRampToValueAtTime(vol, now + delay + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
        osc.connect(g);
        g.connect(this.sfxGain);
        osc.start(now + delay);
        osc.stop(now + delay + dur + 0.02);
      };
      playTone(110, 0, 0.45, 'sawtooth', 0.11);
      playTone(164.81, 0.12, 0.35, 'triangle', 0.12);
      return;
    }
    const sfx = EVENT_SFX[event];
    if (!sfx) return;
    const fallbackTones: Partial<Record<GameEvent, Array<[number, number, number, OscillatorType?, number?]>>> = {
      checkpoint: [[440, 440, 0.14], [554.37, 554.37, 0.14], [659.25, 659.25, 0.24]],
      star: [[587.33, 587.33, 0.12, 'sine'], [880, 880, 0.22, 'sine']],
      key: [[659.25, 659.25, 0.1], [987.77, 987.77, 0.2, 'sine']],
      knockdown: [[150, 150, 0.16, 'sawtooth', 0.18], [85, 85, 0.24, 'triangle', 0.18]],
      rescue: [[392, 392, 0.12], [523.25, 523.25, 0.16], [783.99, 783.99, 0.26]],
      fall: [[320, 320, 0.18, 'sine', 0.14], [180, 180, 0.28, 'sine', 0.14]],
      victory: [[523.25, 523.25, 0.18], [659.25, 659.25, 0.18], [783.99, 783.99, 0.2], [1046.5, 1046.5, 0.55]],
    };
    const tones = fallbackTones[event];
    this.playSfxOrFallback(
      sfx,
      { rate: event === 'knockdown' ? 0.7 : 1 },
      () => {
        if (!tones || !this.ctx) return;
        const now = this.ctx.currentTime;
        tones.forEach(([freq, , dur, type = 'triangle', vol = 0.16], i) => {
          if (!this.ctx || !this.sfxGain) return;
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = type;
          const delay = i * 0.08;
          osc.frequency.setValueAtTime(freq, now + delay);
          g.gain.setValueAtTime(0.001, now + delay);
          g.gain.linearRampToValueAtTime(vol, now + delay + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
          osc.connect(g);
          g.connect(this.sfxGain);
          osc.start(now + delay);
          osc.stop(now + delay + dur + 0.02);
        });
      },
    );
  }
}

export const gameAudio = new GameAudioEngine();
