/**
 * 摄像头管理器 - 独立模块，负责摄像头初始化和生命周期
 */
export class CameraManager {
  private video: HTMLVideoElement;
  private cameraPrompt: HTMLElement;
  private onCameraReady?: () => void;
  private onCameraFailed?: (msg: string) => void;

  constructor(videoId: string, promptId: string) {
    this.video = document.getElementById(videoId) as HTMLVideoElement;
    this.cameraPrompt = document.getElementById(promptId)!;
  }

  setCallbacks(onReady: () => void, onFailed: (msg: string) => void): void {
    this.onCameraReady = onReady;
    this.onCameraFailed = onFailed;
  }

  /** 启动摄像头，返回是否成功 */
  async start(isUserGesture = false): Promise<boolean> {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      const msg = '浏览器不支持摄像头（getUserMedia 不可用）';
      if (isUserGesture && this.onCameraFailed) this.onCameraFailed(msg);
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 60, min: 30 },
        },
      });

      this.video.srcObject = stream;

      await new Promise<void>((resolve) => {
        this.video.onloadedmetadata = () => {
          this.video.play().catch(e => console.warn('video.play 失败:', e));
          const track = stream.getVideoTracks()[0];
          const settings = track.getSettings();
          console.log(`摄像头已启动: ${settings.width}x${settings.height} @ ${settings.frameRate}fps`);
          resolve();
        };
      });

      this.hidePrompt();
      if (this.onCameraReady) this.onCameraReady();
      return true;

    } catch (err) {
      console.error('Camera access denied:', err);
      if (isUserGesture) {
        if (this.onCameraFailed) this.onCameraFailed(err instanceof Error ? err.message : String(err));
      } else {
        this.showPrompt();
        this.bindPromptButton();
      }
      return false;
    }
  }

  getVideoElement(): HTMLVideoElement {
    return this.video;
  }

  private showPrompt(): void {
    const loading = document.getElementById('loading')!;
    const error = document.getElementById('error')!;
    loading.style.display = 'none';
    error.style.display = 'none';
    this.cameraPrompt.style.display = 'block';
  }

  private hidePrompt(): void {
    this.cameraPrompt.style.display = 'none';
  }

  private bindPromptButton(): void {
    const btn = document.getElementById('enableCamera')!;
    btn.replaceWith(btn.cloneNode(true));
    document.getElementById('enableCamera')!.addEventListener('click', async () => {
      this.cameraPrompt.style.display = 'none';
      await this.start(true);
    });
  }
}
