/**
 * Splits an integer amount (in cents) as evenly as possible among `n` participants.
 * Returns an array of `n` integers that sum exactly to `amountCents`.
 *
 * The remainder (amountCents % n) is distributed 1 cent each to the first
 * `remainder` participants, so splits differ by at most 1 cent.
 *
 * @throws if n <= 0 or amountCents < 0
 */
export function splitAmount(amountCents: number, n: number): number[] {
  if (n <= 0) throw new Error("Cannot split among zero or fewer participants");
  if (amountCents < 0) throw new Error("Amount must be non-negative");
  if (!Number.isInteger(amountCents)) throw new Error("Amount must be an integer (cents)");
  if (!Number.isInteger(n)) throw new Error("Participant count must be an integer");

  const base = Math.floor(amountCents / n);
  const remainder = amountCents % n;

  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}
