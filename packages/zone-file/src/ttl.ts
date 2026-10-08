/**
 * Reads a TTL field as seconds: a plain number, or BIND's unit form (`1h30m`, `2W`), which
 * every BIND-compatible tool accepts in records and in `$TTL`, capped at RFC 2181's 2³¹−1.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The largest TTL RFC 2181 section 8 allows. */
const MAX_TTL = 2 ** 31 - 1;

/** Seconds per BIND TTL unit. */
const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86_400, w: 604_800 };

/**
 * Whether a field is spelled like a TTL, so the record reader takes it as one even when its
 * value is out of range, and reports that rather than reading it as a record type.
 */
export function looksLikeTtl(field: string): boolean {
	return /^\d+$/.test(field) || /^(\d+[smhdw])+$/i.test(field);
}

/**
 * The seconds a TTL field stands for, or `null` when it is not one or passes 2³¹−1.
 *
 * @example readTtl("1h30m") // 5400
 */
export function readTtl(field: string): number | null {
	if (!looksLikeTtl(field)) return null;
	let seconds = /^\d+$/.test(field)
		? Number(field)
		: Array.from(field.matchAll(/(\d+)([smhdw])/gi)).reduce(
				(total, [, amount, unit]) =>
					total + Number(amount) * (UNIT_SECONDS[(unit ?? "s").toLowerCase()] ?? 1),
				0,
			);
	return seconds <= MAX_TTL ? seconds : null;
}
