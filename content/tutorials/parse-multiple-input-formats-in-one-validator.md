---
title: How to Parse Multiple Input Formats in One Validator
excerpt: Validate Request, FormData, URLSearchParams, and JSON with a single function using Standard Schema.
technologies: "@standard-schema/spec@1.0.0"
---

When building web applications, you often need to validate user input from different sources: form submissions, JSON API requests, URL query parameters, or even raw objects. Each format requires different parsing logic before validation, leading to repetitive code across your codebase. Whether you're validating [OAuth2 token requests](/articles/oauth2-tokens-explained) or simple contact forms, having a unified approach reduces bugs and improves maintainability.

The challenge is that `FormData` and `URLSearchParams` need to be converted to plain objects, `Request` objects need their body parsed based on the `Content-Type` header, and JSON needs error handling for malformed payloads. Instead of writing this logic everywhere, you can create a single validator function that handles all these formats automatically.

## Create the Validation Function

```ts {% path="lib/validate.ts" %}
import type { StandardSchemaV1 } from "@standard-schema/spec";

export async function validate<Schema extends StandardSchemaV1>(
	input: FormData | URLSearchParams | Request | Record<string, unknown>,
	schema: Schema,
): Promise<StandardSchemaV1.InferOutput<Schema>> {
	// Implementation will handle all input types
}
```

This function accepts any common input format and a Standard Schema compatible validator (like Zod, Valibot, or ArkType). The return type is automatically inferred from the schema.

## Handle Request Objects by Content Type

```ts {% path="lib/validate.ts" %}
if (input instanceof Request) {
	let contentType = input.headers.get("content-type");

	if (contentType?.includes("application/json")) {
		try {
			let data = await input.json();
			return validate(data, schema);
		} catch {
			throw new ValidationError([{ message: "Invalid JSON in request body" }]);
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

	throw new ValidationError([{ message: `Unsupported content-type: ${contentType}` }]);
}
```

The function checks the `Content-Type` header and parses the body accordingly. It recursively calls itself with the parsed data, so the same validation logic applies regardless of the original format.

## Convert FormData to Plain Objects

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
```

This helper converts `FormData` to a plain object while properly handling arrays. When a form has multiple inputs with the same name (like checkboxes), `getAll` returns all values as an array. Single values remain as strings.

## Convert URLSearchParams to Plain Objects

```ts {% path="lib/validate.ts" %}
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

The same logic applies to `URLSearchParams`. Query strings like `?tags=a&tags=b` become `{ tags: ["a", "b"] }`, while `?name=value` becomes `{ name: "value" }`.

## Validate the Parsed Data

```ts {% path="lib/validate.ts" %}
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
	throw new ValidationError(result.issues);
}

return result.value;
```

After converting the input to a plain object, the function uses the Standard Schema interface to validate it. The `~standard` property is the standard way to access validation in any compatible library.

## Use the Validator in Route Actions

```ts {% path="app/routes/posts.create.ts" %}
import { z } from "zod";
import { validate } from "~/lib/validate";

export async function action({ request }: Route.ActionArgs) {
	let schema = z.object({
		title: z.string().min(1),
		content: z.string().min(10),
	});

	let data = await validate(request, schema);

	// data is typed as { title: string; content: string }
	let post = await Post.create(data);

	return { post };
}
```

The same action handles both form submissions and JSON API requests. The validator automatically detects the format and parses it before validation. You can also [validate forms on the client side](/tutorials/validate-form-in-remix-with-clientaction) before submitting to provide instant feedback.

## Validate Query Parameters in Loaders

```ts {% path="app/routes/posts.ts" %}
import { z } from "zod";
import { validate } from "~/lib/validate";

export async function loader({ request }: Route.LoaderArgs) {
	let url = new URL(request.url);

	let schema = z.object({
		page: z.coerce.number().default(1),
		limit: z.coerce.number().default(10),
	});

	let { page, limit } = await validate(url.searchParams, schema);

	let posts = await Post.findMany({ page, limit });

	return { posts };
}
```

For query parameters, pass `url.searchParams` directly to the validator. The same schema handles type coercion and defaults.

## Final Thoughts

This pattern eliminates repetitive parsing code and ensures consistent validation across your application. By using Standard Schema, you can switch between Zod, Valibot, or any other compatible library without changing your validation logic. The recursive design keeps the code simple while handling all common input formats in web applications. You can also [validate forms on the client side](/tutorials/validate-form-in-remix-with-clientaction) using the same schemas to provide instant feedback before submission.

For a more comprehensive implementation that includes the [Result pattern](/articles/result-objects-in-ts) for explicit error handling, see [How to Build a Universal Validator with Standard Schema](/tutorials/build-a-universal-validator-with-standard-schema).
