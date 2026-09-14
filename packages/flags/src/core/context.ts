/**
 * What targeting reads: the subject an evaluation is about, and whatever else a
 * provider's rules are written against.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONValue } from "@sdxc/types";

/**
 * The data a provider targets on. `targetingKey` is the subject a percentage
 * rollout hashes and a per-user rule matches; every other field is a fact about
 * that subject or about the request it arrived on.
 *
 * Fields set at a later merge level overwrite the same field from an earlier
 * one, `targetingKey` included. A field holds a boolean, a string, a number, a
 * `Date` or a structure.
 */
export interface EvaluationContext {
	targetingKey?: string;
	[field: string]: Date | JSONValue | undefined;
}
