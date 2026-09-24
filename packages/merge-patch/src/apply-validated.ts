/**
 * Applies a merge patch and validates the resource it produces, so a server accepts a
 * patch exactly when the result is a valid resource and one schema serves create and update.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { failure, success } from "@sdxc/result";

import type { JSONValue } from "./json-value.js";

import { apply } from "./apply.js";

/** Signals that the patched resource fails its schema. */
export class MergePatchValidationError extends Error {
	override name = "MergePatchValidationError";

	/**
	 * Standard Schema issues with paths into the patched result, which for every member the
	 * patch touched are the paths the patch used; `issuesFrom` in `@sdxc/problem` maps them.
	 */
	readonly issues: readonly StandardSchemaV1.Issue[];

	/** @param issues - What the schema reported. */
	constructor(issues: readonly StandardSchemaV1.Issue[]) {
		super(issues[0]?.message ?? "The patched resource is invalid.");
		this.issues = issues;
	}
}

/**
 * Applies `patch` to `target` and validates the result with `schema`. A patch removing a
 * required member fails on that member. The schema must validate synchronously, as
 * `remix/data-schema` does; one that returns a promise fails with a single issue.
 *
 * @param target - The resource as it is now, in the shape the schema reads.
 * @param patch - The merge patch document.
 * @param schema - The resource's schema, usually the one its create endpoint uses.
 * @returns The patched resource as the schema outputs it, or the schema's issues.
 * @template Output - What the schema produces.
 */
export function applyValidated<Output>(
	target: JSONValue,
	patch: JSONValue,
	schema: StandardSchemaV1<unknown, Output>,
): Result<Output, MergePatchValidationError> {
	let result = schema["~standard"].validate(apply(target, patch));

	if (result instanceof Promise) {
		return failure(
			new MergePatchValidationError([
				{
					message:
						"The schema validates asynchronously; applyValidated needs a synchronous schema.",
				},
			]),
		);
	}

	if (result.issues) return failure(new MergePatchValidationError(result.issues));
	return success(result.value);
}
