/** Decimal text -> cents using integer arithmetic only, accepting comma or dot. */
export function euroToCents(value: string): number | null {
  const match = /^(\d{1,14})(?:[.,](\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const cents = BigInt(match[1]!) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
  return cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : null;
}
export function centsToEuro(value: number): string {
  const cents = BigInt(value);
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
}
