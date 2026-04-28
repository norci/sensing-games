/**
 * 游戏循环管理器 - 分离渲染与检测，避免检测阻塞渲染
 */
export class GameLoop {
  private running = false;
  private onFrameCallback?: (time: number) => void;
  private onDetectCallback?: (time: number) => void;
  private lastDetectTime = 0;
  private detectInterval = 33; // 每 33ms 检测一次（约 30fps）

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

  /**
   * 设置检测回调（可选，若未设置则每帧都检测）
   */
  onDetect(callback: (time: number) => void): void {
    this.onDetectCallback = callback;
  }

  /**
   * 设置检测间隔（毫秒），默认 33ms（约30fps）
   */
  setDetectInterval(ms: number): void {
    this.detectInterval = ms;
  }

  private loop = (time: number): void => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);

    // 渲染始终运行（60fps）
    if (this.onFrameCallback) {
      this.onFrameCallback(time);
    }

    // 检测按间隔运行（不阻塞渲染）
    if (this.onDetectCallback && time - this.lastDetectTime >= this.detectInterval) {
      this.lastDetectTime = time;
      // 用 setTimeout 将检测放至下一事件循环，不阻塞渲染
      setTimeout(() => {
        if (this.onDetectCallback) {
          this.onDetectCallback(time);
        }
      }, 0);
    }
  }
}
