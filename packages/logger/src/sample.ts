/**
 * Tail sampling for emitted logs: decides, once a log's outcome is known, whether it is
 * written. A failure is always written, so sampling only ever sheds successful logs, and
 * the default keeps everything until a worker's volume gives it a reason to shed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Log } from "./log.js";

export namespace Sample {
	/** What a sampler may be told. Every field is optional, and their absence keeps every log. */
	export interface Options {
		/**
		 * Fraction of `ok` logs kept.
		 * @default 1
		 */
		rate?: number;
		/** An `ok` log at least this slow is kept whatever the rate. */
		slowerThanMs?: number;
		/**
		 * An `ok` log is kept whatever the rate when this returns `true`. `kind` is among the
		 * fields, so `({ kind }) => kind !== "job"` confines sampling to job logs.
		 */
		keep?: (fields: Readonly<Record<string, Log.Value>>) => boolean;
	}
}

/**
 * Whether a log is written. Anything that is not `ok` is; an `ok` log is kept by the
 * exemptions first and by the rate last.
 *
 * @param options The sampler, or none.
 * @param outcome How the log ended.
 * @param fields The log's fields, `kind` included.
 * @param durationMs How long the invocation took.
 * @param random Source of the draw against `rate`, replaceable for a deterministic test.
 */
export function shouldKeep(
	options: Sample.Options | undefined,
	outcome: Log.Outcome,
	fields: Readonly<Record<string, Log.Value>>,
	durationMs: number,
	random: () => number = Math.random,
): boolean {
	if (outcome !== "ok") return true;
	if (options === undefined) return true;
	if (options.keep?.(fields) === true) return true;
	if (options.slowerThanMs !== undefined && durationMs >= options.slowerThanMs) return true;
	if (options.rate === undefined) return true;
	return random() < options.rate;
}
