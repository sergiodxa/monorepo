/**
 * Failures from weighing an entry: a build that did not produce code, or a
 * weight that passed a declared gzipped budget.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Weight } from "./weigh.js";

/** Why a weigh or budget check failed. */
export type WeightErrorCode = "build" | "budget";

/**
 * Error describing a failed build or a weight that passed its gzipped budget,
 * so a CI message can name the entry and the numbers.
 */
export class WeightError extends Error {
	readonly code: WeightErrorCode;
	/** The entry that was weighed, when known. */
	readonly entry: string | null;
	/** The measured weight when a budget failed. */
	readonly weight: Weight | null;
	/** The gzipped budget that was exceeded, in bytes. */
	readonly maxGzipped: number | null;

	/**
	 * Builds a build failure whose message quotes the entry and the builder's
	 * stderr (or message), so a missing dependency stays visible in CI.
	 *
	 * @param entry - Entry the build targeted.
	 * @param detail - Builder's stderr or message.
	 */
	static build(entry: string, detail: string): WeightError {
		return new WeightError("build", `Failed to weigh ${entry}: ${detail}`, {
			entry,
			weight: null,
			maxGzipped: null,
		});
	}

	/**
	 * Builds a budget failure naming the measured gzipped size and the ceiling.
	 *
	 * @param weight - Measured weight.
	 * @param maxGzipped - Allowed gzipped bytes.
	 * @param entry - Entry that was weighed, when known.
	 */
	static budget(weight: Weight, maxGzipped: number, entry: string | null = null): WeightError {
		let where = entry === null ? "entry" : entry;
		return new WeightError(
			"budget",
			`${where} weighs ${weight.gzipped} bytes gzipped (minified ${weight.minified}), over the ${maxGzipped} byte gzipped budget`,
			{ entry, weight, maxGzipped },
		);
	}

	/**
	 * @param code - Whether the build failed or the budget was exceeded.
	 * @param message - Human-readable reason.
	 * @param details - Entry, weight and budget fields carried for callers.
	 */
	constructor(
		code: WeightErrorCode,
		message: string,
		details: { entry: string | null; weight: Weight | null; maxGzipped: number | null },
	) {
		super(message);
		this.name = "WeightError";
		this.code = code;
		this.entry = details.entry;
		this.weight = details.weight;
		this.maxGzipped = details.maxGzipped;
	}
}
