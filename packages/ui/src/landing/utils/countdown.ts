/**
 * Splits the time left until a moment into days, hours, minutes and seconds, the arithmetic
 * a launch, a sale or an event countdown shares between its server render and its island,
 * so the two always agree on what the page reads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Types for {@link countdownParts}. */
export namespace CountdownParts {
	/** A moment as a `Date`, an ISO 8601 string or epoch milliseconds. */
	export type DateInput = Date | string | number;

	/** The time left, each unit already carried into the next, and whether it has run out. */
	export interface Result {
		/** `true` once `now` has reached `to`, when every unit reads zero. */
		done: boolean;
		days: number;
		hours: number;
		minutes: number;
		seconds: number;
	}
}

/** Milliseconds in each unit the countdown shows, largest first. */
const UNIT_MS = { days: 86_400_000, hours: 3_600_000, minutes: 60_000, seconds: 1_000 } as const;

/**
 * The whole units left from `now` until `to`, rounded down, so a countdown reads "0 days" only
 * in the last day and never jumps ahead of the clock. A moment that does not parse counts as
 * already reached.
 *
 * @param to The moment counted down to.
 * @param now The moment counted from.
 * @returns The days, hours, minutes and seconds left, and whether none are.
 * @example countdownParts("2027-04-15T07:00:00Z", "2027-04-14T05:30:00Z") // { done: false, days: 1, hours: 1, minutes: 30, seconds: 0 }
 */
export function countdownParts(
	to: CountdownParts.DateInput,
	now: CountdownParts.DateInput,
): CountdownParts.Result {
	let left = toTime(to) - toTime(now);
	if (!Number.isFinite(left) || left <= 0) {
		return { done: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
	}

	let days = Math.floor(left / UNIT_MS.days);
	left -= days * UNIT_MS.days;
	let hours = Math.floor(left / UNIT_MS.hours);
	left -= hours * UNIT_MS.hours;
	let minutes = Math.floor(left / UNIT_MS.minutes);
	left -= minutes * UNIT_MS.minutes;
	let seconds = Math.floor(left / UNIT_MS.seconds);

	return { done: false, days, hours, minutes, seconds };
}

/** Epoch milliseconds of a moment, `NaN` when it does not parse. */
function toTime(value: CountdownParts.DateInput): number {
	if (value instanceof Date) return value.getTime();
	if (typeof value === "number") return value;
	return Date.parse(value);
}
