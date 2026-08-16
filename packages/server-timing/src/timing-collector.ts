/**
 * Collects the measurements taken while answering one request and renders them as a
 * `Server-Timing` header. It exists so a handler can time the slow parts of a response
 * inline — one `measure` call wrapping the work — and have the header assembled for it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Timing } from "./timing";

/** Header the measurements are reported under. */
const HEADER_NAME = "Server-Timing";

/** Separator between entries, per the header's comma-delimited list grammar. */
const ENTRY_SEPARATOR = ", ";

/**
 * A request-scoped set of measurements.
 *
 * One collector belongs to one request: construct it where the request begins, hand it to
 * whatever does the timed work, and write it onto the response on the way out. Sharing a
 * collector across requests would mix one caller's timings into another's header.
 */
export class TimingCollector {
	/**
	 * Measurements taken so far, in insertion order.
	 *
	 * A `Set` rather than an array only because a measurement is added exactly once, by
	 * `measure`, and the set makes an accidental double-add a no-op instead of a duplicate
	 * entry in the header.
	 */
	#collection = new Set<Timing>();

	/**
	 * Times an async operation and records the result.
	 *
	 * The measurement is recorded whether the operation resolves or rejects, and the
	 * rejection is re-thrown untouched: a call that failed slowly is exactly the one worth
	 * seeing in the header, and swallowing its error to keep the timing would be a far
	 * worse trade.
	 *
	 * @param name Metric name, grouping the measurement (`db`, `cache`, `auth`).
	 * @param description Detail about this particular measurement, usually the operation.
	 * @param fn The operation to time.
	 * @returns Whatever `fn` resolves to.
	 * @example
	 * let user = await collector.measure("db", "findUserById", () => User.findById(db, id));
	 */
	async measure<T>(name: string, description: string, fn: () => Promise<T>): Promise<T> {
		let timing = new Timing(name, description);

		try {
			return await fn();
		} finally {
			timing.end();
			this.#collection.add(timing);
		}
	}

	/**
	 * Renders every measurement as the header's value.
	 *
	 * @returns The comma-separated entries, or an empty string if nothing was measured.
	 */
	toString(): string {
		return Array.from(this.#collection)
			.map((timing) => timing.toString())
			.join(ENTRY_SEPARATOR);
	}

	/**
	 * Writes the measurements onto a `Headers` object as a single `Server-Timing` header.
	 *
	 * It sets rather than appends, so calling it twice on the same headers replaces the
	 * previous value instead of emitting the measurements twice. That also means the
	 * collector owns the header on whatever response it is given: a `Server-Timing` set by
	 * something upstream is overwritten, not merged.
	 *
	 * @param headers Headers to write to. A fresh `Headers` is created when omitted.
	 * @returns The same `Headers` object, so the call can be used as an expression.
	 * @example
	 * return new Response(body, { headers: collector.toHeaders() });
	 */
	toHeaders(headers = new Headers()): Headers {
		headers.set(HEADER_NAME, this.toString());
		return headers;
	}
}
