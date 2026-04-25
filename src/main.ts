import { PoseDetector } from './core/pose-detector.js';
import { SwingAnalyzer } from './core/swing-analyzer.js';
import { GameEngine, GameState } from './core/game-engine.js';
import { getGameMode, IGameMode } from './games/index.js';
import { HUD } from './ui/hud.js';
import { SwingResult } from './types/swing.js';
import { PoseRenderer } from './shared/pose-renderer.js';

class GameApp {
  private video: HTMLVideoElement;
  private gameCanvas: HTMLCanvasElement;
  private webglCanvas: HTMLCanvasElement;
  private loading: HTMLElement;
  private error: HTMLElement;
  private errorMessage: HTMLElement;
  private cameraPrompt: HTMLElement;
  private status: HTMLElement;
  private gameCtx: CanvasRenderingContext2D;

  private poseDetector: PoseDetector;
  private swingAnalyzer: SwingAnalyzer;
  private gameEngine: GameEngine;
  private fruitNinjaGame: IGameMode | null;
  private hud: HUD;
  private poseRenderer: PoseRenderer | null = null;

  private isRunning = false;
  private lastVideoTime = -1;
  private latestLandmarks: any[] | null = null;
  private smoothedLandmarks: any[] | null = null;
  private readonly LANDMARK_ALPHA = 0.5;

  constructor() {
    this.video = document.getElementById('video') as HTMLVideoElement;
    this.gameCanvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    this.webglCanvas = document.getElementById('webglCanvas') as HTMLCanvasElement;
    this.loading = document.getElementById('loading')!;
    this.error = document.getElementById('error')!;
    this.errorMessage = document.getElementById('errorMessage')!;
    this.cameraPrompt = document.getElementById('cameraPrompt')!;
    this.status = document.getElementById('status')!;
    this.gameCtx = this.gameCanvas.getContext('2d')!;

    this.poseDetector = new PoseDetector();
    this.swingAnalyzer = new SwingAnalyzer();
    // 默认启用练习模式（无失败）
    this.gameEngine = new GameEngine({ practiceMode: true });
    const gameMode = getGameMode('fruit-ninja', this.gameEngine);
    this.fruitNinjaGame = gameMode;
    this.hud = new HUD(this.gameCanvas);
    this.poseRenderer = new PoseRenderer(this.gameCtx);

    if (this.fruitNinjaGame) {
      this.gameEngine.setGameMode(this.fruitNinjaGame);
    }

    this.init();
  }

  private async init(): Promise<void> {
    try {
      // 初始化姿态检测器
      await this.poseDetector.init();

      // 初始化游戏
      if (this.fruitNinjaGame) {
        this.fruitNinjaGame.init(this.gameCanvas, this.webglCanvas);
      }

      // 设置窗口大小变化监听
      this.setupResizeListener();

      // 启动摄像头
      await this.setupCamera();

      // 隐藏加载界面
      this.loading.style.display = 'none';

      // 开始游戏循环
      this.gameEngine.start();
      this.isRunning = true;
      this.gameLoop();

    } catch (err) {
      console.error('Initialization failed:', err);
      this.showError(err instanceof Error ? err.message : String(err));
    }
  }

  private setupResizeListener(): void {
    const handleResize = () => {
      this.fruitNinjaGame?.resize?.();
      this.hud.resize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    // 初始调用一次
    handleResize();
  }

  private async setupCamera(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });

      this.video.srcObject = stream;

