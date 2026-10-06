export function formatPercent(confidence: number): string {
  return `${(confidence * 100).toFixed(1)}%`;
}

export function formatMs(value: number): string {
  return `${Math.round(value)} ms`;
}

export function formatScore(value: number): string {
  return value.toFixed(2);
}
