/**
 * Bounded-concurrency helpers for the jobs that sweep every monitor of a type in one
 * invocation (ADR-008). Each sweep runs its per-monitor work in fixed-size batches
 * instead of one monitor at a time, so its wall time stops being the sum of every
 * monitor's latency and one hung target no longer delays everything behind it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * How many monitors a sweep works on at once.
 *
 * Ten is a placeholder pending measurement, not a tuned value: it sits under the
 * Workers simultaneous-subrequest ceiling with room for the D1 statements each check
 * makes, but the real number should come from observed sweep durations under load
 * (ADR-008 leaves this explicitly open, and ADR-019's instrumentation is what makes it
 * measurable). Change it here and every sweep picks it up.
 */
export const SWEEP_CONCURRENCY = 10;

/** Splits `items` into consecutive groups of at most `size`, preserving order. */
export function chunk<Item>(items: Item[], size: number): Item[][] {
	if (!Number.isInteger(size) || size < 1) {
		throw new RangeError(`Chunk size must be a positive integer, got ${size}`);
	}

	let chunks: Item[][] = [];
	for (let index = 0; index < items.length; index += size) {
		chunks.push(items.slice(index, index + size));
	}
	return chunks;
}

/**
 * One item's outcome, paired with the item itself so a caller can attribute a failure
 * to the monitor that caused it without matching indexes back up by hand.
 */
export type Settled<Item, Value> =
	| { item: Item; ok: true; value: Value }
	| { item: Item; ok: false; error: unknown };

/**
 * Runs `work` over `items` in batches of at most `concurrency`, awaiting each batch
 * before starting the next, and returns every outcome in the input's order.
 *
 * Failures are isolated rather than propagated: one item throwing neither abandons the
 * rest of its batch nor stops later batches, matching the per-monitor `try`/`catch`
 * every sweep already had. Callers decide what a failure means — count it, log it, or
 * both — by inspecting the returned outcomes.
 */
export async function mapWithConcurrency<Item, Value>(
	items: Item[],
	work: (item: Item) => Promise<Value>,
	concurrency: number = SWEEP_CONCURRENCY,
): Promise<Array<Settled<Item, Value>>> {
	let settled: Array<Settled<Item, Value>> = [];

	for (let batch of chunk(items, concurrency)) {
		let outcomes = await Promise.allSettled(
			batch.map(async (item): Promise<Settled<Item, Value>> => {
				try {
					return { item, ok: true, value: await work(item) };
				} catch (error) {
					return { item, ok: false, error };
				}
			}),
		);

		/**
		 * The mapped function above turns a throw into a resolved outcome, so every
		 * promise here is fulfilled. `allSettled` is still what awaits them, so a
		 * rejection that somehow escapes can't take the whole batch down with it.
		 */
		for (let outcome of outcomes) if (outcome.status === "fulfilled") settled.push(outcome.value);
	}

	return settled;
}
