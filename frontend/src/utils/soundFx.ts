/**
 * Web Audio API retro sound synthesizer for BugArena.
 * Zero external audio files, 100% offline, lightweight and instant.
 */

let audioCtx: AudioContext | null = null;
let sfxEnabled = true;

// Initialize from localStorage if present
if (typeof window !== 'undefined') {
  const saved = localStorage.getItem('bugarena_sfx');
  if (saved !== null) {
    sfxEnabled = saved === 'true';
  }
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export const soundFx = {
  isEnabled(): boolean {
    return sfxEnabled;
  },

  setEnabled(enabled: boolean) {
    sfxEnabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('bugarena_sfx', String(enabled));
    }
  },

  toggle(): boolean {
    const next = !sfxEnabled;
    this.setEnabled(next);
    if (next) {
      this.playThump();
    }
    return next;
  },

  /** Mechanical typewriter click on keypress */
  playTypewriter() {
    if (!sfxEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800 + Math.random() * 400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.04);

    filter.type = 'highpass';
    filter.frequency.setValueAtTime(400, ctx.currentTime);

    // Boosted volume: 0.12 -> 0.28
    gain.gain.setValueAtTime(0.28, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.04);
  },

  /** Heavy ink stamp thud for buttons, join, votes */
  playThump() {
    if (!sfxEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.12);

    // Boosted volume: 0.25 -> 0.42
    gain.gain.setValueAtTime(0.42, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  },

  /** Bright ascending chime when a test case passes */
  playPass() {
    if (!sfxEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    [523.25, 659.25, 783.99].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + idx * 0.06;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      // Boosted volume: 0.14 -> 0.32
      gain.gain.setValueAtTime(0.32, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.2);
    });
  },

  /** Low buzz when a test case fails */
  playFail() {
    if (!sfxEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + 0.18);

    // Boosted volume: 0.18 -> 0.36
    gain.gain.setValueAtTime(0.36, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.18);
  },

  /** Dramatic manga / anime duel start gong */
  playFightGong() {
    if (!sfxEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    [110, 164.81, 220, 329.63].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      // Boosted volume: 0.18 -> 0.36
      gain.gain.setValueAtTime(0.36, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1.2);
    });
  },

  /** 8-bit retro victory fanfare */
  playVictory() {
    if (!sfxEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + idx * 0.08;

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, start);

      // Boosted volume: 0.12 -> 0.30
      gain.gain.setValueAtTime(0.30, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.28);
    });
  },

  /** Countdown ticker clock for last 15s */
  playClockTick() {
    if (!sfxEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.03);

    // Boosted volume: 0.10 -> 0.26
    gain.gain.setValueAtTime(0.26, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.03);
  },

  /** Emote pop sound */
  playEmotePop() {
    if (!sfxEnabled) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400 + Math.random() * 200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800 + Math.random() * 200, ctx.currentTime + 0.08);

    // Boosted volume: 0.15 -> 0.33
    gain.gain.setValueAtTime(0.33, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  },
};
