import { FilesetResolver, PoseLandmarker, PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { getWasmPath } from '../shared/network-utils.js';

export interface PoseDetectorConfig {
  modelPath?: string;
  wasmPath?: string;
  delegate?: 'CPU' | 'GPU';
  runningMode?: 'IMAGE' | 'VIDEO' | 'LIVE_STREAM';
  numPoses?: number;
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
        outputSegmentationMasks: false
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
