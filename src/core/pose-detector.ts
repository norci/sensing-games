import { PoseLandmarkerResult } from '@mediapipe/tasks-vision';

export interface PoseDetectorConfig {
  modelPath?: string;
  delegate?: 'CPU' | 'GPU';
  numPoses?: number;
  outputWorldLandmarks?: boolean;
}

export class PoseDetector {
  private worker!: Worker;
  private isInitialized = false;
  private initPromise!: Promise<void>;
  private config: Required<PoseDetectorConfig>;
  private resultCallback!: (result: PoseLandmarkerResult) => void;

  constructor(config?: PoseDetectorConfig) {
    this.config = {
      modelPath: '/models/pose_landmarker_lite.task',
      delegate: 'GPU',
      numPoses: 1,
      outputWorldLandmarks: true,
      ...config
    };
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;
    this.initPromise = this.initWorker();
    return this.initPromise;
  }

  private initWorker(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.worker = new Worker(new URL('./pose-landmarker.worker.ts', import.meta.url), { type: 'module' });

      this.worker.onmessage = (event: MessageEvent) => {
        const { type } = event.data;
        if (type === 'INIT_DONE') {
          this.isInitialized = true;
          console.log('PoseDetector worker initialized');
          resolve();
        } else if (type === 'DETECT_RESULT') {
          this.resultCallback(event.data.result);
        } else if (type === 'DETECT_ERROR') {
          console.error('Detection error:', event.data.error);
        }
      };

      this.worker.onerror = (error: Event) => {
        console.error('Worker error:', error);
        reject(error);
      };

      this.worker.postMessage({
        type: 'INIT',
        modelAssetPath: this.config.modelPath,
        delegate: this.config.delegate,
        minPoseDetectionConfidence: 0.7,
        minPosePresenceConfidence: 0.7,
        minTrackingConfidence: 0.7,
        numPoses: this.config.numPoses,
        outputSegmentationMasks: false,
      });

      setTimeout(() => {
        if (!this.isInitialized) {
          reject(new Error('PoseDetector worker init timeout'));
        }
      }, 15000);
    });
  }

  onResult(callback: (result: PoseLandmarkerResult) => void): void {
    this.resultCallback = callback;
  }

  feedFrame(video: HTMLVideoElement): void {
    createImageBitmap(video).then(bitmap => {
      this.worker.postMessage({ type: 'DETECT', bitmap }, [bitmap]);
    });
  }

  destroy(): void {
    this.worker.postMessage({ type: 'CLEANUP' });
    this.worker.terminate();
    this.isInitialized = false;
  }
}
