import { NormalizedLandmark } from '../core/types.js';

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

    // 绘骨架连线
    this.renderConnections(landmarks, canvasWidth, canvasHeight);
    // 绘关键点
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

  // 高亮显示活跃的身体部位
  renderPartHighlight(landmarks: NormalizedLandmark[], canvasWidth: number, canvasHeight: number): void {
    const highlights: { idx: number; color: string; label: string; offsetY: number }[] = [
      { idx: 13, color: '#0096c8', label: 'LE', offsetY: -20 },  // 左手肘
      { idx: 14, color: '#c86400', label: 'RE', offsetY: 25  },  // 右手肘
      { idx: 25, color: '#00c896', label: 'LK', offsetY: -20 },  // 左膝
      { idx: 26, color: '#c83264', label: 'RK', offsetY: 25  },  // 右膝
      { idx: 27, color: '#00ff64', label: 'LF', offsetY: -25 },  // 左脚踝
      { idx: 28, color: '#ff64c8', label: 'RF', offsetY: 25  },  // 右脚踝
    ];

    // 头球圆圈——直接用鼻尖（landmark 0）
    if (landmarks[0] && (landmarks[0].visibility ?? 0) >= 0.5) {
      const hx = (1 - landmarks[0].x) * canvasWidth;
      const hy = landmarks[0].y * canvasHeight;
      this.ctx.strokeStyle = '#cc66ff';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(hx, hy, 15, 0, 2 * Math.PI);
      this.ctx.stroke();
      this.ctx.fillStyle = '#cc66ff';
      this.ctx.font = '12px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('H', hx, hy - 20);
    }

    for (const h of highlights) {
      if (landmarks.length <= h.idx) continue;
      const lm = landmarks[h.idx];
      if (!lm || (lm.visibility ?? 0) < 0.5) continue;

      const x = (1 - lm.x) * canvasWidth;
      const y = lm.y * canvasHeight;

      this.ctx.strokeStyle = h.color;
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(x, y, 15, 0, 2 * Math.PI);
      this.ctx.stroke();

      this.ctx.fillStyle = h.color;
      this.ctx.font = '12px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(h.label, x, y + h.offsetY);
    }
  }
}
