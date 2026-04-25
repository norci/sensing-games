import { NormalizedLandmark } from './pose.js';

export interface Point {
  x: number;
  y: number;
}

export interface SwingResult {
  isBigSwing: boolean;      // 是否大幅度挥刀（任意一只手）
  isKnocking: boolean;       // 是否小幅度敲击（无效）
  velocity: number;           // 腕部速度（归一化，取两手最大值）
  angle: number;              // 上臂-前臂夹角（度，取两手最大值）
  wristPos: Point;            // 腕部位置（归一化坐标，取挥刀的手）
  timestamp: number;          // 时间戳
  leftHand?: SwingHandResult;  // 左手结果
  rightHand?: SwingHandResult; // 右手结果
}

export interface SwingHandResult {
  isBigSwing: boolean;
  isKnocking: boolean;
  velocity: number;
  angle: number;
  wristPos: Point;
}

export interface SwingDetectorConfig {
  minAngle?: number;           // 最小挥刀角度（度），默认60
  knockingAngleMax?: number;   // 敲击最大角度（度），默认30
  minVelocity?: number;        // 最低挥刀速度（归一化），默认2.0
  historySize?: number;        // 速度历史平滑长度，默认5
}
