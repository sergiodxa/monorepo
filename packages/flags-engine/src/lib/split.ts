/**
 * Which arm of a percentage split a subject lands in, from a hash of that
 * subject and nothing else, so a rollout covers the same people on every
 * request, in every isolate, for as long as the weights stay put.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EvaluationContext } from "@sdxc/flags";
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { Split } from "../definition.js";

import type { ContextValue } from "./path.js";

import { murmurHash3 } from "./hash.js";
import { read } from "./path.js";

/** Where a split reads its subject from when it names no field of its own. */
const SUBJECT_FIELD = "targetingKey";

/** The width of the hash the bucket is scaled down from by a multiply-high. */
const HASH_BITS = 32n;

/**
 * Puts a subject in one arm of a split, hashing the seed — or the flag key,
 * which is what makes two flags at ten percent cover different tenths — with
 * the subject read out of the context.
 *
 * @param split The weights to spread subjects across, and where to read one from.
 * @param flagKey Mixed into the hash for a split that names no `seed`.
 * @param context The merged context an evaluation was given.
 * @returns The variant that won the bucket, or a failure when the field the
 * split buckets on carries nothing to hash, which the caller reports as
 * `TARGETING_KEY_MISSING` rather than serving an arm nobody was assigned to.
 * @example selectVariant({ weights: { on: 10, off: 90 } }, "beta", { targetingKey: "u-1" })
 */
export function selectVariant(
	split: Split,
	flagKey: string,
	context: EvaluationContext,
): Result<string, Error> {
	let field = split.by ?? SUBJECT_FIELD;
	let subject = read(context, field);

	if (!isSubject(subject)) {
		return failure(new Error(`The context carries no "${field}" to bucket on`));
	}

	let weights = orderedWeights(split.weights);
	let total = weights.reduce((sum, [, weight]) => sum + weight, 0);
	let hash = murmurHash3(`${split.seed ?? flagKey}${subject}`);
	let bucket = Number((BigInt(hash) * BigInt(total)) >> HASH_BITS);
	let cumulative = 0;

	for (let [variant, weight] of weights) {
		cumulative += weight;
		if (bucket < cumulative) return success(variant);
	}

	return failure(new Error(`The split on "${flagKey}" declares no weight above zero`));
}

/**
 * Recognizes the values a subject string can be built from, so an account id
 * buckets the same whether the caller sent it as a number or as text, and a
 * structure is reported as no subject instead of hashing as one.
 */
function isSubject(value: ContextValue): value is string | number | boolean {
	return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

/**
 * Walks the arms in variant-name order, which is the only order two isolates
 * are guaranteed to agree on: a store, an editor or a JSON round trip is free
 * to hand the same weights back with their keys in another sequence.
 */
function orderedWeights(weights: Record<string, number>): [string, number][] {
	return Object.keys(weights)
		.sort()
		.map((variant): [string, number] => [variant, weights[variant] ?? 0]);
}
