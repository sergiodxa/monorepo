/**
 * One Server-Timing measurement: a name, an optional description, and the elapsed time
 * between construction and `end()`. It exists so the collector has a single value object
 * to hold and format, instead of re-deriving the header's syntax at every call site.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * A measurement that starts the moment it is constructed and stops at `end()`.
 *
 * Each instance is single use: `end()` stamps the finish time, and reusing the instance
 * for a second measurement would silently overwrite the first. Take a new one per thing
 * you want to time.
 *
 * The clock is `performance.now()` rather than `Date.now()` because it is monotonic and
 * sub-millisecond, and because the `Server-Timing` header reports fractional milliseconds.
 * Note that some server runtimes deliberately freeze that clock between I/O operations,
 * so a measurement around pure computation can legitimately read as zero.
 */
export class Timing {
	/** Metric name. Emitted as the entry's leading token, so keep it short and stable. */
	readonly name: string;

	/**
	 * Human-readable detail about the metric, emitted as `desc`.
	 *
	 * An empty string means the entry carries no `desc` at all, which is the difference
	 * between `db;dur=1.20` and `db;desc="";dur=1.20` on the wire.
	 */
	readonly description: string;

	/** Clock reading taken when the instance was constructed. */
	#start = performance.now();

	/** Clock reading taken by `end()`. Zero stands for "never ended". */
	#end = 0;

	/**
	 * Starts the measurement.
	 *
	 * @param name Metric name.
	 * @param description Detail about the metric. Omit for an entry without a `desc`.
	 */
	constructor(name: string, description = "") {
		this.name = name;
		this.description = description;
	}

	/**
	 * Milliseconds elapsed between construction and `end()`.
	 *
	 * Reports zero while the measurement is still running, so an entry that was never
	 * ended is reported without a duration rather than with a nonsensical one. The
	 * negative guard covers a runtime whose clock is not strictly monotonic: a metric that
	 * appears to have finished before it started is reported as zero, not as a negative
	 * duration that would make the whole header invalid.
	 */
	get duration(): number {
		if (this.#end === 0) return 0;

		let result = this.#end - this.#start;
		if (result < 0) return 0;

		return result;
	}

	/** Stops the measurement, freezing `duration` from here on. */
	end(): void {
		this.#end = performance.now();
	}

	/**
	 * Formats the measurement as one `Server-Timing` entry.
	 *
	 * Empty parts are dropped rather than emitted blank, because the header's grammar
	 * treats a missing `desc` or `dur` as "not reported" while a present-but-empty one is
	 * simply malformed. The duration is fixed at two decimals: the clock has more
	 * precision than that, but nothing downstream reads it, and unbounded digits only make
	 * the header longer.
	 *
	 * @returns The entry, e.g. `db;desc="findUserById";dur=12.34`.
	 */
	toString(): string {
		let value = [this.name];

		if (this.description) value.push(`desc="${this.description}"`);
		if (this.duration > 0) value.push(`dur=${this.duration.toFixed(2)}`);

		return value.join(";");
	}
}
