import { NormalizedLandmark } from '../types/pose.js';

// MediaPipe Pose 骨架连接定义（33个关键点）
const POSE_CONNECTIONS: [number, number][] = [
  // 面部轮廓
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8],
  [8, 9], [9, 10],
  // 左臂
  [11, 13], [13, 15],
  // 右臂
  [12, 14], [14, 16],
  // 躯干
  [11, 12], [11, 23], [12, 24], [23, 24],
  // 左腿
  [23, 25], [25, 27], [27, 29], [29, 31],
  [27, 31], // 左脚踝到脚趾
  // 右腿
  [24, 26], [26, 28], [28, 30], [30, 32],
  [28, 32], // 右脚踝到脚趾
];

// 关键点分组（用于不同颜色）
const LEFT_PARTS = [11, 13, 15, 23, 25, 27, 29, 31];
const RIGHT_PARTS = [12, 14, 16, 24, 26, 28, 30, 32];
const TORSO_PARTS = [11, 12, 23, 24];

export class PoseRenderer {
  private ctx: CanvasRenderingContext2D;
  private landmarkRadius = 4;
  private connectionLineWidth = 2;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  render(landmarks: NormalizedLandmark[], canvasWidth: number, canvasHeight: number): void {
    if (!landmarks || landmarks.length === 0) return;

    // 绘制骨架连线
    this.renderConnections(landmarks, canvasWidth, canvasHeight);

    // 绘制关键点
    this.renderLandmarks(landmarks, canvasWidth, canvasHeight);
  }

  private renderConnections(landmarks: NormalizedLandmark[], canvasWidth: number, canvasHeight: number): void {
    this.ctx.lineWidth = this.connectionLineWidth;

    for (const [startIdx, endIdx] of POSE_CONNECTIONS) {
      const start = landmarks[startIdx];
      const end = landmarks[endIdx];

      if (!start || !end || (start.visibility ?? 0) < 0.5 || (end.visibility ?? 0) < 0.5) {
        continue;
      }

      const x1 = (1 - start.x) * canvasWidth; // 镜像翻转
      const y1 = start.y * canvasHeight;
      const x2 = (1 - end.x) * canvasWidth;
      const y2 = end.y * canvasHeight;

      // 根据部位选择颜色
      let color = '#00ff00'; // 默认绿色
      if (LEFT_PARTS.includes(startIdx) || LEFT_PARTS.includes(endIdx)) {
        color = '#00ccff'; // 蓝色 - 左半身
      } else if (RIGHT_PARTS.includes(startIdx) || RIGHT_PARTS.includes(endIdx)) {
        color = '#ff6600'; // 橙色 - 右半身
      }

      this.ctx.strokeStyle = color;
      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();
    }
  }

  private renderLandmarks(landmarks: NormalizedLandmark[], canvasWidth: number, canvasHeight: number): void {
    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i];
      if ((lm.visibility ?? 0) < 0.5) continue;

      const x = (1 - lm.x) * canvasWidth; // 镜像翻转
      const y = lm.y * canvasHeight;

      // 根据部位选择颜色
      let color = '#00ff00';
      if (i === 0) {
        color = '#ff0000'; // 红色 - 鼻子
      } else if (LEFT_PARTS.includes(i)) {
        color = '#00ccff'; // 蓝色 - 左半身
      } else if (RIGHT_PARTS.includes(i)) {
        color = '#ff6600'; // 橙色 - 右半身
      } else if (TORSO_PARTS.includes(i)) {
        color = '#ffff00'; // 黄色 - 躯干
      }

      // 绘制外圈
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      this.ctx.arc(x, y, this.landmarkRadius + 1, 0, 2 * Math.PI);
      this.ctx.fill();

      // 绘制内圈（白色）
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(x, y, this.landmarkRadius, 0, 2 * Math.PI);
      this.ctx.fill();
    }
  }

  // 高亮显示左右手腕（挥刀关键部位）
  renderWristHighlight(landmarks: NormalizedLandmark[], canvasWidth: number, canvasHeight: number): void {
    // 高亮左手腕（蓝色）
    if (landmarks.length >= 16) {
      const leftWrist = landmarks[15];
      if (leftWrist && (leftWrist.visibility ?? 0) >= 0.5) {
        const x = (1 - leftWrist.x) * canvasWidth;
        const y = leftWrist.y * canvasHeight;

        this.ctx.strokeStyle = '#00ccff';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(x, y, 15, 0, 2 * Math.PI);
        this.ctx.stroke();

        this.ctx.fillStyle = '#00ccff';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`L (${leftWrist.x.toFixed(2)}, ${leftWrist.y.toFixed(2)})`, x, y - 25);
      }
    }

    // 高亮右手腕（橙色）
    if (landmarks.length >= 17) {
      const rightWrist = landmarks[16];
      if (rightWrist && (rightWrist.visibility ?? 0) >= 0.5) {
        const x = (1 - rightWrist.x) * canvasWidth;
        const y = rightWrist.y * canvasHeight;

        this.ctx.strokeStyle = '#ff6600';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(x, y, 15, 0, 2 * Math.PI);
        this.ctx.stroke();

        this.ctx.fillStyle = '#ff6600';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`R (${rightWrist.x.toFixed(2)}, ${rightWrist.y.toFixed(2)})`, x, y + 25);
      }
    }
  }
}
