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
 * Each instance is single use: a second `end()` call overwrites the first finish
 * time, so take a new instance per thing timed.
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
	 * Milliseconds elapsed between construction and `end()`. Reads as zero until
	 * `end()` runs, and stays zero if the clock reports a negative span, since a
	 * non-monotonic reading should not surface as an invalid negative duration.
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
	 * Drops empty parts instead of emitting them blank, since the header's grammar reads a
	 * present-but-empty `desc` or `dur` as malformed rather than absent.
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
