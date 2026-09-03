/**
 * Collects the measurements taken while answering one request and renders them as a
 * `Server-Timing` header. It exists so a handler can time the slow parts of a response
 * inline — one `measure` call wrapping the work — and have the header assembled for it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Timing } from "./timing.js";

/** Header the measurements are reported under. */
const HEADER_NAME = "Server-Timing";

/** Separator between entries, per the header's comma-delimited list grammar. */
const ENTRY_SEPARATOR = ", ";

/**
 * A request-scoped set of measurements.
 *
 * Construct one per request, hand it to whatever does the timed work, and write it onto
 * the response; sharing a collector across requests would mix callers' timings together.
 */
export class TimingCollector {
	/**
	 * Measurements taken so far, in insertion order.
	 *
	 * A `Set` guarantees each timing appears exactly once in the header, no matter how many
	 * times `measure` records it.
	 */
	#collection = new Set<Timing>();

	/**
	 * Times an async operation and records the result whether it resolves or rejects,
	 * re-throwing any rejection untouched — a call that failed slowly is exactly the one
	 * worth seeing in the header.
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
	 * Writes the measurements onto a `Headers` object as a single `Server-Timing` header,
	 * replacing any value already set so the collector owns the header on whatever response
	 * it is given.
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
