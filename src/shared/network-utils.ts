
const LAN_PATTERS: RegExp[] = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^::1$/,
  /^fd/,
  /^169\.254\./,
];

function isPrivate172(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  const second = parseInt(parts[1], 10);
  return second >= 16 && second <= 31;
}

export function isLanClient(): boolean {
  if (typeof window === 'undefined') return false;

  const host = window.location.hostname;

  if (host === 'localhost' || host === '127.0.0.1') return true;

  for (const pattern of LAN_PATTERS) {
    if (pattern.test(host)) return true;
  }

  if (isPrivate172(host)) return true;

  return false;
}

export function getWasmPath(): string {
  if (isLanClient()) {
    return '/node_modules/@mediapipe/tasks-vision/wasm';
  }
  return 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm';
}
