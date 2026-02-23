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
 * Derives percentage strings from existing dollar-string amounts.
 */
export function centsToPercentages(
  customAmounts: Map<string, string>,
  participantIds: string[],
  totalCents: number
): Map<string, string> {
  const result = new Map<string, string>();
  if (totalCents <= 0) {
    participantIds.forEach((id) => result.set(id, "0.00"));
    return result;
  }
  participantIds.forEach((id) => {
    const amountCents = Math.round(parseFloat(customAmounts.get(id) ?? "0") * 100);
    result.set(id, ((amountCents / totalCents) * 100).toFixed(2));
  });
  return result;
}
