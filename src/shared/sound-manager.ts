export class SoundManager {
  private audioContext: AudioContext | null = null;
  private sounds: Map<string, AudioBuffer> = new Map();
  private isMuted = false;

  constructor() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported:', e);
    }
  }

  play(soundName: 'slice' | 'combo' | 'life_lost' | 'game_over'): void {
    if (this.isMuted || !this.audioContext) return;

    switch (soundName) {
      case 'slice':
        this.playTone(800, 0.1, 'sine');
        break;
      case 'combo':
        this.playTone(1200, 0.2, 'square');
        break;
      case 'life_lost':
        this.playTone(300, 0.3, 'sawtooth');
        break;
      case 'game_over':
        this.playTone(200, 0.5, 'sawtooth');
        break;
    }
  }

  private playTone(frequency: number, duration: number, type: OscillatorType): void {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;

    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01, this.audioContext.currentTime + duration
    );

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted;
  }

  destroy(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
