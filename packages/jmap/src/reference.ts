/**
 * Result references: an argument of one call taken from the response of an earlier call
 * in the same request, as a JSON Pointer that may map through arrays with `*`. Built
 * by a call's `ref()`, and evaluated locally the way a server evaluates them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { get, parse, stringify } from "@sdxc/json-pointer";
import { failure, isFailure, success } from "@sdxc/result";

import type { Invocation } from "./types.js";

import { JMAPMethodError } from "./error.js";

/** A result reference as it travels, under a `#`-prefixed argument name. */
export interface ResultReferenceObject {
	/** The call id of the earlier call. */
	resultOf: string;
	/** The response name to read, which is the method name unless the call answered with several. */
	name: string;
	/** A JSON Pointer into that response's arguments, where `*` maps through an array. */
	path: string;
}

/**
 * An argument value a batch sends as a result reference: an argument set to one is written
 * as `"#" + name`, and the server substitutes what the pointer selects before the call runs.
 */
export class ResultReference implements ResultReferenceObject {
	readonly resultOf: string;
	readonly name: string;
	readonly path: string;

	/**
	 * @param resultOf - The call id of the earlier call.
	 * @param name - The response name to read.
	 * @param path - A JSON Pointer, or the segments to escape into one (`["list", "*", "id"]`).
	 */
	constructor(resultOf: string, name: string, path: string | readonly (string | number)[]) {
		this.resultOf = resultOf;
		this.name = name;
		this.path = typeof path === "string" ? path : stringify(path);
	}

	/** The wire form. */
	toJSON(): ResultReferenceObject {
		return { resultOf: this.resultOf, name: this.name, path: this.path };
	}
}

/**
 * Evaluates `reference` against the responses a request has produced so far, as RFC 8620
 * section 3.7 specifies: the first response with the call id must carry the name, and
 * each `*` maps the rest of the pointer over an array, flattening arrays it yields.
 *
 * @param methodResponses - The responses, in order.
 * @param reference - The reference to evaluate.
 * @returns The value, or the `invalidResultReference` error a server would answer.
 * @example resolveReference(responses, { resultOf: "t0", name: "Foo/changes", path: "/created" });
 */
export function resolveReference(
	methodResponses: readonly Invocation[],
	reference: ResultReferenceObject,
): Result<unknown, JMAPMethodError> {
	let response = methodResponses.find(([, , callId]) => callId === reference.resultOf);
	if (response === undefined) {
		return invalid(`No response has the call id "${reference.resultOf}".`);
	}
	if (response[0] !== reference.name) {
		return invalid(
			`The response to "${reference.resultOf}" is "${response[0]}", not "${reference.name}".`,
		);
	}
	let tokens = parse(reference.path);
	if (isFailure(tokens)) return invalid(tokens.error.message);
	let value = evaluate(response[1], tokens.data);
	if (isFailure(value)) return invalid(`The path "${reference.path}" does not resolve.`);
	return value;
}

/**
 * Applies `tokens` to `value`. A `*` on an array applies the remaining tokens to each item
 * and concatenates the results, spreading any result that is itself an array.
 *
 * @param value - The value the remaining tokens apply to.
 * @param tokens - Unescaped reference tokens.
 */
function evaluate(value: unknown, tokens: readonly string[]): Result<unknown, Error> {
	let [token, ...rest] = tokens;
	if (token === undefined) return success(value);
	if (token === "*" && Array.isArray(value)) {
		let mapped: unknown[] = [];
		for (let item of value) {
			let result = evaluate(item, rest);
			if (isFailure(result)) return result;
			if (Array.isArray(result.data)) mapped.push(...(result.data as unknown[]));
			else mapped.push(result.data);
		}
		return success(mapped);
	}
	let next = get(value, stringify([token]));
	if (isFailure(next)) return next;
	return evaluate(next.data, rest);
}

/**
 * The error a server answers when a reference fails to resolve.
 *
 * @param description - What failed.
 */
function invalid(description: string): Result<never, JMAPMethodError> {
	return failure(new JMAPMethodError("", { type: "invalidResultReference", description }));
}
