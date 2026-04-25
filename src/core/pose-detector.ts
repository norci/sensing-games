import { FilesetResolver, PoseLandmarker, PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { getWasmPath } from '../shared/network-utils.js';

export interface PoseDetectorConfig {
  modelPath?: string;
  wasmPath?: string;
  delegate?: 'CPU' | 'GPU';
  runningMode?: 'IMAGE' | 'VIDEO' | 'LIVE_STREAM';
  numPoses?: number;
  /**
   * 是否输出世界坐标系 landmark（单位：米，原点在髋中心）
   * 注意：根据 MediaPipe 类型定义，worldLandmarks 始终包含在结果中，
   * 此配置项仅用于内部标记，不影响 API 调用
   */
  outputWorldLandmarks?: boolean;
}

export class PoseDetector {
  private landmarker: PoseLandmarker | null = null;
  private isInitialized = false;
  private onPoseDetected?: (result: PoseLandmarkerResult) => void;
  private config: Required<PoseDetectorConfig>;

  constructor(config?: PoseDetectorConfig) {
    this.config = {
      modelPath: '/models/pose_landmarker_lite.task',
      // 智能选择：局域网从本地加载，外网从 CDN 加载
      wasmPath: getWasmPath(),
      delegate: this.isMobile() ? 'CPU' : 'GPU',
      runningMode: 'VIDEO',
      numPoses: 1,
      outputWorldLandmarks: true, // 标记：世界坐标系始终启用（MediaPipe 默认输出）
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
        // 注意：MediaPipe PoseLandmarker 默认输出 worldLandmarks，无需额外配置
      });

      this.isInitialized = true;
      console.log(`PoseDetector initialized with ${this.config.delegate} delegate`);
    } catch (error) {
      console.error('Failed to initialize PoseDetector:', error);
      throw error;
    }
  }

  detectForVideo(video: HTMLVideoElement, timestamp: number): PoseLandmarkerResult | null {
    if (!this.isInitialized || !this.landmarker) {
      return null;
    }

    try {
      const result = this.landmarker.detectForVideo(video, timestamp);
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
    }
  }
}
