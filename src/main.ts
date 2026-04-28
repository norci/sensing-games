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
  private gameCanvas: HTMLCanvasElement;  // 存之，以便取 ctx

  // 状态
  private latestFiltered: any[] | null = null;
  private prevFiltered: any[] | null = null;  // 前帧归一化坐标，用于算方向
  private partConfigs: typeof DEFAULT_BODY_CONFIGS;
  private landmarkFilter: LandmarkFilter;
  private sparkEffect: SparkEffect;
  private hasEverDetected = false;   // 是否已成功检测到人（之后暂停方生效）

  constructor() {
    const video = document.getElementById('video') as HTMLVideoElement;
    const gameCanvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    const webglCanvas = document.getElementById('webglCanvas') as HTMLCanvasElement;
    const loading = document.getElementById('loading')!;
    const error = document.getElementById('error')!;
    const errorMessage = document.getElementById('errorMessage')!;

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
    // 自定义 Playing 渲染：显示「斩！」特效
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

    // 初始化滤波器
    this.landmarkFilter = new LandmarkFilter(this.partConfigs);
    this.sparkEffect = new SparkEffect();

    // 设置游戏模式（wiring）
    this.engine.onRestart = () => this.game.restart?.();
    this.game.init(gameCanvas, webglCanvas);

    // 设置 resize
    window.addEventListener('resize', () => {
      this.game?.resize?.();
      this.hud.resize(window.innerWidth, window.innerHeight);
    });
    this.hud.resize(window.innerWidth, window.innerHeight);

    // 摄像头回调
    this.cameraMgr.setCallbacks(
      async () => {
        // 隐藏加载界面
        const loading = document.getElementById('loading');
        if (loading) loading.style.display = 'none';
        await this.initDetector();
        this.startGame();
      },
      (msg: string) => this.showError(msg)
    );

    // 游戏循环
    this.gameLoop.onFrame((time: number) => this.gameFrame(time));

    // 启动（初始降帧，省 CPU）
    this.cameraMgr.setLowFps();
    this.cameraMgr.start();
  }

  private async initDetector(): Promise<void> {
    await this.detector.init();
    console.log('Pose detector initialized');
  }

  private startGame(): void {
    this.engine.start();
    this.gameLoop.start();
  }

  private gameFrame(time: number): void {
    const video = this.cameraMgr.getVideoElement();
    if (video.readyState < 2) return;

    // 先用上帧结果判断（省一次检测）
    const isPersonDetected = this.latestFiltered && this.latestFiltered.length > 0;

    const result = this.detector.detectForVideo(video, time);
    const detected = result && result.worldLandmarks && result.worldLandmarks.length > 0;

    if (!detected) {
      if (isPersonDetected) {
        // 刚失去人，降帧
        this.cameraMgr.setLowFps();
      }
      // 若从未检测到人，不暂停（给 MediaPipe 热身时间）
      if (this.hasEverDetected) {
        this.engine.pause();
      }
      this.latestFiltered = null;
      if (this.hasEverDetected) {
        this.landmarkFilter.reset();
      }
      this.renderFrame(null);
      return;
    }
    // 检测到人
    if (!isPersonDetected) {
      // 刚检测到人，恢复正常帧率
      this.cameraMgr.setNormalFps();
    }
    if (!this.hasEverDetected) {
      console.log('首次检测到人，开始正常游戏逻辑');
    }
    this.hasEverDetected = true;
    this.engine.resume();

    const worldLandmarks = result.worldLandmarks?.[0] ?? result.landmarks?.[0] ?? [];
    const normLandmarks = result.landmarks?.[0] ?? [];
    const now = performance.now();
    // landmarkFilter 和 poseRenderer 仍用归一化坐标渲染
    const filtered = this.landmarkFilter.apply(normLandmarks, now);

    // 保存前帧坐标，用于算方向
    const prev = this.latestFiltered;
    this.latestFiltered = filtered;

    const motionResult = this.analyzer.analyze(worldLandmarks, normLandmarks);

    // 触发火花——速度逾阈值时，即于部位周迸火花（陨石尾迹式）
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (const [id, part] of Object.entries(motionResult.parts)) {
      if (!part || !part.detected || !part.position) continue;
      const cfg = this.partConfigs.find(c => c.id === id);
      const minVel = cfg?.minVelocity ?? 0.3; // 唯逾阈值方迸火花
      if (part.velocity > minVel) {
        const sx = (1 - part.position.x) * w;
        const sy = part.position.y * h;
        // 花量与速度平方成正比
        const count = Math.min(50, Math.max(3, Math.floor(part.velocity * part.velocity * 12)));

        // 算运动方向（用屏显坐标，镜像已含其中）
        let dirX: number | undefined;
        let dirY: number | undefined;
        if (prev && cfg) {
          const currTip = filtered[cfg.tipIdx];
          const prevTip = prev[cfg.tipIdx];
          if (currTip && prevTip) {
            // 屏显坐标：x = (1 - nx) * w, y = ny * h
            // 故 dx_screen = -(currTip.x - prevTip.x) * w
            //    dy_screen = (currTip.y - prevTip.y) * h
            const dx = -(currTip.x - prevTip.x);  // 屏显 x 方向（已镜像）
            const dy =   currTip.y - prevTip.y;   // 屏显 y 方向（无须镜像）
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len > 0.001) {
              dirX = dx / len;
              dirY = dy / len;
            }
          }
        }

        // 传速度于 emit()，以控制粒子初速与散布
        this.sparkEffect.emit(sx, sy, count, dirX, dirY, part.velocity);
      }
    }

    this.engine.resume();
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

    // 火花——须于 pose 之后绘，以免被遮
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

// 启动
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new GameApp());
} else {
  new GameApp();
}
