import { NormalizedLandmark } from '../core/types.js';

const POSE_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8],
  [8, 9], [9, 10],
  [11, 13], [13, 15],
  [12, 14], [14, 16],
  [11, 12], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [29, 31],
  [27, 31],
  [24, 26], [26, 28], [28, 30], [30, 32],
  [28, 32]
];

const LEFT_PARTS = [11, 13, 15, 23, 25, 27, 29, 31];
const RIGHT_PARTS = [12, 14, 16, 24, 26, 28, 30, 32];
const TORSO_PARTS = [11, 12, 23, 24];

export class PoseRenderer {
  private ctx: CanvasRenderingContext2D;
  private landmarkRadius = 4;
  private connectionLineWidth = 1;
  private video!: HTMLVideoElement;

  constructor(ctx: CanvasRenderingContext2D, video: HTMLVideoElement) {
    this.ctx = ctx;
    this.video = video;
  }

  setVideo(video: HTMLVideoElement): void {
    this.video = video;
  }

  private toCanvasCoords(
    nx: number, ny: number,
    canvasWidth: number, canvasHeight: number
  ): { x: number; y: number } {
    const v = this.video;
    if (!v.videoWidth || !v.videoHeight) {
      return { x: (1 - nx) * canvasWidth, y: ny * canvasHeight };
    }

    const vw = v.videoWidth;
    const vh = v.videoHeight;

    const scale = Math.min(canvasWidth / vw, canvasHeight / vh);
    const displayW = vw * scale;
    const displayH = vh * scale;
    const offsetX = (canvasWidth - displayW) / 2;
    const offsetY = (canvasHeight - displayH) / 2;

    const mx = 1 - nx;

    return {
      x: offsetX + mx * displayW,
      y: offsetY + ny * displayH,
    };
  }

  render(landmarks: NormalizedLandmark[], canvasWidth: number, canvasHeight: number): void {
    this.renderConnections(landmarks, canvasWidth, canvasHeight);
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

      const { x: x1, y: y1 } = this.toCanvasCoords(start.x, start.y, canvasWidth, canvasHeight);
      const { x: x2, y: y2 } = this.toCanvasCoords(end.x, end.y, canvasWidth, canvasHeight);

      let color = '#00ff88';
      if (LEFT_PARTS.includes(startIdx) || LEFT_PARTS.includes(endIdx)) {
        color = '#00e5ff';
      } else if (RIGHT_PARTS.includes(startIdx) || RIGHT_PARTS.includes(endIdx)) {
        color = '#ffaa44';
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

      const { x, y } = this.toCanvasCoords(lm.x, lm.y, canvasWidth, canvasHeight);

      let color = '#00ff88';
      if (i === 0) {
        color = '#ff4444';
      } else if (LEFT_PARTS.includes(i)) {
        color = '#00e5ff';
      } else if (RIGHT_PARTS.includes(i)) {
        color = '#ffaa44';
      } else if (TORSO_PARTS.includes(i)) {
        color = '#ffff66';
      }

      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.arc(x, y, this.landmarkRadius, 0, 2 * Math.PI);
      this.ctx.stroke();
    }
  }

  renderPartHighlight(landmarks: NormalizedLandmark[], canvasWidth: number, canvasHeight: number): void {
    const highlights: { idx: number; color: string; label: string; offsetY: number }[] = [
      { idx: 13, color: '#66d9ff', label: 'LE', offsetY: -20 },
      { idx: 14, color: '#ffbb66', label: 'RE', offsetY: 25  },
      { idx: 25, color: '#66ffbb', label: 'LK', offsetY: -20 },
      { idx: 26, color: '#ff88cc', label: 'RK', offsetY: 25  },
      { idx: 27, color: '#66ff88', label: 'LF', offsetY: -25 },
      { idx: 28, color: '#ff66aa', label: 'RF', offsetY: 25  },
    ];

    if (landmarks[0] && (landmarks[0].visibility ?? 0) >= 0.5) {
      const { x: hx, y: hy } = this.toCanvasCoords(landmarks[0].x, landmarks[0].y, canvasWidth, canvasHeight);
      this.ctx.strokeStyle = '#dd88ff';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.arc(hx, hy, 15, 0, 2 * Math.PI);
      this.ctx.stroke();
      this.ctx.fillStyle = '#dd88ff';
      this.ctx.font = '12px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('H', hx, hy - 20);
    }

    for (const h of highlights) {
      const lm = landmarks[h.idx];
      if (!lm || (lm.visibility ?? 0) < 0.5) continue;

      const { x, y } = this.toCanvasCoords(lm.x, lm.y, canvasWidth, canvasHeight);

      this.ctx.strokeStyle = h.color;
      this.ctx.lineWidth = 1;
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