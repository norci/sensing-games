/**
 * 摄像头管理器 - 独立模块，负责摄像头初始化和生命周期
 */
export class CameraManager {
  private video: HTMLVideoElement;
  private cameraPrompt: HTMLElement;
  private onCameraReady?: () => void;
  private onCameraFailed?: (msg: string) => void;
  private videoTrack: MediaStreamTrack | null = null;
  private isLowFps = false;

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
      // 检测屏幕宽高比，使视频帧比例与屏幕一致
      const screenAspect = window.innerWidth / window.innerHeight;
      console.log(`屏幕宽高比: ${screenAspect.toFixed(3)}`);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 480 },
          aspectRatio: { ideal: screenAspect },
          frameRate: { ideal: 60, min: 30 },
        },
      });

      this.video.srcObject = stream;

      await new Promise<void>((resolve) => {
        this.video.onloadedmetadata = () => {
          this.video.play().catch(e => console.warn('video.play 失败:', e));
          this.videoTrack = stream.getVideoTracks()[0];
          const settings = this.videoTrack.getSettings();
          console.log(`摄像头已启动: ${settings.width}x${settings.height} @ ${settings.frameRate}fps`);
          // video 尺寸由 CSS 控制，此处不再设置
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

  /** 将摄像头帧率降至 1fps（省 CPU） */
  async setLowFps(): Promise<void> {
    if (!this.videoTrack || this.isLowFps) return;
    try {
      await this.videoTrack.applyConstraints({ frameRate: { ideal: 1, max: 1 } });
      this.isLowFps = true;
      console.log('摄像头帧率已降至 1 fps');
    } catch (e) {
      console.warn('无法设置低帧率:', e);
    }
  }

  /** 恢复摄像头正常帧率（30~60 fps） */
  async setNormalFps(): Promise<void> {
    if (!this.videoTrack || !this.isLowFps) return;
    try {
      await this.videoTrack.applyConstraints({ frameRate: { ideal: 60, min: 30 } });
      this.isLowFps = false;
      const settings = this.videoTrack.getSettings();
      console.log(`摄像头帧率已恢复: ${settings.frameRate}fps`);
    } catch (e) {
      console.warn('无法恢复帧率:', e);
    }
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
