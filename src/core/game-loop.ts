export class GameLoop {
  private running = false;
  private onFrameCallback!: (time: number) => void;
  private onDetectCallback!: () => void | Promise<void>;
  private lastDetectTime = 0;
  private detectInterval: number;
  private detectInFlight = false;

  constructor(detectIntervalMs: number) {
    this.detectInterval = detectIntervalMs;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.loop(0);
  }

  stop(): void {
    this.running = false;
  }

  onFrame(callback: (time: number) => void): void {
    this.onFrameCallback = callback;
  }

  onDetect(callback: () => void | Promise<void>): void {
    this.onDetectCallback = callback;
  }

  updateDetectInterval(interval: number): void {
    this.detectInterval = interval;
  }

  private loop = (time: number): void => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);

    this.onFrameCallback(time);

    if (time - this.lastDetectTime >= this.detectInterval) {
      if (this.detectInFlight) return;
      this.lastDetectTime = time;
      this.detectInFlight = true;
      setTimeout(() => {
        this.onDetectCallback();
        this.detectInFlight = false;
      }, 0);
    }
  }
}
