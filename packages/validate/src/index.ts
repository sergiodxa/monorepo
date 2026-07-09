import type { Result } from "@pkg/result";
import type { JSONValue } from "@pkg/types";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { success, failure, isFailure } from "@pkg/result";

import { ValidationError } from "./validation-error";

export { ValidationError };

/**
 * Convert FormData to object, properly handling arrays (multiple values with same key)
 */
function formDataToObject(formData: FormData): Record<string, unknown> {
	let data = new Map<string, FormDataEntryValue | FormDataEntryValue[] | undefined>();
	let keys = new Set(formData.keys());

	for (let key of keys) {
		let values = formData.getAll(key);
		data.set(key, values.length === 1 ? values.at(0) : values);
	}

	return Object.fromEntries(data.entries());
}

/**
 * Convert URLSearchParams to object, properly handling arrays (multiple values with same key)
 */
function urlSearchParamsToObject(params: URLSearchParams): Record<string, unknown> {
	let data = new Map<string, string | string[] | undefined>();
	let keys = new Set(params.keys());

	for (let key of keys) {
		let values = params.getAll(key);
		data.set(key, values.length === 1 ? values.at(0) : values);
	}

	return Object.fromEntries(data.entries());
}

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

		// Some schemas (e.g. `remix/data-schema/form-data`'s `object()`) validate the
		// raw `FormData`/`URLSearchParams` source directly instead of a flattened
		// plain object, and reject anything else with this exact message. Retry with
		// the raw source before giving up, so both schema styles work through this
		// one `validate()` call without changing behavior for schemas that already
		// succeed against the flattened object.
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
