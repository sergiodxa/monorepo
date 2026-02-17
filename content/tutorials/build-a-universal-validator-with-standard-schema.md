---
title: How to Build a Universal Validator with Standard Schema
excerpt: Create a schema agnostic validation function that works with Zod, Valibot, or any Standard Schema library.
technologies: @standard-schema/spec@1.0.0
---

When building web applications, you often need to validate user input from forms, API requests, or URL parameters. Most developers reach for a validation library like Zod or Valibot, but what if you want to build a reusable validation utility that works with any of them?

The Standard Schema specification defines a common interface that validation libraries can implement, allowing you to write code that works with any compliant library. This means you can build a single `validate` function that accepts `FormData`, `URLSearchParams`, `Request` objects, or plain objects, and validates them against any Standard Schema compliant library. This is especially useful when [validating forms with client actions](/tutorials/validate-form-in-remix-with-clientaction) where you want the same validation logic on both client and server.

## Define the Result Type

First, define a simple [Result type](/articles/result-objects-in-ts) to handle success and failure cases explicitly:

```ts {% path="lib/result.ts" %}
export type Result<T, E> = { success: true; data: T } | { success: false; error: E };

export function success<T>(data: T): Result<T, never> {
	return { success: true, data };
}

export function failure<E>(error: E): Result<never, E> {
	return { success: false, error };
}

export function isFailure<T, E>(result: Result<T, E>): result is { success: false; error: E } {
	return !result.success;
}
```

This [Result pattern](/articles/result-objects-in-ts) makes error handling explicit and avoids throwing exceptions.

## Define the Validation Error Class

Next, create a custom error class that wraps the validation issues from Standard Schema:

```ts {% path="lib/validation-error.ts" %}
import type { StandardSchemaV1 } from "@standard-schema/spec";

export class ValidationError extends Error {
	issues: StandardSchemaV1.Issue[];

	constructor(issues: readonly StandardSchemaV1.Issue[]) {
		super("Validation Error");
		this.issues = [...issues];
	}
}
```

This class stores the validation issues in a format that any Standard Schema library can produce. The `StandardSchemaV1.Issue` type is part of the spec and includes properties like `message` and `path`.

## Convert FormData and URLSearchParams to Objects

Before validating, you need to convert web platform types to plain objects. The tricky part is handling multiple values with the same key, which is common in forms with checkboxes or multi-select inputs:

```ts {% path="lib/validate.ts" %}
function formDataToObject(formData: FormData): Record<string, unknown> {
	let data: Record<string, unknown> = {};
	let keys = new Set(formData.keys());

	for (let key of keys) {
		let values = formData.getAll(key);
		data[key] = values.length === 1 ? values[0] : values;
	}

	return data;
}

function urlSearchParamsToObject(params: URLSearchParams): Record<string, unknown> {
	let data: Record<string, unknown> = {};
	let keys = new Set(params.keys());

	for (let key of keys) {
		let values = params.getAll(key);
		data[key] = values.length === 1 ? values[0] : values;
	}

	return data;
}
```

Both functions use `getAll` to retrieve all values for a key. If there's only one value, it returns it directly; otherwise, it returns an array. This matches how most validation schemas expect data. For a deeper look at handling all the edge cases, see [how to parse multiple input formats in one validator](/tutorials/parse-multiple-input-formats-in-one-validator).

## Create the Universal Validate Function

Now build the main `validate` function that handles all input types and delegates to the Standard Schema interface:

```ts {% path="lib/validate.ts" %}
import type { StandardSchemaV1 } from "@standard-schema/spec";

import type { Result } from "./result";
import { success, failure } from "./result";
import { ValidationError } from "./validation-error";

export { ValidationError };

type JSONValue = string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue };

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

	if (input instanceof FormData) {
		let data = formDataToObject(input);
		return validate(data, schema);
	}

	if (input instanceof URLSearchParams) {
		let data = urlSearchParamsToObject(input);
		return validate(data, schema);
	}

	let result = schema["~standard"].validate(input);
	if (result instanceof Promise) result = await result;

	if (result.issues) {
		return failure(new ValidationError(result.issues));
	}

	return success(result.value);
}
```

The function uses the [Result pattern](/articles/result-objects-in-ts) to return either a success with the validated data or a failure with a `ValidationError`. This avoids throwing exceptions and makes error handling explicit.

## Use the Validator in a React Router Action

Here's how you can use the validator in a React Router action to [validate form submissions](/tutorials/validate-form-in-remix-with-clientaction):

```tsx {% path="app/routes/posts.create.tsx" %}
import { data, redirect } from "react-router";
import { z } from "zod";

import type { Route } from "./+types/posts.create";

import { isFailure } from "~/lib/result";
import { validate } from "~/lib/validate";

let schema = z.object({
	title: z.string().min(1, "Title is required"),
	content: z.string().min(10, "Content must be at least 10 characters"),
});

export async function action({ request }: Route.ActionArgs) {
	let result = await validate(request, schema);

	if (isFailure(result)) {
		return data({ errors: result.error.issues }, { status: 400 });
	}

	let post = await createPost(result.data);
	return redirect(`/posts/${post.id}`);
}
```

The `validate` function automatically parses the request body based on the content type and validates it against the Zod schema. You can swap Zod for Valibot or any other Standard Schema compliant library without changing the validation logic.

## Validate URL Search Parameters

The same function works for validating query parameters in loaders:

```ts {% path="app/routes/posts.tsx" %}
import { z } from "zod";

import type { Route } from "./+types/posts";

import { isFailure } from "~/lib/result";
import { validate } from "~/lib/validate";

let schema = z.object({
	page: z.coerce.number().default(1),
	limit: z.coerce.number().default(10),
});

export async function loader({ request }: Route.LoaderArgs) {
	let url = new URL(request.url);
	let result = await validate(url.searchParams, schema);

	if (isFailure(result)) {
		return { posts: [], pagination: { page: 1, limit: 10 } };
	}

	let posts = await getPosts(result.data.page, result.data.limit);
	return { posts, pagination: result.data };
}
```

By passing `url.searchParams` directly to `validate`, you get the same type safe validation for query parameters.

## Final Thoughts

Building a universal validator with Standard Schema gives you flexibility to choose or switch validation libraries without rewriting your validation logic. The [Result pattern](/articles/result-objects-in-ts) makes error handling explicit and composable, while [supporting multiple input types](/tutorials/parse-multiple-input-formats-in-one-validator) like `Request`, `FormData`, and `URLSearchParams` covers the common cases in web applications.
