import { hasKeyJoints } from './pose-utils.js';

/**
 * 人体存在监控器 — 封装无人检测、暂停、降帧节流逻辑
 *
 * 用法：
 *   const monitor = new PersonPresenceMonitor({
 *     delayMs: 3000,
 *     callbacks: {
 *       onAbsent: () => engine.pause(),   // 无人立即暂停（显示暂停画面）
 *       onPresent: () => engine.resume(),  // 有人立即恢复
 *       onLowFpsNeeded: () => cameraMgr.setLowFps(),  // 无人延迟 N ms 後降帧
 *       onNormalFpsNeeded: () => cameraMgr.setNormalFps(),
 *     },
 *   });
 *
 *   // 在 gameFrame 开头
 *   if (monitor.isThrottled()) { renderFrame(null); return; }
 *
 *   // 检测後
 *   monitor.update(result?.landmarks?.[0] ?? null);
 *
 *   if (!monitor.isPresent) return;  // 无人，仅渲染暂停画面
 *
 *   // 以下为游戏独有逻辑
 */
export interface PresenceMonitorCallbacks {
  onAbsent: () => void;
  onPresent: () => void;
  onLowFpsNeeded: () => void;
  onNormalFpsNeeded: () => void;
}

export interface PresenceMonitorConfig {
  delayMs?: number;               // 无人延迟毫秒数（仅用于降帧，暂停立即生效），默认 3000
  visibilityThreshold?: number;    // 关键关节可见阈值，默认 0.5
  callbacks: PresenceMonitorCallbacks;
}

export class PersonPresenceMonitor {
  private delayMs: number;
  private visibilityThreshold: number;
  private cb: PresenceMonitorCallbacks;

  private noPersonTimer: number = 0;
  private isPausedLowFps: boolean = false;
  private lastSlowCheck: number = 0;
  private isPersonPresent: boolean = true;  // 初始假设有人，使首次无人时立即触发 onAbsent

  constructor(config: PresenceMonitorConfig) {
    this.delayMs = config.delayMs ?? 3000;
    this.visibilityThreshold = config.visibilityThreshold ?? 0.5;
    this.cb = config.callbacks;

    // 初始假设无人，计时器设为当前时间
    this.noPersonTimer = performance.now();
  }

  /**
   * 更新检测结果，驱动状态机
   * @param landmarks 当前帧的归一化 landmarks（result.landmarks[0]），可为 null
   *
   * 行为：
   *   - 无人时立即触发 onAbsent（显示暂停画面）
   *   - 有人时立即触发 onPresent（恢复游戏）
   *   - 无人持续 delayMs 後触发 onLowFpsNeeded（降帧省 CPU）
   *   - 有人时立即触发 onNormalFpsNeeded（恢复帧率）
   */
  update(landmarks: any[] | null): void {
    const now = performance.now();
    const hasBody = landmarks && hasKeyJoints(landmarks, this.visibilityThreshold);

    if (!hasBody) {
      // 无人
      if (this.isPersonPresent) {
        // 刚丢失人体：立即暂停（显示暂停画面），并开始计时（用于降帧延迟）
        this.isPersonPresent = false;
        this.noPersonTimer = now;
        this.cb.onAbsent();
      }
      // 延迟降帧（省 CPU）
      if (!this.isPausedLowFps && (now - this.noPersonTimer) >= this.delayMs) {
        this.cb.onLowFpsNeeded();
        this.isPausedLowFps = true;
        this.lastSlowCheck = now;
      }
    } else {
      // 有人
      if (!this.isPersonPresent) {
        // 刚检测到人体：立即恢复
        this.isPersonPresent = true;
        this.cb.onPresent();
      }
      if (this.isPausedLowFps) {
        // 恢复帧率
        this.cb.onNormalFpsNeeded();
        this.isPausedLowFps = false;
      }
      // 重置计时器（用于下次丢失人体时）
      this.noPersonTimer = now;
    }
  }

  /**
   * 游戏循环调用：若当前无人且未到检测时刻，返回 true
   * 调用者应跳过重处理逻辑，仅渲染暂停画面
   * 此函数内部会在适当时机调用 update()（通过 shouldDetect()）
   *
   * 行为：
   *   - 无人时立即返回 true（暂停画面，1fps 节流）
   *   - 1 秒後降帧（摄像头）
   *   - 节流状态下仍每秒允许一次检测（通过返回 false 一帧）
   */
  isThrottled(): boolean {
    if (this.isPersonPresent) return false;
    // 无人：立即节流至 1fps
    const now = performance.now();
    if (now - this.lastSlowCheck < 1000) {
      return true;
    }
    this.lastSlowCheck = now;
    return false; // 此帧允许检测
  }

  /** 当前是否检测到人体 */
  get isPresent(): boolean {
    return this.isPersonPresent;
  }

  /** 当前是否因无人而降帧暂停 */
  get isPaused(): boolean {
    return this.isPausedLowFps;
  }

  /** 重置状态（切换游戏模式时调用） */
  reset(): void {
    this.noPersonTimer = performance.now();
    this.isPausedLowFps = false;
    this.isPersonPresent = false;
    this.lastSlowCheck = 0;
  }
}