      return new Promise((resolve) => {
        this.video.onloadedmetadata = () => {
          this.video.play();
          resolve();
        };
      });

    } catch (err) {
      console.error('Camera access denied:', err);
      this.cameraPrompt.style.display = 'block';

      // 用户点击启用摄像头按钮
      document.getElementById('enableCamera')!.onclick = async () => {
        this.cameraPrompt.style.display = 'none';
        await this.setupCamera();
      };

      throw new Error('摄像头访问被拒绝');
    }
  }

  private smoothLandmarks(raw: any[]): any[] {
    if (!this.smoothedLandmarks) {
      this.smoothedLandmarks = raw.map(p => ({ ...p }));
      return this.smoothedLandmarks;
    }
    const alpha = this.LANDMARK_ALPHA;
    for (let i = 0; i < raw.length; i++) {
      this.smoothedLandmarks[i].x =
        this.smoothedLandmarks[i].x * (1 - alpha) + raw[i].x * alpha;
      this.smoothedLandmarks[i].y =
        this.smoothedLandmarks[i].y * (1 - alpha) + raw[i].y * alpha;
      if (raw[i].z != null) {
        this.smoothedLandmarks[i].z =
          this.smoothedLandmarks[i].z * (1 - alpha) + raw[i].z * alpha;
      }
    }
    return this.smoothedLandmarks;
  }

  private gameLoop(): void {
    if (!this.isRunning) return;

    let swingResult: SwingResult | null = null;
    let landmarks: any[] | null = null;

    // 检测姿态
    if (this.video.readyState >= 2 && this.video.currentTime !== this.lastVideoTime) {
      const result = this.poseDetector.detectForVideo(this.video, performance.now());

      if (result && result.landmarks && result.landmarks.length > 0) {
        landmarks = result.landmarks[0];
        // EMA 平滑 landmark，消除抖动
        landmarks = this.smoothLandmarks(landmarks);
        this.latestLandmarks = landmarks;

        // 分析挥刀动作
        swingResult = this.swingAnalyzer.analyze(landmarks);

        // 更新游戏状态
        this.gameEngine.update(swingResult);

        // 更新状态显示
        this.updateStatus(swingResult);
      } else {
        // 检测失败，重置平滑状态
        this.smoothedLandmarks = null;
      }

      this.lastVideoTime = this.video.currentTime;
    }

    // 渲染游戏
    if (this.fruitNinjaGame) {
      this.fruitNinjaGame.render();
    }

    // 渲染姿势骨架（叠加在游戏画面上）
    if (this.latestLandmarks && this.poseRenderer) {
      this.poseRenderer.render(this.latestLandmarks, this.gameCanvas.width, this.gameCanvas.height);
      this.poseRenderer.renderWristHighlight(this.latestLandmarks, this.gameCanvas.width, this.gameCanvas.height);
    }

    // 渲染HUD（传递 swingResult 以显示挥刀反馈，null 转为 undefined）
    this.hud.render(this.gameEngine, swingResult || undefined);

    requestAnimationFrame(() => this.gameLoop());
  }

  private updateStatus(swingResult: any): void {
    const leftSwing = swingResult.leftHand?.isBigSwing ? '左手✓' : '';
    const rightSwing = swingResult.rightHand?.isBigSwing ? '右手✓' : '';
    const handStatus = [leftSwing, rightSwing].filter(Boolean).join(' ');

    if (swingResult.isBigSwing) {
      this.status.textContent = `挥刀! ${handStatus} 速度: ${swingResult.velocity.toFixed(2)}, 角度: ${swingResult.angle.toFixed(1)}°`;
      this.status.style.color = '#00ff00';
    } else if (swingResult.isKnocking) {
      this.status.textContent = `敲击（无效）${handStatus}`;
      this.status.style.color = '#ff6600';
    } else {
      this.status.textContent = `待机中... 速度: ${swingResult.velocity.toFixed(2)}`;
      this.status.style.color = '#666';
    }
  }

  private showError(message: string): void {
    this.loading.style.display = 'none';
    this.error.style.display = 'block';
    this.errorMessage.textContent = message;
  }
}

// 全局错误处理
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  const errorDiv = document.getElementById('error');
  const errorMsg = document.getElementById('errorMessage');
  if (errorDiv && errorMsg) {
    errorDiv.style.display = 'block';
    errorMsg.textContent = event.error?.message || String(event.error);
  }
});

// 启动应用
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new GameApp());
} else {
  new GameApp();
}
