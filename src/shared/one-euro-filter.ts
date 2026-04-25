/**
 * OneEuroFilter（一欧元滤波器）
 * 自适应低通滤波：慢速时强平滑，快速时低延迟
 * 比固定 α 的 EMA 更适合姿态 landmark 平滑
 *
 * 参考：Casiez et al., "1€ Filter: A Simple Speed-based Low-pass Filter for Noisy Input"
 */
export class OneEuroFilter {
  private freq: number;       // 采样频率（默认 60fps）
  private minCutoff: number;   // 最小截止频率（慢速时的平滑强度）
  private beta: number;        // 速度增益（越大则快速时越不平滑）
  private dCutoff: number;     // 导数截止频率

  private lastValue: number | null = null;
  private lastDerivative: number | null = null;
  private lastTime: number = 0;

  constructor(
    freq = 60,
    minCutoff = 1.0,
    beta = 0.0,
    dCutoff = 1.0
  ) {
    this.freq = freq;
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  /** 复位滤波器状态 */
  reset(): void {
    this.lastValue = null;
    this.lastDerivative = null;
    this.lastTime = 0;
  }

  /** 滤波一维数值，返回平滑后的值 */
  filter(value: number, timestamp?: number): number {
    const t = timestamp ?? performance.now();

    if (this.lastValue === null) {
      this.lastValue = value;
      this.lastDerivative = null;
      this.lastTime = t;
      return value;
    }

    // 实际采样频率
    const dt = (t - this.lastTime) / 1000;
    const freq = dt > 0 ? 1 / dt : this.freq;

    // 计算导数（速度）
    const derivative = (value - this.lastValue) * freq;
    if (this.lastDerivative === null) {
      this.lastDerivative = derivative;
    }

    // 对导数也做低通滤波
    const alphaD = this.smoothingFactor(this.dCutoff, freq);
    const smoothedDerivative =
      this.lastDerivative * (1 - alphaD) + derivative * alphaD;

    // 自适应截止频率：运动越快，截止频率越高 → 延迟越低
    const cutoff = this.minCutoff + this.beta * Math.abs(smoothedDerivative);
    const alpha = this.smoothingFactor(cutoff, freq);

    // 对原始值滤波
    const smoothedValue =
      this.lastValue * (1 - alpha) + value * alpha;

    this.lastValue = smoothedValue;
    this.lastDerivative = smoothedDerivative;
    this.lastTime = t;

    return smoothedValue;
  }

  private smoothingFactor(cutoff: number, freq: number): number {
    const te = 1 / freq;
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / te);
  }
}
