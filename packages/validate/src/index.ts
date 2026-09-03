/**
 * Normalizes `FormData`, `URLSearchParams`, `Request` bodies, and plain
 * objects into a single value, then runs it through a Standard Schema,
 * returning a `Result` instead of throwing on failure.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";
import type { JSONValue } from "@sdxc/types";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { success, failure, isFailure } from "@sdxc/result";

import { ValidationError } from "./validation-error.js";

export { ValidationError };

function formDataToObject(formData: FormData): Record<string, unknown> {
	let data = new Map<string, FormDataEntryValue | FormDataEntryValue[] | undefined>();
	let keys = new Set(formData.keys());

	for (let key of keys) {
		let values = formData.getAll(key);
		data.set(key, values.length === 1 ? values.at(0) : values);
	}

	return Object.fromEntries(data.entries());
}

function urlSearchParamsToObject(params: URLSearchParams): Record<string, unknown> {
	let data = new Map<string, string | string[] | undefined>();
	let keys = new Set(params.keys());

	for (let key of keys) {
		let values = params.getAll(key);
		data.set(key, values.length === 1 ? values.at(0) : values);
	}

	return Object.fromEntries(data.entries());
}

/**
 * Some schemas (e.g. `remix/data-schema/form-data`'s `object()`) validate
 * the raw `FormData`/`URLSearchParams` source instead of a flattened plain
 * object; a raw-source rejection triggers a retry against that raw source.
 */
export async function validate<Schema extends StandardSchemaV1>(
	input: FormData | URLSearchParams | Request | Record<string, unknown> | JSONValue,
	schema: Schema,
): Promise<Result<StandardSchemaV1.InferOutput<Schema>, ValidationError>> {
	if (input instanceof Request) {
		let contentType = input.headers.get("content-type");

		if (contentType?.includes("application/json")) {
			try {
				let data = (await input.json()) as Record<string, unknown>;
				return validate(data, schema);
			} catch {
				return failure(new ValidationError([{ message: "Invalid JSON in request body" }]));
			}
		}

		if (contentType?.includes("application/x-www-form-urlencoded")) {
			let text = await input.text();
			let params = new URLSearchParams(text);
			return validate(params, schema);
		}

		if (contentType?.includes("multipart/form-data")) {
			let formData = await input.formData();
			return validate(formData, schema);
		}

		return failure(
			new ValidationError([
				{
					message: `Unsupported content-type: ${contentType}. Expected application/json, multipart/form-data, or application/x-www-form-urlencoded`,
				},
			]),
		);
	}

	if (input instanceof FormData || input instanceof URLSearchParams) {
		let data = input instanceof FormData ? formDataToObject(input) : urlSearchParamsToObject(input);
		let result = await validate(data, schema);

		let wantsRawSource =
			isFailure(result) &&
			result.error.issues.some((issue) => issue.message === "Expected FormData or URLSearchParams");

		if (!wantsRawSource) {
			return result;
		}

		let rawResult = schema["~standard"].validate(input);
		if (rawResult instanceof Promise) rawResult = await rawResult;

		if (rawResult.issues) {
			return failure(new ValidationError(rawResult.issues));
		}

		return success(rawResult.value);
	}

	let result = schema["~standard"].validate(input);
	if (result instanceof Promise) result = await result;

	if (result.issues) {
		return failure(new ValidationError(result.issues));
	}

	return success(result.value);
}
