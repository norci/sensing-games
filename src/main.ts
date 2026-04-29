import { PoseDetector } from './core/pose-detector.js';
import { MotionAnalyzer } from './core/motion-analyzer.js';
import { GameEngine, GameState } from './core/game-engine.js';
import { CameraManager } from './core/camera-manager.js';
import { GameLoop } from './core/game-loop.js';
import { getGameMode, IGameMode } from './games/index.js';
import { HUD, HUDConfig } from './ui/hud.js';
import { DEFAULT_BODY_CONFIGS } from './core/types.js';
import { PoseRenderer } from './shared/pose-renderer.js';
import { SparkEffect } from './core/particle-system.js';
import { PersonPresenceMonitor } from './core/presence-monitor.js';
import { FilterManager } from './core/filter-manager.js';

class GameApp {
  // 核心模块
  private cameraMgr: CameraManager;
  private detector: PoseDetector;
  private filterManager: FilterManager;
  private analyzer: MotionAnalyzer;
  private engine: GameEngine;
  private game: IGameMode;
  private hud: HUD;
  private poseRenderer: PoseRenderer;
  private gameLoop: GameLoop;
  private gameCanvas: HTMLCanvasElement;
  private presenceMonitor: PersonPresenceMonitor;

  // 状态
  private latestFiltered: any[] | null = null;
  private partConfigs: typeof DEFAULT_BODY_CONFIGS;
  private sparkEffect: SparkEffect;
  private hasEverDetected = false;

  constructor() {
    const video = document.getElementById('video') as HTMLVideoElement;
    const gameCanvas = document.getElementById('gameCanvas') as HTMLCanvasElement;

    this.cameraMgr = new CameraManager('video', 'cameraPrompt');
    this.detector = new PoseDetector();
    this.filterManager = new FilterManager();
    this.partConfigs = DEFAULT_BODY_CONFIGS;
    this.analyzer = new MotionAnalyzer(this.partConfigs);
    this.engine = new GameEngine({ practiceMode: true });
    this.game = getGameMode('polygon-warrior', this.engine)!;
    this.gameCanvas = gameCanvas;
    const hudConfig: HUDConfig = {
      title: '多边形战士',
      welcomeSubtitle: '挥动肢体切多边形，避开炸弹！',
      welcomePrompt: '请用右手大幅度挥刀开始游戏',
      pausedText: '暂停',
      pausedPrompt: '未检测到人体，请站到摄像头前',
      gameOverTitle: '游戏结束',
      scorePrefix: '最终得分: ',
      restartPrompt: '5秒后重新开始...',
    };
    this.hud = new HUD(gameCanvas, hudConfig);
    this.hud.setCustomRender((ctx, engine) => {
      const sliceInfo = engine.getLastSliceInfo();
      const timeSinceSlice = Date.now() - sliceInfo.time;
      if (sliceInfo.time > 0 && timeSinceSlice < 300) {
        const alpha = 1 - timeSinceSlice / 300;
        ctx.fillStyle = `rgba(0, 255, 136, ${alpha})`;
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('斩！', sliceInfo.pos.x, sliceInfo.pos.y - 30);
      }
    });
    this.poseRenderer = new PoseRenderer(gameCanvas.getContext('2d')!, video);
    this.gameLoop = new GameLoop();

    this.sparkEffect = new SparkEffect();

    this.presenceMonitor = new PersonPresenceMonitor({
      delayMs: 3000,
      callbacks: {
        onAbsent: () => this.engine.pause(),
        onPresent: () => {
          this.engine.resume();
          this.filterManager.reset();
          if (!this.hasEverDetected) {
            this.hasEverDetected = true;
          }
        },
        onLowFpsNeeded: () => this.cameraMgr.setLowFps(),
        onNormalFpsNeeded: () => this.cameraMgr.setNormalFps(),
      },
    });

    this.engine.onRestart = () => this.game.restart?.();
    this.game.init(gameCanvas);

    window.addEventListener('resize', () => {
      this.game?.resize?.();
      this.hud.resize(window.innerWidth, window.innerHeight);
    });
    this.hud.resize(window.innerWidth, window.innerHeight);

    this.gameLoop.onFrame((time: number) => this.renderFrame(time));
    this.gameLoop.onDetect((time: number) => this.detectFrame(time));

    this.cameraMgr.setCallbacks(
      async () => {
        const loading = document.getElementById('loading');
        if (loading) loading.style.display = 'none';
        await this.initDetector();
        this.startGame();
      },
      (msg: string) => this.showError(msg)
    );

    this.cameraMgr.setLowFps();
    this.cameraMgr.start();
  }

