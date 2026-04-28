import { FilesetResolver, PoseLandmarker, PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { getWasmPath } from '../shared/network-utils.js';

export interface PoseDetectorConfig {
  modelPath?: string;
  wasmPath?: string;
  delegate?: 'CPU' | 'GPU';
  runningMode?: 'IMAGE' | 'VIDEO' | 'LIVE_STREAM';
  numPoses?: number;
  outputWorldLandmarks?: boolean;
}

export class PoseDetector {
  private landmarker: PoseLandmarker | null = null;
  private isInitialized = false;
  private onPoseDetected?: (result: PoseLandmarkerResult) => void;
  private config: Required<PoseDetectorConfig>;
  private lastTs = 0; // 时间戳单调递增保护

  constructor(config?: PoseDetectorConfig) {
    this.config = {
      modelPath: '/models/pose_landmarker_lite.task',
      wasmPath: getWasmPath(),
      delegate: this.isMobile() ? 'CPU' : 'GPU',
      runningMode: 'VIDEO',
      numPoses: 1,
      outputWorldLandmarks: true,
      ...config
    };
  }

  private isMobile(): boolean {
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  }

  async init(): Promise<void> {
    try {
      const vision = await FilesetResolver.forVisionTasks(this.config.wasmPath!);
      this.landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: this.config.modelPath!,
          delegate: this.config.delegate
        },
        runningMode: 'VIDEO',
        numPoses: this.config.numPoses!,
        outputSegmentationMasks: false,
        minPoseDetectionConfidence: 0.7,   // 提高检测置信度，减少误检
        minTrackingConfidence: 0.7,
      });
      this.isInitialized = true;
      console.log(`PoseDetector initialized with ${this.config.delegate} delegate`);
    } catch (error) {
      console.error('Failed to initialize PoseDetector:', error);
      throw error;
    }
  }

  /**
   * 时间戳单调递增保护：
   * MediaPipe 要求时间戳严格递增。applyConstraints 改变帧率後易出现 timestamp mismatch。
   * 此处用 performance.now() 产生单调递增微秒时间戳，不依赖视频时间戳。
   */
  detectForVideo(video: HTMLVideoElement, _videoTs: number): PoseLandmarkerResult | null {
    if (!this.isInitialized || !this.landmarker) return null;

    // 用 performance.now() 产生单调递增微秒时间戳
    const nowUs = Math.floor(performance.now() * 1000);
    const safeTs = Math.max(nowUs, this.lastTs + 1);
    this.lastTs = safeTs;

    try {
      const result = this.landmarker.detectForVideo(video, safeTs);
      return result;
    } catch (error) {
      console.error('Pose detection error:', error);
      return null;
    }
  }

  setCallback(callback: (result: PoseLandmarkerResult) => void): void {
    this.onPoseDetected = callback;
  }

  destroy(): void {
    if (this.landmarker) {
      this.landmarker.close();
      this.landmarker = null;
      this.isInitialized = false;
      this.lastTs = 0;
    }
  }
}
