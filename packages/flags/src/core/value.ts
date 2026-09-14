/**
 * What a flag can hold, and the return shape of anything a provider may answer
 * either immediately or after a round trip.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONValue } from "@sdxc/types";

/**
 * A value that may already be there. Resolvers and hook stages accept both, so
 * an implementation that answers from memory returns its answer directly while
 * one that has to fetch returns a promise.
 */
export type MaybePromise<T> = T | Promise<T>;

/**
 * The four types a flag evaluates to — a boolean, a string, a number or a
 * structure — which together are exactly what JSON holds, so every value here
 * is one a flag management system can have written down.
 */
export type FlagValue = JSONValue;

/** Which of the four typed evaluations produced a value, named as the methods are. */
export type FlagValueType = "boolean" | "string" | "number" | "object";
