export type SoundId = 'none' | 'beep' | 'double-beep' | 'chime' | 'alert' | 'melody';

export interface SoundOption { id: SoundId; label: string; }

export const SOUNDS: SoundOption[] = [
  { id: 'none',        label: 'None'        },
  { id: 'beep',        label: 'Beep'        },
  { id: 'double-beep', label: 'Double beep' },
  { id: 'chime',       label: 'Chime'       },
  { id: 'alert',       label: 'Alert'       },
  { id: 'melody',      label: 'Melody'      },
];

export function playSound(id: SoundId): void {
  if (id === 'none') return;
  try {
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.35, ctx.currentTime);
    master.connect(ctx.destination);

    const note = (freq: number, start: number, dur: number, type: OscillatorType = 'sine') => {
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      g.gain.setValueAtTime(0.8, ctx.currentTime + start);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    };

    if (id === 'beep') {
      note(880, 0, 0.5);
      setTimeout(() => ctx.close(), 700);
    } else if (id === 'double-beep') {
      note(880, 0,   0.2);
      note(880, 0.3, 0.2);
      setTimeout(() => ctx.close(), 700);
    } else if (id === 'chime') {
      note(1047, 0,    0.6);
      note(880,  0.18, 0.5);
      note(698,  0.36, 0.7);
      setTimeout(() => ctx.close(), 1200);
    } else if (id === 'alert') {
      note(440, 0,   0.15, 'square');
      note(440, 0.2, 0.15, 'square');
      note(440, 0.4, 0.15, 'square');
      setTimeout(() => ctx.close(), 800);
    } else if (id === 'melody') {
      const notes = [523, 659, 784, 1047];
      notes.forEach((f, i) => note(f, i * 0.15, 0.2));
      setTimeout(() => ctx.close(), 900);
    }
  } catch { /* audio not supported */ }
}
