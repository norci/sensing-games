import { PoseLandmarker, PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { PoseWorkerBase } from './pose-worker-base.js';

class PoseLandmarkerWorker extends PoseWorkerBase {
  private pendingBitmap: ImageBitmap | null = null;
  private lastTimestamp = 0;

  protected async initializeTask(data: any): Promise<void> {
    const vision = await this.getVisionFileset();
    const modelBuffer = await this.loadModelAsset(data.modelAssetPath);

    this.taskInstance = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetBuffer: new Uint8Array(modelBuffer),
        delegate: data.delegate === 'GPU' ? 'GPU' : 'CPU',
      },
      minPoseDetectionConfidence: data.minPoseDetectionConfidence ?? 0.5,
      minPosePresenceConfidence: data.minPosePresenceConfidence ?? 0.5,
      minTrackingConfidence: data.minTrackingConfidence ?? 0.5,
      numPoses: data.numPoses ?? 1,
      outputSegmentationMasks: data.outputSegmentationMasks ?? false,
      runningMode: 'VIDEO',
    });
  }

  protected async handleCustomMessage(data: any): Promise<void> {
    if (data.type === 'DETECT') {
      const bitmap: ImageBitmap = data.bitmap;

      if (!this.taskInstance) {
        bitmap.close();
        self.postMessage({ type: 'DETECT_ERROR', error: 'Not initialized' });
        return;
      }

      if (this.pendingBitmap) {
        this.pendingBitmap.close();
      }
      this.pendingBitmap = bitmap;

      this.processDetection();
    }
  }

  private async processDetection(): Promise<void> {
    if (!this.taskInstance || !this.pendingBitmap) return;

    const bitmap = this.pendingBitmap;
    this.pendingBitmap = null;

    let timestamp = performance.now();
    if (timestamp <= this.lastTimestamp) {
      timestamp = this.lastTimestamp + 1;
    }
    this.lastTimestamp = timestamp;

    let result: PoseLandmarkerResult;

    try {
      result = (this.taskInstance as PoseLandmarker).detectForVideo(bitmap, timestamp);
    } catch (e: any) {
      console.error('Worker detection error:', e);
      bitmap.close();
      self.postMessage({ type: 'DETECT_ERROR', error: e.message || 'Detection failed' });
      return;
    }

    bitmap.close();

    self.postMessage({
      type: 'DETECT_RESULT',
      result: {
        landmarks: result.landmarks,
        worldLandmarks: result.worldLandmarks,
        segmentationMasks: null,
      },
      inferenceTime: performance.now() - timestamp,
    });
  }
}

new PoseLandmarkerWorker();
