/**
 * 游戏循环管理器 - 封装 requestAnimationFrame
 */
export class GameLoop {
  private running = false;
  private onFrameCallback?: (time: number) => void;

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

  private loop = (time: number): void => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    if (this.onFrameCallback) {
      this.onFrameCallback(time);
    }
  }
}
