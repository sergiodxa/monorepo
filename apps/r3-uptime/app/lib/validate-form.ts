/**
 * Validates `FormData`/`URLSearchParams` against a `remix/data-schema/form-data`
 * `f.object()` schema. `@pkg/validate`'s `validate()` always flattens `FormData`/
 * `URLSearchParams` into a plain object before handing it to the schema, but
 * `f.object()` schemas require the raw `FormData`/`URLSearchParams` instance itself
 * (they read fields via `.get()`/`.getAll()`) — so every `f.object()` schema rejects
 * the flattened object with a "type.form_data_source" issue. This wraps
 * `remix/data-schema`'s own `parseSafe()`, which passes the input through
 * unconverted, in the same `@pkg/result` contract `@pkg/validate`'s `validate()`
 * uses, so call sites are unaffected. Exists as a local fix, not a change to
 * `@pkg/validate`, since no other app in the monorepo pairs it with `f.object()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";
import type { InferOutput, Schema as DataSchema } from "remix/data-schema";

import { failure, success } from "@pkg/result";
import { ValidationError } from "@pkg/validate";
import * as s from "remix/data-schema";

/** Validates form data against an `f.object()` schema without a lossy conversion. */
export function validateForm<Schema extends DataSchema<any, any>>(
	input: FormData | URLSearchParams,
	schema: Schema,
): Result<InferOutput<Schema>, ValidationError> {
	let result = s.parseSafe(schema, input);

	if (!result.success) return failure(new ValidationError(result.issues));

	return success(result.value);
}
