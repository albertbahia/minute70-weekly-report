/** Compute the "late window" minutes from a half length (≈44% of a half). */
export function getLateWindow(halfLengthMinutes: number): number {
  return Math.round(halfLengthMinutes * 0.44);
}
