/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Note {
  freq: number;
  duration: number;
}

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private currentSequence: number | null = null;

  constructor() {
    // AudioContext is initialized on first user interaction
  }

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.gainNode = this.ctx.createGain();
      this.gainNode.connect(this.ctx.destination);
    }
  }

  public playTone(freq: number, duration: number, volume: number = 0.1) {
    this.init();
    if (!this.ctx || !this.gainNode) return;

    this.stop();

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    g.gain.setValueAtTime(volume, this.ctx.currentTime);
    // No fading, just sharp on/off
    // g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration / 1000);

    osc.connect(g);
    g.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration / 1000);
    
    this.oscillator = osc;
  }

  public playSequence(notes: Note[], loop: boolean = false) {
    this.init();
    if (!this.ctx || !this.gainNode) return;

    this.stop();
    
    const playNext = (index: number) => {
      if (index >= notes.length) {
        if (loop) playNext(0);
        return;
      }

      const note = notes[index];
      if (note.freq > 0) {
        this.playTone(note.freq, note.duration);
      }
      
      this.currentSequence = window.setTimeout(() => playNext(index + 1), note.duration);
    };

    playNext(0);
  }

  public stop() {
    if (this.currentSequence) {
      clearTimeout(this.currentSequence);
      this.currentSequence = null;
    }
    if (this.oscillator) {
      try {
        this.oscillator.stop();
      } catch (e) {}
      this.oscillator = null;
    }
  }

  public beep() {
    this.playTone(880, 50);
  }

  public error() {
    this.playSequence([
      { freq: 220, duration: 100 },
      { freq: 110, duration: 200 }
    ]);
  }

  public startup() {
    this.playSequence([
      { freq: 440, duration: 100 },
      { freq: 554, duration: 100 },
      { freq: 659, duration: 100 },
      { freq: 880, duration: 300 }
    ]);
  }
}

export const TONES = {
  RINGTONES: [
    // Signature Samsoft
    [
      { freq: 659, duration: 150 }, { freq: 659, duration: 150 }, { freq: 0, duration: 150 }, { freq: 659, duration: 150 }, 
      { freq: 0, duration: 150 }, { freq: 523, duration: 150 }, { freq: 659, duration: 150 }, { freq: 0, duration: 150 }, 
      { freq: 784, duration: 300 }, { freq: 0, duration: 300 }, { freq: 392, duration: 300 }
    ],
    // Classic Ring-Ring
    [
      { freq: 1200, duration: 50 }, { freq: 1100, duration: 50 }, { freq: 1200, duration: 50 }, { freq: 1100, duration: 50 },
      { freq: 0, duration: 100 },
      { freq: 1200, duration: 50 }, { freq: 1100, duration: 50 }, { freq: 1200, duration: 50 }, { freq: 1100, duration: 50 },
      { freq: 0, duration: 1000 }
    ],
    [
      { freq: 440, duration: 400 }, { freq: 554, duration: 400 }, { freq: 659, duration: 400 }, { freq: 880, duration: 800 },
      { freq: 440, duration: 400 }, { freq: 554, duration: 400 }, { freq: 659, duration: 400 }, { freq: 880, duration: 800 },
      { freq: 659, duration: 400 }, { freq: 554, duration: 400 }, { freq: 440, duration: 800 }
    ],
    [
      { freq: 523, duration: 300 }, { freq: 523, duration: 300 }, { freq: 659, duration: 600 }, { freq: 587, duration: 600 },
      { freq: 523, duration: 300 }, { freq: 523, duration: 300 }, { freq: 659, duration: 600 }, { freq: 587, duration: 600 },
      { freq: 698, duration: 600 }, { freq: 659, duration: 600 }, { freq: 523, duration: 1200 }
    ],
    [
      { freq: 330, duration: 400 }, { freq: 392, duration: 400 }, { freq: 523, duration: 400 }, { freq: 330, duration: 400 },
      { freq: 330, duration: 400 }, { freq: 392, duration: 400 }, { freq: 523, duration: 400 }, { freq: 330, duration: 400 },
      { freq: 440, duration: 400 }, { freq: 493, duration: 400 }, { freq: 523, duration: 800 }
    ]
  ],
  SMS_TONES: [
    // Classic Beep-Beep
    [{ freq: 1000, duration: 100 }, { freq: 0, duration: 50 }, { freq: 1000, duration: 100 }],
    [{ freq: 880, duration: 250 }, { freq: 1760, duration: 250 }, { freq: 880, duration: 250 }],
    [{ freq: 1320, duration: 200 }, { freq: 1320, duration: 200 }, { freq: 1320, duration: 400 }],
    [{ freq: 440, duration: 200 }, { freq: 880, duration: 200 }, { freq: 440, duration: 200 }, { freq: 880, duration: 400 }],
    [{ freq: 1000, duration: 300 }, { freq: 1200, duration: 300 }, { freq: 1000, duration: 300 }]
  ]
};
