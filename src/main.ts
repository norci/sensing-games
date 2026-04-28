import { PoseDetector } from './core/pose-detector.js';
import { MotionAnalyzer } from './core/motion-analyzer.js';
import { GameEngine, GameState } from './core/game-engine.js';
import { CameraManager } from './core/camera-manager.js';
import { GameLoop } from './core/game-loop.js';
import { getGameMode, IGameMode } from './games/index.js';
import { HUD, HUDConfig } from './ui/hud.js';
import { DEFAULT_BODY_CONFIGS } from './core/types.js';
import { PoseRenderer } from './shared/pose-renderer.js';
import { LandmarkFilter } from './core/landmark-filter.js';
import { SparkEffect } from './core/particle-system.js';
import { PersonPresenceMonitor } from './core/presence-monitor.js';

class GameApp {
  // 核心模块
  private cameraMgr: CameraManager;
  private detector: PoseDetector;
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
  private prevFiltered: any[] | null = null;
  private partConfigs: typeof DEFAULT_BODY_CONFIGS;
  private landmarkFilter: LandmarkFilter;
  private sparkEffect: SparkEffect;
  private hasEverDetected = false;

  constructor() {
    const video = document.getElementById('video') as HTMLVideoElement;
    const gameCanvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    const webglCanvas = document.getElementById('webglCanvas') as HTMLCanvasElement;

    this.cameraMgr = new CameraManager('video', 'cameraPrompt');
    this.detector = new PoseDetector();
    this.partConfigs = DEFAULT_BODY_CONFIGS;
    this.analyzer = new MotionAnalyzer(this.partConfigs);
    this.engine = new GameEngine({ practiceMode: true });
    this.game = getGameMode('fruit-ninja', this.engine)!;
    this.gameCanvas = gameCanvas;
    const hudConfig: HUDConfig = {
      title: '体感水果忍者',
      welcomeSubtitle: '挥动单刀切水果，避开炸弹！',
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
    this.poseRenderer = new PoseRenderer(gameCanvas.getContext('2d')!);
    this.gameLoop = new GameLoop();

    this.landmarkFilter = new LandmarkFilter(this.partConfigs);
    this.sparkEffect = new SparkEffect();

    this.presenceMonitor = new PersonPresenceMonitor({
      delayMs: 3000,
      callbacks: {
        onAbsent: () => this.engine.pause(),
        onPresent: () => {
          this.engine.resume();
          if (!this.hasEverDetected) {
            this.hasEverDetected = true;
          }
        },
        onLowFpsNeeded: () => this.cameraMgr.setLowFps(),
        onNormalFpsNeeded: () => this.cameraMgr.setNormalFps(),
      },
    });

    this.engine.onRestart = () => this.game.restart?.();
    this.game.init(gameCanvas, webglCanvas);

    window.addEventListener('resize', () => {
      this.game?.resize?.();
      this.hud.resize(window.innerWidth, window.innerHeight);
    });
    this.hud.resize(window.innerWidth, window.innerHeight);

    this.gameLoop.onFrame((time: number) => this.gameFrame(time));

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

  private gameFrame(time: number): void {
    const video = this.cameraMgr.getVideoElement();
    if (video.readyState < 2) return;

    // 节流判断：无人时每秒仅一帧做检测，其馀帧仅渲染暂停画面
    if (this.presenceMonitor.isThrottled()) {
      this.renderFrame(null);
      return;
    }

    // 此帧为节流状态中允许检测之帧（每秒一次）
    const result = this.detector.detectForVideo(video, time);
    const landmarks = result?.landmarks?.[0] ?? null;
    this.presenceMonitor.update(landmarks);

    if (!this.presenceMonitor.isPresent) {
      this.latestFiltered = null;
      this.landmarkFilter.reset();
      this.renderFrame(null);
      return;
    }

    const worldLandmarks = result!.worldLandmarks?.[0] ?? result!.landmarks?.[0] ?? [];
    const normLandmarks = result!.landmarks?.[0] ?? [];
    const now = performance.now();
    const filtered = this.landmarkFilter.apply(normLandmarks, now);

    const prev = this.latestFiltered;
    this.latestFiltered = filtered;

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
          const currTip = filtered[cfg.tipIdx];
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

    this.renderFrame(motionResult);
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