  private async initDetector(): Promise<void> {
    await this.detector.init();
  }

  private startGame(): void {
    this.engine.start();
    this.gameLoop.start();
  }

  private detectFrame(time: number): void {
    const video = this.cameraMgr.getVideoElement();
    if (video.readyState < 2) return;

    if (this.presenceMonitor.isThrottled()) {
      return;
    }

    const result = this.detector.detectForVideo(video, time);
    if (!result) return;

    // 应用滤波器（含速度计算与自适应 IIR）
    const filteredResult = this.filterManager.apply(result);

    const landmarks = filteredResult.landmarks?.[0] ?? null;
    this.presenceMonitor.update(landmarks);

    if (!this.presenceMonitor.isPresent) {
      this.latestFiltered = null;
      return;
    }

    const worldLandmarks = filteredResult.worldLandmarks?.[0] ?? [];
    const normLandmarks = filteredResult.landmarks?.[0] ?? [];

    const prev = this.latestFiltered;
    this.latestFiltered = normLandmarks;

    const motionResult = this.analyzer.analyze(worldLandmarks, normLandmarks);

    const w = window.innerWidth;
    const h = window.innerHeight;
    for (const [id, part] of Object.entries(motionResult.parts)) {
      if (!part || !part.detected || !part.position) continue;
      const cfg = this.partConfigs.find(c => c.id === id);
      const minVel = cfg?.minVelocity ?? 0.3;
      if (part.velocity > minVel) {
        const sx = (1 - part.position.x) * w;
        const sy = part.position.y * h;
        const count = Math.min(50, Math.max(3, Math.floor(part.velocity * part.velocity * 12)));

        let dirX: number | undefined;
        let dirY: number | undefined;
        if (prev && cfg) {
          const currTip = normLandmarks[cfg.tipIdx];
          const prevTip = prev[cfg.tipIdx];
          if (currTip && prevTip) {
            const dx = -(currTip.x - prevTip.x);
            const dy =   currTip.y - prevTip.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len > 0.001) {
              dirX = dx / len;
              dirY = dy / len;
            }
          }
        }
        this.sparkEffect.emit(sx, sy, count, dirX, dirY, part.velocity);
      }
    }

    if (this.engine.getState() === GameState.PLAYING) {
      this.game.update(motionResult);
    }
  }

  private renderFrame(motionResult: any): void {
    if (this.game) this.game.render();

    if (this.latestFiltered && this.poseRenderer) {
      this.poseRenderer.render(this.latestFiltered, window.innerWidth, window.innerHeight);
      this.poseRenderer.renderPartHighlight(this.latestFiltered, window.innerWidth, window.innerHeight);
    }

    this.sparkEffect.update();
    const ctx = this.gameCanvas.getContext('2d');
    if (ctx) this.sparkEffect.render(ctx);

    this.hud.render(this.engine, motionResult || undefined);
  }

  private showError(message: string): void {
    const loading = document.getElementById('loading')!;
    const error = document.getElementById('error')!;
    const errorMessage = document.getElementById('errorMessage')!;
    loading.style.display = 'none';
    error.style.display = 'block';
    errorMessage.textContent = message;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new GameApp());
} else {
  new GameApp();
}
