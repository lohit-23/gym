/**
 * CyberCurl Audio Synthesizer
 * Built using HTML5 Web Audio API - no external audio files required!
 */
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.initialized = false;
  }

  init() {
    if (this.initialized && this.ctx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
        this.initialized = true;
      }
    } catch (e) {
      console.warn('Web Audio API not supported or blocked:', e);
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Plays a crisp futuristic beep / chime when a bicep curl rep is completed
  playRepSound(repCount = 1) {
    if (!this.enabled) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // Pitch slightly rises every rep up to an octave
      const baseFreq = 587.33; // D5
      const pitchMod = Math.min(repCount * 18, 400);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq + pitchMod, now);
      osc.frequency.exponentialRampToValueAtTime((baseFreq + pitchMod) * 1.5, now + 0.12);

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.22);

      // Sub-harmonic "click" for satisfying tactile feel
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = 'triangle';
      subOsc.frequency.setValueAtTime(180, now);
      subGain.gain.setValueAtTime(0.2, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      subOsc.connect(subGain);
      subGain.connect(this.ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 0.08);
    } catch (err) {
      console.warn('Audio playback error:', err);
    }
  }

  // Plays when user achieves peak contraction at top of curl
  playPeakSound() {
    if (!this.enabled) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now); // A5
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    } catch (e) {}
  }

  // Gentle warning tone if posture/facing is off
  playWarningSound() {
    if (!this.enabled) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.setValueAtTime(180, now + 0.09);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch (e) {}
  }

  // Grand triumph fanfare when user reaches their target reps!
  playVictorySound() {
    if (!this.enabled) return;
    this.init();
    this.resume();
    if (!this.ctx) return;

    try {
      const notes = [
        { freq: 523.25, time: 0.0, dur: 0.12 }, // C5
        { freq: 659.25, time: 0.12, dur: 0.12 }, // E5
        { freq: 783.99, time: 0.24, dur: 0.15 }, // G5
        { freq: 1046.50, time: 0.39, dur: 0.45 } // C6
      ];

      notes.forEach(({ freq, time, dur }) => {
        const now = this.ctx.currentTime + time;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + dur);
      });
    } catch (e) {}
  }
}

window.soundEngine = new SoundEngine();
