/**
 * Tail sampling for emitted logs: decides, once a log's outcome is known, whether it is
 * written. A failure is always written, so sampling only ever sheds successful logs, and
 * the default keeps everything until a worker's volume gives it a reason to shed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Context } from "@sdxc/expression";
import type { Random } from "@sdxc/random";

import { createLanguage } from "@sdxc/expression";
import { systemRandom } from "@sdxc/random";
import { isSuccess } from "@sdxc/result";

import type { Log } from "./log.js";

/** The condition language a `keep` exemption is written in: every built-in, nothing added. */
const KEEP_CONDITIONS = createLanguage();

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
		 * An `ok` log is kept whatever the rate when this holds. `kind` is among the fields, so
		 * `({ kind }) => kind !== "job"` confines sampling to job logs; a condition such as
		 * `{ op: "eq", field: "kind", value: "job" }` says the same from configuration.
		 */
		keep?: Predicate | Condition;
	}

	/** An exemption written as code, reading the log's flattened fields. */
	export type Predicate = (fields: Readonly<Record<string, Log.Value>>) => boolean;

	/**
	 * An exemption written as data, in the JSON form of the expression language. A dotted
	 * field reads a nested one, so `tenant.id` matches what `{ tenant: { id } }` logged.
	 */
	export type Condition = typeof KEEP_CONDITIONS.Expression;
}

/** Each condition's compiled predicate, so a condition compiles once however many logs read it. */
const PREDICATES = new WeakMap<Sample.Condition, Sample.Predicate>();

/**
 * Turns a `keep` option into the predicate a log is tested with. A condition that does not
 * compile keeps every log, so a broken exemption costs volume and never the logs it was
 * written to keep.
 *
 * @param keep The exemption as configured.
 */
export function exemption(keep: Sample.Predicate | Sample.Condition): Sample.Predicate {
	if (typeof keep === "function") return keep;

	let predicate = PREDICATES.get(keep);
	if (predicate !== undefined) return predicate;

	let compiled = KEEP_CONDITIONS.compile(keep);
	predicate = isSuccess(compiled)
		? (fields) => KEEP_CONDITIONS.evaluate(compiled.data, nest(fields))
		: () => true;
	PREDICATES.set(keep, predicate);
	return predicate;
}

/**
 * Rebuilds the nesting a log flattened into dotted keys, so a condition's dotted path reads
 * `tenant.id` the way it reads any nested context. A key whose prefix already holds a scalar
 * stays out of the rebuilt shape.
 */
function nest(fields: Readonly<Record<string, Log.Value>>): Context {
	let root: Record<string, unknown> = {};
	for (let [key, value] of Object.entries(fields)) {
		let segments = key.split(".");
		let last = segments.pop() ?? key;
		let parent: Record<string, unknown> | undefined = root;
		for (let segment of segments) {
			let child: unknown = parent[segment] ?? {};
			if (typeof child !== "object" || child === null) {
				parent = undefined;
				break;
			}
			parent[segment] = child;
			parent = child as Record<string, unknown>;
		}
		if (parent !== undefined && !(last in parent)) parent[last] = value;
	}
	return root as Context;
}

/** The stream every unseeded sampling draw reads, shared so a log costs no new buffer. */
const SYSTEM_RANDOM = systemRandom();

/**
 * Whether a log is written. Anything that is not `ok` is; an `ok` log is kept by the
 * exemptions first and by the rate last.
 *
 * @param options The sampler, or none.
 * @param outcome How the log ended.
 * @param fields The log's fields, `kind` included.
 * @param durationMs How long the invocation took.
 * @param random Source of the draw against `rate`; a test passes a seeded stream.
 */
export function shouldKeep(
	options: Sample.Options | undefined,
	outcome: Log.Outcome,
	fields: Readonly<Record<string, Log.Value>>,
	durationMs: number,
	random: Random = SYSTEM_RANDOM,
): boolean {
	if (outcome !== "ok") return true;
	if (options === undefined) return true;
	if (options.keep !== undefined && exemption(options.keep)(fields)) return true;
	if (options.slowerThanMs !== undefined && durationMs >= options.slowerThanMs) return true;
	if (options.rate === undefined) return true;
	return random.bool(options.rate);
}
