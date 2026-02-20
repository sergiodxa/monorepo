---
title: React Router Loaders and Actions as Integration Points
excerpt: Test your business logic, not your loaders and actions. Treat them as integration points and avoid mocking nightmares.
technologies: react-router@7.0.0
---

Often times, I get people asking how to test React Router loaders and actions. And while testing them in isolation is possible and not too difficult, it’s not how they are meant to be used. They are designed to be used as integration points for your application, and that’s how you should treat them.

First let me give you a simple example of how to test a loader and an action.

```ts {% path="app/routes/users.$userId/route.test.ts" %}
import { describe, test, expect } from "bun:test";
import { RouterContextProvider } from "react-router";

import { loader, action } from "./route";

describe(loader, () => {
	test("returns the expected data", async () => {
		let request = new Request("https://example.com/users/123");
		let context = new RouterContextProvider();
		let params = { userId: "123" };

		// call context.set with every thing a middleware would set

		let result = await loader({ request, context, params });

		expect(result.data).toEqual({ user: { id: "123", name: "John Doe" } });
		expect(result.init?.status).toBe(200);
		expect(result.init?.headers.get("Cache-Control")).toBe("max-age=3600");
	});
});

describe(action, () => {
	test("returns the expected data", async () => {
		let context = new RouterContextProvider();
		let params = { userId: "123" };

		let request = new Request("https://example.com/users/123", {
			method: "POST",
			body: new URLSearchParams({ name: "John Doe" }),
		});

		// call context.set with every thing a middleware would set

		let result = await action({ request, context, params });

		expect(result.data).toEqual({ success: true });
		expect(result.init?.status).toBe(200);
	});
});
```

The main issue with this approach is that it works great for simple functions, but what happens when your functions requires authentication? Or authorization? Or need to query a database? Or call an external API? In those cases, you would need to mock all of those dependencies, which can quickly become a nightmare.

This is why I recommend to consider loaders and actions as integration points, they're the place where you integrate the HTTP layer with the rest of your application. So instead of testing them in isolation, you should test your application business logic. Let me give you an example of what I mean, let's say we have this action from the example above, as you could have infered from the test, it updates a user with the name provided in the request body

```ts {% path="app/routes/users.$userId/route.test.ts" %}
import { authorize } from "~/lib/auth";
import { isFailure } from "~/lib/result";
import { badRequest, ok, notFound, unauthorized } from "~/lib/response";
import { validate } from "~/lib/validation";

import { User } from "~/models/user";

const BodySchema = z.object({ name: z.string().min(1) });

export async function action({ request, context, params }: Route.ActionArgs) {
	if (!(await authorize(context))) return unauthorized({ errors: [{ message: "Unauthorized" }] });

	let result = await validate(BodySchema, request);
	if (isFailure(result)) return badRequest({ errors: result.errors });

	let user = await User.find(params.userId);
	if (!user) return notFound({ errors: [{ message: "User not found" }] });

	await user.update({ name: result.value.name });

	return ok({ success: true });
}
```

As you see, the action is the place where you:

1. Use the `request`, `context`, and `params` provided by React Router to read the input data (e.g. the user ID from the URL, the request body, or the authentication information from the context).
2. Integrate with your application business logic (e.g. validating the input, checking authorization, querying the database, etc).
3. Return a response using the `ok`, `badRequest`, `notFound`, or `unauthorized` helpers.

So how we could better test this action? Simply test `User.find` and `user.update` in isolation.

```ts {% path="app/models/user.test.ts" %}
import { describe, test, expect } from "bun:test";
import { factory } from "~/lib/factory";

import { User } from "./user";

describe(User.find, () => {
	test("returns a user if it exists", async () => {
		await factory(User).create({ id: "123", name: "John Doe" });

		let user = await User.find("123");
		expect(user).toBeDefined();
		expect(user?.id).toBe("123");
		expect(user?.name).toBe("John Doe");
	});

	test("returns null if the user does not exist", async () => {
		let user = await User.find("non-existent-id");
		expect(user).toBeNull();
	});
});

describe(User.prototype.update, () => {
	test("updates the user's name", async () => {
		await factory(User).create({ id: "123", name: "John Doe" });

		let user = await User.find("123");
		await user!.update({ name: "Jane Doe" });

		let updatedUser = await User.find("123");
		expect(updatedUser).toBeDefined();
		expect(updatedUser?.name).toBe("Jane Doe");
	});
});
```

Then we can also test the helper functions our action calls.

```ts {% path="app/lib/validation.test.ts" %}
import { describe, test, expect } from "bun:test";
import { validate } from "./validation";
import { z } from "zod";

const BodySchema = z.object({ name: z.string().min(1) });

describe(validate, () => {
	test("returns the parsed value if the validation succeeds", async () => {
		let request = new Request("https://example.com", {
			method: "POST",
			body: new URLSearchParams({ name: "John Doe" }),
		});

		let result = await validate(BodySchema, request);

		expect(result).toEqual({
			success: true,
			value: { name: "John Doe" },
		});
	});

	// More tests for validation failures, etc.
});
```

```ts {% path="app/lib/auth.test.ts" %}
import { describe, test, expect } from "bun:test";
import { RouterContextProvider } from "react-router";

import { authorize, userContext } from "./auth";

describe(authorize, () => {
	test("returns true if the user is authenticated", async () => {
		let context = new RouterContextProvider();
		context.set(userContext, { id: "123", name: "John Doe" });

		let result = await authorize(context);

		expect(result).toBe(true);
	});

	// More tests for unauthenticated users, etc.
});
```

By testing the business logic in isolation, we can ensure that our loaders and actions are working correctly without having to worry about the complexities of mocking the HTTP layer. This also makes our tests more focused and easier to maintain.

Finally, if you want to test the integration of your loaders and actions with the HTTP layer, you can write end-to-end tests using a tool like Playwright. This way, you can test the entire flow of your application, from the HTTP request to the response, without having to worry about mocking anything.
