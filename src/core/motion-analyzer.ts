import { BodyPartConfig, BodyPartResult, MotionAnalyzerConfig, MotionResult, Point, DEFAULT_MOTION_ANALYZER_CONFIG } from './types.js';

/** 单个部位的分析状态 */
interface PartState {
  lastRelPos: Point | null;  // 相对根关节的位置（米，世界坐标系）
  lastRelZ: number | null;    // 相对根关节的 z（米）
  lastTimestamp: number;
  velocityHistory: number[];
  isBigSwing: boolean;
}

/** 估算头顶坐标（鼻子 + 肩膀向量延伸） */
export function estimateTopOfHead(landmarks: any[]): Point {
  // 直接用鼻尖（landmark 0），非估算头顶
  const nose = landmarks[0];
  return { x: nose.x, y: nose.y };
}

export class MotionAnalyzer {
  private readonly configs: BodyPartConfig[];
  private readonly states: Map<string, PartState> = new Map();
  private readonly analyzerConfig: Required<MotionAnalyzerConfig>;

  constructor(
    configs: BodyPartConfig[] = [],
    config?: Partial<MotionAnalyzerConfig>
  ) {
    this.configs = configs;
    for (const c of configs) {
      this.states.set(c.id, {
        lastRelPos: null,
        lastRelZ: null,
        lastTimestamp: 0,
        velocityHistory: [],
        isBigSwing: false,
      });
    }
    this.analyzerConfig = {
      ...DEFAULT_MOTION_ANALYZER_CONFIG,
      ...config,
    };
  }

  /**
   *  @param worldLandmarks - MediaPipe world landmarks (meters)
   *  @param normLandmarks - MediaPipe normalized landmarks ([0,1])
   */
  analyze(worldLandmarks: any[], normLandmarks: any[]): MotionResult {
    const parts: Partial<Record<string, BodyPartResult>> = {};
    let anyBigSwing = false;
    let anyKnocking = false;

    let topHeadWorld: Point | null = null;
    let topHeadNorm: Point | null = null;
    if (worldLandmarks[0] && worldLandmarks[11] && worldLandmarks[12]) {
      topHeadWorld = estimateTopOfHead(worldLandmarks);
    }
    if (normLandmarks[0] && normLandmarks[11] && normLandmarks[12]) {
      topHeadNorm = estimateTopOfHead(normLandmarks);
    }

    for (const cfg of this.configs) {
      const result = this.analyzePart(worldLandmarks, normLandmarks, cfg, topHeadWorld, topHeadNorm);
      parts[cfg.id] = result;
      if (result.isBigSwing) anyBigSwing = true;
      if (result.isKnocking) anyKnocking = true;
    }

    return {
      parts,
      isBigSwing: anyBigSwing,
      isKnocking: anyKnocking,
      timestamp: performance.now(),
    };
  }

