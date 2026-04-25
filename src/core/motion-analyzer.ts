import { BodyPartConfig, BodyPartResult, MotionAnalyzerConfig, MotionResult, Point } from './types.js';

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
      minAngle: 60,
      knockingAngleMax: 30,
      minVelocity: 0.3,
      invertAngleMax: 80,
      invertMinVelocity: 0.1,
      historySize: 3,
      ...config,
    };
  }

  /**
   *  @param worldLandmarks - MediaPipe world landmarks (meters)
   *  @param normLandmarks - MediaPipe normalized landmarks ([0,1])
   */
  analyze(worldLandmarks: any[], normLandmarks?: any[]): MotionResult {
    const norms = normLandmarks || worldLandmarks; // fallback
    const parts: Partial<Record<string, BodyPartResult>> = {};
    let anyBigSwing = false;
    let anyKnocking = false;

    let topHeadWorld: Point | null = null;
    let topHeadNorm: Point | null = null;
    if (worldLandmarks[0] && worldLandmarks[11] && worldLandmarks[12]) {
      topHeadWorld = estimateTopOfHead(worldLandmarks);
    }
    if (norms[0] && norms[11] && norms[12]) {
      topHeadNorm = estimateTopOfHead(norms);
    }

    for (const cfg of this.configs) {
      const result = this.analyzePart(worldLandmarks, norms, cfg, topHeadWorld, topHeadNorm);
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
    const tipNvis = normLandmarks[cfg.tipIdx];
    const midNvis = normLandmarks[cfg.midIdx];
    const rootNvis = normLandmarks[cfg.rootIdx];
    const visOk = (lm: any) => lm ? (lm.visibility ?? 0) >= 0.5 : true;
    if (!tipW || !midW || !rootW || !visOk(tipNvis) || !visOk(midNvis) || !visOk(rootNvis)) {
      return this.emptyPartResult(cfg.id);
    }

    // --- rendering position: use normalized coords ---
    let tipPos: Point;
    if (cfg.isHead && topHeadNorm) {
      tipPos = topHeadNorm;
    } else {
      tipPos = { x: tipN.x, y: tipN.y };
    }

    // --- velocity: use world coords (meters) ---
    let velX: number, velY: number, velZ: number;
    if (cfg.isHead) {
      // 头顶用绝对坐标（tipIdx == rootIdx == 0，相对坐标恒为0）
      velX = tipW.x ?? 0;
      velY = tipW.y ?? 0;
      velZ = tipW.z ?? 0;
    } else {
      velX = (tipW.x ?? 0) - (rootW.x ?? 0);
      velY = (tipW.y ?? 0) - (rootW.y ?? 0);
      velZ = (tipW.z ?? 0) - (rootW.z ?? 0);
    }
    const velocity = this.calcVelocity(velX, velY, velZ, cfg.id);

    // --- angle: use normalized coords (unit-less) ---
    const angle = this.calcAngle(rootN, midN, tipN);

    const state = this.states.get(cfg.id)!;
    const partMinVel = cfg.minVelocity ?? this.analyzerConfig.minVelocity;

    if (cfg.skipAngle || cfg.isHead) {
      const enterThreshold = partMinVel * 1.2;
      const exitThreshold = partMinVel * 0.8;
      const hasMotion = velocity > (state.isBigSwing ? exitThreshold : enterThreshold);
      state.isBigSwing = hasMotion;

      return {
        id: cfg.id,
        detected: true,
        isBigSwing: hasMotion,
        isKnocking: false,
        velocity,
        angle: 0,
        position: tipPos,
      };
    }

    let isBigSwing: boolean;
    if (cfg.invertAngle) {
      const enterThreshold = partMinVel;
      const exitThreshold = partMinVel * 0.5;
      const hasMotion = velocity > enterThreshold;
      if (state.isBigSwing) {
        isBigSwing = velocity > exitThreshold;
      } else {
        isBigSwing = hasMotion;
      }
    } else {
      const swingEnter = this.analyzerConfig.minAngle + 5;
      const swingExit  = this.analyzerConfig.minAngle - 5;
      const hasMotion = velocity > partMinVel;
      if (state.isBigSwing) {
        isBigSwing = angle > swingExit && hasMotion;
      } else {
        isBigSwing = angle > swingEnter && hasMotion;
      }
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

    const dx = relX - state.lastRelPos.x;
    const dy = relY - state.lastRelPos.y;
    const dz = relZ - state.lastRelZ;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    // 死区：变化小于 Xmm 视为静止（抑 MediaPipe 微颤）
    const velocity = distance < 0.05 ? 0 : distance / dt;

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
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
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
