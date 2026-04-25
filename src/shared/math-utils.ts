export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Circle {
  x: number;
  y: number;
  radius: number;
}

// 计算两点距离
export function distance(p1: Point, p2: Point): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// 计算线段与圆的碰撞
export function lineCircleIntersect(
  lineStart: Point,
  lineEnd: Point,
  circle: Circle
): boolean {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const fx = lineStart.x - circle.x;
  const fy = lineStart.y - circle.y;

  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - circle.radius * circle.radius;

  let discriminant = b * b - 4 * a * c;
  if (discriminant < 0) {
    return false;
  }

  discriminant = Math.sqrt(discriminant);
  const t1 = (-b - discriminant) / (2 * a);
  const t2 = (-b + discriminant) / (2 * a);

  return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
}

// 归一化坐标转画布坐标
export function normalizeToCanvas(
  normalized: Point,
  width: number,
  height: number
): Point {
  return {
    x: normalized.x * width,
    y: normalized.y * height
  };
}

// 随机范围
export function randomRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

// 随机整数
export function randomInt(min: number, max: number): number {
  return Math.floor(randomRange(min, max + 1));
}
