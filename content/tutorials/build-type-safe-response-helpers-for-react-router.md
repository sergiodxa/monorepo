---
title: How to Build Type-Safe Response Helpers for React Router
excerpt: Create response helpers that add an ok property for easy success and error checking in loaders and actions.
technologies: react-router@7.0.0
---

When building React Router applications, you often need to return different HTTP status codes from your loaders and actions. A 200 for success, 400 for validation errors, 404 when a resource is not found, and so on. The challenge is that checking the status code in your components requires accessing the response object, which can be cumbersome. This is especially useful when you [expose routes as API endpoints](/tutorials/expose-remix-routes-as-api-endpoints).

A better approach is to add an `ok` property directly to your response data. Success responses (2xx) get `ok: true`, while error responses (4xx, 5xx) get `ok: false`. This makes it trivial to check the result in your components: just check `if (data.ok)` instead of inspecting status codes.

## Create the Base Response Type

Start by creating a file for your response helpers. You will use React Router's `data` function to return typed responses with the correct status codes.

```ts {% path="app/lib/response.ts" %}
import { data } from "react-router";

type Init = Omit<ResponseInit, "status" | "statusText">;
```

The `Init` type removes `status` and `statusText` from `ResponseInit` because each helper will set its own status code. This prevents accidentally overriding the intended status.

## Build Success Response Helpers

Create helpers for common success status codes. Each one spreads the input data and adds `ok: true as const` so TypeScript knows the exact value.

```ts {% path="app/lib/response.ts" %}
export function ok<T>(input: T, init?: Init) {
	return data({ ...input, ok: true as const }, { ...init, status: 200 });
}

export function created<T>(input: T, init?: Init) {
	return data({ ...input, ok: true as const }, { ...init, status: 201 });
}

export function accepted<T>(input: T, init?: Init) {
	return data({ ...input, ok: true as const }, { ...init, status: 202 });
}

export function noContent(init?: Init) {
	return data(null, { ...init, status: 204 });
}
```

The `as const` assertion is critical here. It tells TypeScript that `ok` is literally `true`, not just `boolean`. This enables discriminated unions when you combine success and error responses.

## Build Client Error Response Helpers

Create helpers for 4xx client errors. These use `ok: false as const` to indicate failure.

```ts {% path="app/lib/response.ts" %}
export function badRequest<T>(input: T, init?: Init) {
	return data({ ...input, ok: false as const }, { ...init, status: 400 });
}

export function unauthorized<T>(input: T, init?: Init) {
	return data({ ...input, ok: false as const }, { ...init, status: 401 });
}

export function forbidden<T>(input: T, init?: Init) {
	return data({ ...input, ok: false as const }, { ...init, status: 403 });
}

export function notFound<T>(input: T, init?: Init) {
	return data({ ...input, ok: false as const }, { ...init, status: 404 });
}

export function conflict<T>(input: T, init?: Init) {
	return data({ ...input, ok: false as const }, { ...init, status: 409 });
}

export function unprocessableEntity<T>(input: T, init?: Init) {
	return data({ ...input, ok: false as const }, { ...init, status: 422 });
}

export function tooManyRequests<T>(input: T, init?: Init) {
	return data({ ...input, ok: false as const }, { ...init, status: 429 });
}
```

You can add more helpers as needed: `paymentRequired` (402), `methodNotAllowed` (405), `notAcceptable` (406), `gone` (410), `preconditionFailed` (412), `requestEntityTooLarge` (413), and `unsupportedMediaType` (415).

## Build Server Error Response Helpers

Create helpers for 5xx server errors. These also use `ok: false as const`.

```ts {% path="app/lib/response.ts" %}
export function internalServerError<T>(input: T, init?: Init) {
	return data({ ...input, ok: false as const }, { ...init, status: 500 });
}

export function notImplemented<T>(input: T, init?: Init) {
	return data({ ...input, ok: false as const }, { ...init, status: 501 });
}

export function badGateway<T>(input: T, init?: Init) {
	return data({ ...input, ok: false as const }, { ...init, status: 502 });
}

export function serviceUnavailable<T>(input: T, init?: Init) {
	return data({ ...input, ok: false as const }, { ...init, status: 503 });
}

export function gatewayTimeout<T>(input: T, init?: Init) {
	return data({ ...input, ok: false as const }, { ...init, status: 504 });
}
```

## Use the Helpers in an Action

Now you can use these helpers in your route actions. The `ok` property makes it easy to handle different outcomes.

```ts {% path="app/routes/posts.create.ts" %}
import type { Route } from "./+types/posts.create";
import { ok, badRequest, unauthorized } from "~/lib/response";
import { z } from "zod";

export async function action({ request, context }: Route.ActionArgs) {
	let user = context.get(userContext);

	if (!user) {
		return unauthorized({ message: "You must be logged in to create a post." });
	}

	let formData = await request.formData();

	let result = z
		.object({ title: z.string().min(1), content: z.string().min(1) })
		.safeParse(Object.fromEntries(formData));

	if (!result.success) {
		return badRequest({
			message: "Invalid input data",
			errors: result.error.flatten().fieldErrors,
		});
	}

	let post = await Post.create({
		userId: user.id,
		title: result.data.title,
		content: result.data.content,
	});

	return ok({ message: "Post created successfully", post });
}
```

Each response carries the appropriate status code and the `ok` property for easy checking. These helpers pair well with [action routes](/tutorials/use-action-routes-in-react-router) where you centralize form handling logic.

## Check the Response in Components

In your components, you can now check `actionData.ok` to determine success or failure. TypeScript will narrow the type based on this check.

```tsx {% path="app/routes/posts.new.tsx" %}
import type { Route } from "./+types/posts.new";
import { Form, useActionData } from "react-router";

export default function Component() {
	let actionData = useActionData<typeof action>();

	return (
		<Form method="post" action="/posts/create">
			{actionData && !actionData.ok && <div className="text-red-600">{actionData.message}</div>}

			{actionData?.ok && <div className="text-green-600">{actionData.message}</div>}

			<input type="text" name="title" placeholder="Title" />
			<textarea name="content" placeholder="Content" />
			<button type="submit">Create Post</button>
		</Form>
	);
}
```

When `actionData.ok` is `false`, TypeScript knows the response contains error data. When it is `true`, you have access to success data like `post`.

## Handle Responses in Client Actions

The `ok` property is especially useful in client actions where you want to show toasts or redirect based on the result.

```ts {% path="app/routes/posts.create.ts" %}
import { redirect } from "react-router";
import { toast } from "sonner";

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	let result = await serverAction();

	if (result.ok) {
		toast.success(result.message);
		return redirect(`/posts/${result.post.id}`);
	}

	toast.error(result.message);
	return result;
}
```

The discriminated union created by `ok: true as const` and `ok: false as const` gives you full type safety. Inside the `if (result.ok)` block, TypeScript knows `result.post` exists.

## Final Thoughts

This pattern provides a clean, type-safe way to handle responses in React Router. The `ok` property acts as a discriminator that TypeScript can use to narrow types, eliminating the need to check status codes manually. You get better developer experience with autocomplete and type checking, while keeping your response handling consistent across the entire application.
