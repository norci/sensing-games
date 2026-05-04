import { hasKeyJoints } from './pose-utils.js';

export interface PresenceMonitorCallbacks {
  onAbsent: () => void;
  onPresent: () => void;
  onLowFpsNeeded: () => void;
  onNormalFpsNeeded: () => void;
}

export interface PresenceMonitorConfig {
  delayMs?: number;
  visibilityThreshold?: number;
  callbacks: PresenceMonitorCallbacks;
}

export class PersonPresenceMonitor {
  private delayMs: number;
  private visibilityThreshold: number;
  private cb: PresenceMonitorCallbacks;

  private noPersonTimer: number = 0;
  private isPausedLowFps: boolean = false;
  private lastSlowCheck: number = 0;
  private isPersonPresent: boolean = true;
  private absentFrameCount: number = 0;
  private readonly absentThreshold: number = 3;

  constructor(config: PresenceMonitorConfig) {
    this.delayMs = config.delayMs ?? 3000;
    this.visibilityThreshold = config.visibilityThreshold ?? 0.5;
    this.cb = config.callbacks;

    this.noPersonTimer = performance.now();
  }

  update(landmarks: any[] | null): void {
    const now = performance.now();
    const hasBody = landmarks && hasKeyJoints(landmarks, this.visibilityThreshold);

    if (!hasBody) {
      this.absentFrameCount++;
      if (this.isPersonPresent && this.absentFrameCount >= this.absentThreshold) {
        this.isPersonPresent = false;
        this.noPersonTimer = now;
        this.cb.onAbsent();
      }
      if (!this.isPausedLowFps && !this.isPersonPresent && (now - this.noPersonTimer) >= this.delayMs) {
        this.cb.onLowFpsNeeded();
        this.isPausedLowFps = true;
        this.lastSlowCheck = now;
      }
    } else {
      this.absentFrameCount = 0;
      if (!this.isPersonPresent) {
        this.isPersonPresent = true;
        this.cb.onPresent();
      }
      if (this.isPausedLowFps) {
        this.cb.onNormalFpsNeeded();
        this.isPausedLowFps = false;
      }
      this.noPersonTimer = now;
    }
  }

  isThrottled(): boolean {
    if (this.isPersonPresent) return false;
    const now = performance.now();
    if (now - this.lastSlowCheck < 1000) {
      return true;
    }
    this.lastSlowCheck = now;
    return false;
  }

  get isPresent(): boolean {
    return this.isPersonPresent;
  }

  get isPaused(): boolean {
    return this.isPausedLowFps;
  }

  reset(): void {
    this.noPersonTimer = performance.now();
    this.isPausedLowFps = false;
    this.isPersonPresent = false;
    this.lastSlowCheck = 0;
    this.absentFrameCount = this.absentThreshold;
  }
}
