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
  private gameLoop!: GameLoop;
  private gameCanvas: HTMLCanvasElement;
  private presenceMonitor: PersonPresenceMonitor;

  // 状态
  private latestFiltered: any[] | null = null;
  private prevRaw: any[] | null = null;
  private partConfigs: typeof DEFAULT_BODY_CONFIGS;
  private sparkEffect: SparkEffect;

  constructor() {
    const video = document.getElementById('video') as HTMLVideoElement;
    const gameCanvas = document.getElementById('gameCanvas') as HTMLCanvasElement;

    this.cameraMgr = new CameraManager('video', 'cameraPrompt');
    this.detector = new PoseDetector();
    this.filterManager = new FilterManager();
    this.partConfigs = DEFAULT_BODY_CONFIGS;
    this.analyzer = new MotionAnalyzer(this.partConfigs);
    this.engine = new GameEngine({ practiceMode: true });
    this.game = getGameMode('polygon-warrior', this.engine);
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

    this.sparkEffect = new SparkEffect();

    this.presenceMonitor = new PersonPresenceMonitor({
      delayMs: 3000,
      callbacks: {
        onAbsent: () => this.engine.pause(),
        onPresent: () => {
          this.engine.resume();
          this.filterManager.reset();
          this.gameLoop.start();
        },
        onLowFpsNeeded: () => {
          this.cameraMgr.setLowFps();
        },
        onNormalFpsNeeded: async () => {
          await this.cameraMgr.setNormalFps();
          this.gameLoop.updateDetectInterval(1000 / this.cameraMgr.getFps());
        },
      },
    });

    this.engine.onRestart = () => this.game.restart?.();
    this.game.init(gameCanvas);

    window.addEventListener('resize', () => {
      this.game.resize?.();
      this.hud.resize(window.innerWidth, window.innerHeight);
    });
    this.hud.resize(window.innerWidth, window.innerHeight);

    this.cameraMgr.setCallbacks(
      async () => {
        const loading = document.getElementById('loading');
        if (loading) loading.style.display = 'none';
        await this.initDetector();
        this.gameLoop = new GameLoop(1000 / this.cameraMgr.getFps());
        this.gameLoop.onFrame(() => this.renderFrame());
        this.gameLoop.onDetect(() => this.detectFrame());
        this.engine.start();
        this.gameLoop.start();
      },
      (msg: string) => this.showError(msg)
    );

    this.cameraMgr.setLowFps();
    this.cameraMgr.start();
  }

  private async initDetector(): Promise<void> {
    await this.detector.init();
    this.detector.onResult((result) => {
      const rawLandmarks = result.landmarks?.[0] ?? null;
      this.presenceMonitor.update(rawLandmarks);

      if (!this.presenceMonitor.isPresent) {
        this.latestFiltered = null;
        this.prevRaw = null;
        return;
      }

      // worldLandmarks 可能为空（MediaPipe 偶发不返回）
      const rawWorld = result.worldLandmarks?.[0];
      const rawNorm = result.landmarks![0];
      if (!rawWorld) return;

      // 滤波数据仅用于渲染（平滑）
      const filteredResult = this.filterManager.apply(result);
      this.latestFiltered = filteredResult.landmarks![0];

      // 动作分析用原始数据
      const motionResult = this.analyzer.analyze(rawWorld, rawNorm);

      // 火花方向用原始数据
      const w = window.innerWidth;
      const h = window.innerHeight;
      const prev = this.prevRaw;
      this.prevRaw = rawNorm;

      for (const [id, part] of Object.entries(motionResult.parts)) {
        if (!part || !part.detected || !part.position) continue;
        const cfg = this.partConfigs.find(c => c.id === id)!;
        const minVel = cfg.minVelocity ?? 0.3;
        if (part.velocity > minVel) {
          const sx = (1 - part.position.x) * w;
          const sy = part.position.y * h;
          const count = Math.min(50, Math.max(3, Math.floor(part.velocity * part.velocity * 12)));
          let dirX: number | undefined;
          let dirY: number | undefined;
          if (prev) {
            const currTip = rawNorm[cfg.tipIdx];
            const prevTip = prev[cfg.tipIdx];
            if (currTip && prevTip) {
              const dx = -(currTip.x - prevTip.x);
              const dy = currTip.y - prevTip.y;
              const len = Math.hypot(dx, dy);
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
    });
  }

  private detectFrame(): void {
    if (this.presenceMonitor.isThrottled()) return;
    const video = this.cameraMgr.getVideoElement();
    if (video.readyState < 2) return;
    this.detector.feedFrame(video);
  }

  private renderFrame(): void {
    if (this.engine.getState() === GameState.PLAYING) {
      this.game.tick();
    }
    this.game.render();

    if (this.latestFiltered) {
      this.poseRenderer.render(this.latestFiltered, window.innerWidth, window.innerHeight);
      this.poseRenderer.renderPartHighlight(this.latestFiltered, window.innerWidth, window.innerHeight);
    }

    this.sparkEffect.update();
    const ctx = this.gameCanvas.getContext('2d')!;
    this.sparkEffect.render(ctx);

    this.hud.render(this.engine);
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
