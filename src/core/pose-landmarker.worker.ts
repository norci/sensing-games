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

      // 只保留最新帧，有积压直接丢弃旧帧
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

    // 单调递增时间戳：取 performance.now()，若与上一帧相同则 +1
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
