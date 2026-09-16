/**
 * When a reader's own object wakes to compare heads, as pure arithmetic over a tier, an
 * open and a subject. Nothing here reaches a database, a platform or a clock, so every
 * due time is decidable from its arguments and testable without an object to run it in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Tier } from "~/app/lib/entitlement";

import { limitsOf } from "~/app/lib/entitlement";

/** How long an account keeps its full cadence after an open. */
export const DORMANT_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

/** How long after an open an account backs off to the slowest rung of the ladder. */
export const DEEPLY_DORMANT_AFTER_MS = 90 * 24 * 60 * 60 * 1000;

/** What an account that has been opened recently checks on, which is what it pays for. */
export const ACTIVE_MULTIPLIER = 1;

/** What an account past {@link DORMANT_AFTER_MS} without an open checks on. */
export const DORMANT_MULTIPLIER = 4;

/** What an account past {@link DEEPLY_DORMANT_AFTER_MS} without an open checks on. */
export const DEEPLY_DORMANT_MULTIPLIER = 24;

/**
 * How often the retention sweep runs on its own rather than riding on a synchronization.
 * A velocity is measured from when the world saw a post, so a window closes whether or
 * not the feed it came from is still publishing.
 */
export const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * What a check interval is multiplied by for a reader who has been away.
 *
 * A reader who has never stamped an open reads as active: the stamp arrives on the first
 * open, and an object migrated before the column existed has opens behind it that nothing
 * recorded.
 *
 * @param lastOpenedAt - Epoch milliseconds of the last open, or `null` for none recorded.
 * @param now - Epoch milliseconds the distance is measured at.
 */
export function dormancyMultiplier(lastOpenedAt: number | null, now: number): number {
	if (lastOpenedAt === null) return ACTIVE_MULTIPLIER;

	let since = now - lastOpenedAt;

	if (since >= DEEPLY_DORMANT_AFTER_MS) return DEEPLY_DORMANT_MULTIPLIER;
	if (since >= DORMANT_AFTER_MS) return DORMANT_MULTIPLIER;

	return ACTIVE_MULTIPLIER;
}

/**
 * How often this reader's object wakes, or `null` for a tier that arms no alarm at all.
 *
 * @param tier - The tier the lease leaves the reader on.
 * @param lastOpenedAt - Epoch milliseconds of the last open, or `null` for none recorded.
 * @param now - Epoch milliseconds the dormancy is measured at.
 * @example let interval = checkIntervalFor("paid", row.last_opened_at, Date.now());
 */
export function checkIntervalFor(
	tier: Tier,
	lastOpenedAt: number | null,
	now: number,
): number | null {
	let base = limitsOf(tier).checkIntervalMs;
	if (base === null) return null;

	return base * dormancyMultiplier(lastOpenedAt, now);
}

/**
 * Where inside an interval one reader's wakes land, so every reader on a tier does not
 * take the same second of it and hand a popular feed's single thread every subscriber at
 * once. Derived from the subject rather than stored, which is what keeps the phase the
 * same across restarts with no random number to persist and no drift to correct.
 *
 * @param subject - The reader the object is named for.
 * @param intervalMs - The interval the phase is taken inside.
 */
export function phaseOffset(subject: string, intervalMs: number): number {
	if (intervalMs <= 0) return 0;
	return hash(subject) % intervalMs;
}

/**
 * The next wake for one reader: the first point on that reader's own phase-shifted grid
 * strictly after `now`, which lands within one interval however long the object slept.
 *
 * @param subject - The reader the object is named for.
 * @param intervalMs - How often this reader's object wakes.
 * @param now - Epoch milliseconds the wake is scheduled from.
 */
export function nextCheckAt(subject: string, intervalMs: number, now: number): number {
	let phase = phaseOffset(subject, intervalMs);
	let elapsed = now - phase;

	return phase + (Math.floor(elapsed / intervalMs) + 1) * intervalMs;
}

/**
 * The earliest of the due times an object is holding, and `null` when it holds none —
 * which is the whole of what decides where the single alarm goes.
 *
 * @param due - Every due time, with the jobs that are not scheduled passed as `null`.
 */
export function earliestDue(due: readonly (number | null)[]): number | null {
	let earliest: number | null = null;

	for (let at of due) {
		if (at === null) continue;
		if (earliest === null || at < earliest) earliest = at;
	}

	return earliest;
}

/**
 * A 32-bit FNV-1a digest of a string, which spreads short, similar subjects across the
 * whole range rather than clustering the way their bytes do.
 *
 * @param value - What to digest.
 */
function hash(value: string): number {
	let digest = 2_166_136_261;

	for (let index = 0; index < value.length; index++) {
		digest ^= value.charCodeAt(index);
		digest = Math.imul(digest, 16_777_619);
	}

	return digest >>> 0;
}