  private analyzePart(
    worldLandmarks: any[],
    normLandmarks: any[],
    cfg: BodyPartConfig,
    topHeadWorld: Point | null,
    topHeadNorm: Point | null,
  ): BodyPartResult {
    // --- landmarks (world = meters, norm = [0,1]) ---
    const tipW = worldLandmarks[cfg.tipIdx];
    const midW = worldLandmarks[cfg.midIdx];
    const rootW = worldLandmarks[cfg.rootIdx];
    const tipN = normLandmarks[cfg.tipIdx];
    const midN = normLandmarks[cfg.midIdx];
    const rootN = normLandmarks[cfg.rootIdx];

    // visibility 唯 normLandmarks 有之，worldLandmarks 无此字段
    const visOk = (lm: any) => !lm || (lm.visibility ?? 0) >= 0.5;
    if (!tipW || !midW || !rootW || !visOk(tipN) || !visOk(midN) || !visOk(rootN)) {
      return this.emptyPartResult(cfg.id);
    }

    // --- rendering position: use normalized coords ---
    const tipPos = (cfg.isHead && topHeadNorm)
      ? topHeadNorm
      : { x: tipN.x, y: tipN.y };

    // --- velocity: use world coords (meters) ---
    const dx = (tipW.x ?? 0) - (cfg.isHead ? 0 : rootW.x ?? 0);
    const dy = (tipW.y ?? 0) - (cfg.isHead ? 0 : rootW.y ?? 0);
    const dz = (tipW.z ?? 0) - (cfg.isHead ? 0 : rootW.z ?? 0);
    const velocity = this.calcVelocity(dx, dy, dz, cfg.id);

    // --- angle: use normalized coords (unit-less) ---
    const angle = this.calcAngle(rootN, midN, tipN);

    const state = this.states.get(cfg.id)!;
    const partMinVel = cfg.minVelocity ?? this.analyzerConfig.minVelocity;

    if (cfg.skipAngle || cfg.isHead) {
      const enterThreshold = partMinVel * 1.2;
      const exitThreshold = partMinVel * 0.8;
      state.isBigSwing = velocity > (state.isBigSwing ? exitThreshold : enterThreshold);

      return {
        id: cfg.id,
        detected: true,
        isBigSwing: state.isBigSwing,
        isKnocking: false,
        velocity,
        angle: 0,
        position: tipPos,
      };
    }

    let isBigSwing: boolean;
    if (cfg.invertAngle) {
      const exitThreshold = partMinVel * 0.5;
      isBigSwing = velocity > (state.isBigSwing ? exitThreshold : partMinVel);
    } else {
      const swingEnter = this.analyzerConfig.minAngle + 5;
      const swingExit  = this.analyzerConfig.minAngle - 5;
      const angleThreshold = state.isBigSwing ? swingExit : swingEnter;
      isBigSwing = angle > angleThreshold && velocity > partMinVel;
    }

    state.isBigSwing = isBigSwing;
    const isKnocking = angle < this.analyzerConfig.knockingAngleMax;

    return {
      id: cfg.id,
      detected: true,
      isBigSwing,
      isKnocking,
      velocity,
      angle,
      position: tipPos,
    };
  }

  private calcVelocity(
    relX: number,
    relY: number,
    relZ: number,
    partId: string,
  ): number {
    const state = this.states.get(partId)!;

    if (!state.lastRelPos || state.lastRelZ === null || state.lastTimestamp === 0) {
      state.lastRelPos = { x: relX, y: relY };
      state.lastRelZ = relZ;
      state.lastTimestamp = performance.now();
      return 0;
    }

    const dt = (performance.now() - state.lastTimestamp) / 1000;
    if (dt === 0) return 0;

    const velocity = Math.hypot(
      relX - state.lastRelPos.x,
      relY - state.lastRelPos.y,
      relZ - state.lastRelZ,
    ) / dt;

    state.velocityHistory.push(velocity);
    if (state.velocityHistory.length > this.analyzerConfig.historySize) {
      state.velocityHistory.shift();
    }

    state.lastRelPos = { x: relX, y: relY };
    state.lastRelZ = relZ;
    state.lastTimestamp = performance.now();

    return state.velocityHistory.reduce((a, b) => a + b, 0) / state.velocityHistory.length;
  }

  private calcAngle(root: any, mid: any, tip: any): number {
    const v1 = { x: root.x - mid.x, y: root.y - mid.y };
    const v2 = { x: tip.x - mid.x, y: tip.y - mid.y };
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.hypot(v1.x, v1.y);
    const mag2 = Math.hypot(v2.x, v2.y);
    if (mag1 === 0 || mag2 === 0) return 0;
    const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
    return Math.acos(cosAngle) * 180 / Math.PI;
  }

  private emptyPartResult(id: string): BodyPartResult {
    return {
      id: id as any,
      detected: false,
      isBigSwing: false,
      isKnocking: false,
      velocity: 0,
      angle: 0,
      position: { x: 0, y: 0 },
    };
  }

  reset(): void {
    for (const state of this.states.values()) {
      state.lastRelPos = null;
      state.lastRelZ = null;
      state.lastTimestamp = 0;
      state.velocityHistory = [];
      state.isBigSwing = false;
    }
  }
}
