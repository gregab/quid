/**
 * Converts percentage inputs to cent amounts, distributing any rounding remainder
 * to the first N participants.
 */
export function percentagesToCents(
  percentages: Map<string, string>,
  participantIds: string[],
  totalCents: number
): Map<string, number> {
  const result = new Map<string, number>();
  if (totalCents <= 0 || participantIds.length === 0) {
    participantIds.forEach((id) => result.set(id, 0));
    return result;
  }
  const floored = participantIds.map((id) => {
    const pct = parseFloat(percentages.get(id) ?? "0") || 0;
    return Math.floor((pct / 100) * totalCents);
  });
  const remainder = totalCents - floored.reduce((s, a) => s + a, 0);
  participantIds.forEach((id, i) => {
    result.set(id, floored[i]! + (i < remainder ? 1 : 0));
  });
  return result;
}

/**
 * Derives integer percentage strings from existing dollar-string amounts.
 * Uses floor + remainder distribution (like percentagesToCents) so the
 * resulting integers always sum to exactly 100.
 */
export function centsToPercentages(
  customAmounts: Map<string, string>,
  participantIds: string[],
  totalCents: number
): Map<string, string> {
  const result = new Map<string, string>();
  if (totalCents <= 0 || participantIds.length === 0) {
    participantIds.forEach((id) => result.set(id, "0"));
    return result;
  }
  // Floor each percentage, then distribute remainder to those with largest fractional parts
  const exact = participantIds.map((id) => {
    const amountCents = Math.round(parseFloat(customAmounts.get(id) ?? "0") * 100);
    return (amountCents / totalCents) * 100;
  });
  const floored = exact.map((v) => Math.floor(v));
  const remainder = 100 - floored.reduce((s, a) => s + a, 0);
  // Sort indices by fractional part descending, give +1 to top `remainder`
  const fractionals = exact.map((v, i) => ({ i, frac: v - Math.floor(v) }));
  fractionals.sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < remainder; k++) {
    floored[fractionals[k]!.i]!++;
  }
  participantIds.forEach((id, i) => {
    result.set(id, floored[i]!.toString());
  });
  return result;
}
