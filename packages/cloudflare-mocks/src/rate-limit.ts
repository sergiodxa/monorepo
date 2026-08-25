/**
 * `RateLimit` binding with real per-key counters over a fixed window, so a test can drive
 * a limiter to its threshold and observe the same allow/deny sequence production would
 * produce.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
/** Requests allowed per window when no limit is configured. */
const DEFAULT_LIMIT = 100;

/** Window length in seconds when none is configured. */
const DEFAULT_PERIOD = 60;

/** Options for {@link createRateLimit}. */
export interface RateLimitMockOptions {
	/** Requests allowed per window before `limit()` starts denying. Defaults to 100. */
	limit?: number;
	/** Window length in seconds. The platform allows only 10 or 60. Defaults to 60. */
	period?: 10 | 60;
	/** Clock in milliseconds since the epoch, so a test can roll the window forward. */
	now?: () => number;
}

/** A `RateLimit` binding backed by counters a test can read. */
export interface RateLimitMock extends RateLimit {
	/**
	 * Requests counted against a key in its current window.
	 * @param key Key passed to `limit()`.
	 * @returns The count, or `0` when the key has no live window.
	 */
	count(key: string): number;

	/** Clears every counter, as if all windows had rolled over. */
	reset(): void;
}

/** A key's counter and the window it belongs to. */
interface RateLimitWindow {
	/** Window index, derived from the clock and the period. */
	window: number;
	/** Requests counted in that window. */
	count: number;
}

/**
 * Creates a rate-limit binding that really counts.
 *
 * Per-key counts over a fixed window mirror the platform closely enough to test threshold
 * logic: the first `limit` calls succeed, the rest are denied until the window rolls over.
 * @param options Threshold, window length, and clock override.
 * @returns A `RateLimit` binding with inspectable counters.
 * @example let limiter = createRateLimit({ limit: 2 }); await limiter.limit({ key: "ip" });
 */
export function createRateLimit(options?: RateLimitMockOptions): RateLimitMock {
	let limit = options?.limit ?? DEFAULT_LIMIT;
	let period = options?.period ?? DEFAULT_PERIOD;
	let now = options?.now ?? Date.now;
	let windows = new Map<string, RateLimitWindow>();

	function currentWindow(): number {
		return Math.floor(now() / 1000 / period);
	}

	/** Reads a key's live counter, discarding one left over from an earlier window. */
	function readWindow(key: string): RateLimitWindow {
		let window = currentWindow();
		let existing = windows.get(key);

		if (!existing || existing.window !== window) {
			let fresh = { window, count: 0 };
			windows.set(key, fresh);
			return fresh;
		}

		return existing;
	}

	return {
		/**
		 * Counts one request against a key.
		 * @param limitOptions Key the request is attributed to.
		 * @returns `{ success: false }` once the key has used its allowance for the window.
		 */
		limit(limitOptions: RateLimitOptions): Promise<RateLimitOutcome> {
			let window = readWindow(limitOptions.key);
			window.count += 1;

			return Promise.resolve({ success: window.count <= limit });
		},

		count(key: string): number {
			let existing = windows.get(key);
			if (!existing || existing.window !== currentWindow()) return 0;
			return existing.count;
		},

		reset(): void {
			windows.clear();
		},
	};
}
