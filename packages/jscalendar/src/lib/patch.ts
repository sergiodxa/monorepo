/**
 * Applies a JSCalendar PatchObject: each key a JSON Pointer without its leading `/`, a
 * `null` value removing the property. The whole patch is checked before anything changes,
 * so an invalid patch leaves nothing half-applied.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { parse as parsePointer } from "@sdxc/json-pointer";
import { failure, isFailure, success } from "@sdxc/result";

import type { JSCalendar } from "../types.js";

import { PatchError } from "./errors.js";

/** One patch with its pointer split into reference tokens. */
interface Step {
	key: string;
	tokens: string[];
	value: unknown;
}

/**
 * Whether one token list starts with another, the condition under which two patches of the
 * same object conflict.
 *
 * @param prefix - The shorter list
 * @param tokens - The longer list
 * @returns `true` when every token of `prefix` leads `tokens`
 */
function startsWith(prefix: string[], tokens: string[]): boolean {
	return prefix.length <= tokens.length && prefix.every((token, index) => tokens[index] === token);
}

/**
 * The member a token names inside a container, or `undefined` when there is none.
 *
 * @param container - An object or array
 * @param token - The reference token
 * @returns The member
 */
function member(container: unknown, token: string): unknown {
	if (Array.isArray(container)) {
		return /^(0|[1-9]\d*)$/.test(token) ? container[Number(token)] : undefined;
	}
	if (typeof container === "object" && container !== null && Object.hasOwn(container, token)) {
		return (container as Record<string, unknown>)[token];
	}
	return undefined;
}

/**
 * Splits and checks every patch: a pointer that does not parse, or one that is the prefix of
 * another, fails the whole patch.
 *
 * @param patch - The PatchObject
 * @returns The steps, or why the patch is invalid
 */
function stepsOf(patch: JSCalendar.PatchObject): Result<Step[], PatchError> {
	let steps: Step[] = [];
	for (let [key, value] of Object.entries(patch)) {
		let tokens = parsePointer(`/${key}`);
		if (isFailure(tokens)) return failure(new PatchError(`"${key}" is not a JSON Pointer`, key));
		steps.push({ key, tokens: tokens.data, value });
	}
	for (let step of steps) {
		let conflict = steps.find((other) => other !== step && startsWith(other.tokens, step.tokens));
		if (conflict) {
			return failure(new PatchError(`"${conflict.key}" and "${step.key}" overlap`, step.key));
		}
	}
	return success(steps);
}

/**
 * Applies a PatchObject to a copy of an object. Every part of a pointer before the last must
 * already exist; inside an array a pointer may replace a member but neither add nor remove
 * one, as jscalendarbis allows.
 *
 * @param object - The object to patch, left unchanged
 * @param patch - The patches
 * @returns The patched copy, or why the patch is invalid
 * @template T - The object's type, which the patched copy is assumed to keep
 * @example applyPatch(event, { title: "Exam", "locations/mlab": null });
 */
export function applyPatch<T extends object>(
	object: T,
	patch: JSCalendar.PatchObject,
): Result<T, PatchError> {
	let steps = stepsOf(patch);
	if (isFailure(steps)) return steps;

	let copy = structuredClone(object);
	for (let { key, tokens, value } of steps.data) {
		let parent: unknown = copy;
		for (let token of tokens.slice(0, -1)) {
			parent = member(parent, token);
			if (typeof parent !== "object" || parent === null) {
				return failure(
					new PatchError(`"${key}" patches inside a property that does not exist`, key),
				);
			}
		}
		let last = tokens.at(-1) as string;
		if (Array.isArray(parent)) {
			if (value === null || member(parent, last) === undefined) {
				return failure(new PatchError(`"${key}" adds or removes an array member`, key));
			}
			parent[Number(last)] = value;
		} else if (value === null) {
			delete (parent as Record<string, unknown>)[last];
		} else {
			Object.defineProperty(parent, last, {
				value,
				enumerable: true,
				writable: true,
				configurable: true,
			});
		}
	}
	return success(copy);
}
