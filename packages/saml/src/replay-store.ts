/**
 * Assertion-id deduplication: the store a verification consults before it
 * accepts anything. A bearer assertion is replayable for as long as its own
 * window stays open, and remembering the ids already accepted is what closes
 * that window ahead of the clock.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";

/**
 * Records which assertion ids have already been accepted.
 *
 * Implementations need only presence and expiry, so a table with a TTL column
 * or a key-value namespace both fit. A false positive here refuses a genuine
 * sign-in, so a store that forgets early is safer than one that answers wrong.
 */
export interface ReplayStore {
	/**
	 * Whether this assertion id was already accepted.
	 *
	 * @param id Assertion id from the verified element.
	 * @returns `true` while the id is still remembered.
	 */
	seen(id: string): Promise<boolean>;

	/**
	 * Records an assertion id for at least the given duration.
	 *
	 * @param id Assertion id to remember.
	 * @param ttl How long the id must stay remembered, which a verification sets
	 * to the rest of the assertion's own validity window.
	 */
	remember(id: string, ttl: DurationInput): Promise<void>;
}
