---
title: How to Build an API Client with Before/After Hooks
excerpt: Create a reusable API client base class with hooks for authentication and error handling.
tech: @edgefirst-dev/api-client@1.0.0
---

When integrating with external APIs, you often need to add authentication headers to every request and handle errors consistently across all endpoints. Writing this logic repeatedly for each API call leads to duplication and makes it harder to maintain.

A better approach is to create a base API client class that handles these cross-cutting concerns automatically. By using before and after hooks, you can inject authentication headers before requests are sent and handle errors uniformly after responses are received.

## Install the API Client Package

First, install the `@edgefirst-dev/api-client` package:

```txt
npm install @edgefirst-dev/api-client
```

This package provides a base `APIClient` class with built-in support for HTTP methods and extensible hooks for request/response processing.

## Create the API Client Class

Create a new file for your API client. In this example, we'll build a client for the Buttondown email API:

```ts {% path="app/services/buttondown.ts" %}
import { APIClient } from "@edgefirst-dev/api-client";

class Buttondown extends APIClient {
	constructor(protected override readonly options: { apiKey: string; fetch: typeof fetch }) {
		super(new URL("https://api.buttondown.com"), options);
	}
}
```

The constructor takes an options object with the API key and a `fetch` function. Passing `fetch` explicitly is important when running in environments like Cloudflare Workers, where you need to bind `globalThis.fetch` to avoid "Illegal invocation" errors.

## Add the Before Hook for Authentication

Override the `before` method to add authentication headers to every request:

```ts {% path="app/services/buttondown.ts" %}
protected override before(request: Request): Promise<Request> {
	request.headers.set("Authorization", `Token ${this.options.apiKey}`);
	request.headers.set("Content-Type", "application/json");
	return Promise.resolve(request);
}
```

This hook runs before every request is sent. It adds the API token and content type headers automatically, so you don't need to include them in each individual API call.

## Add the After Hook for Error Handling

Override the `after` method to handle errors consistently:

```ts {% path="app/services/buttondown.ts" %}
protected override async after(_: Request, response: Response): Promise<Response> {
	if (response.status === 403) {
		logger.error("buttondown_forbidden", { status: response.status });
		throw new Error("Forbidden");
	}
	return response;
}
```

This hook runs after every response is received. It checks for specific error conditions and handles them uniformly. In this case, a 403 response logs the error and throws an exception.

## Add API Methods

Now add methods for specific API endpoints. The base class provides `get`, `post`, `patch`, and other HTTP methods:

```ts {% path="app/services/buttondown.ts" %}
async isSubscribed(email: string) {
	const response = await this.get(`/v1/subscribers/${email}`);
	let subscribed = response.ok;
	logger.info("buttondown_subscriber_check", { email, subscribed });
	return subscribed;
}

async subscribe(
	email: string,
	utm: { source?: string; campaign?: string; medium?: string },
	ipAddress: string | null,
) {
	const response = await this.post("/v1/subscribers", {
		body: JSON.stringify({
			email,
			utm_source: utm.source,
			utm_campaign: utm.campaign,
			utm_medium: utm.medium,
			ip_address: ipAddress ?? undefined,
		}),
	});

	if (response.ok) {
		logger.info("buttondown_subscribe_success", { email });
		return await response.json();
	}

	let error = await z
		.object({ code: z.string(), detail: z.string() })
		.parseAsync(await response.json());

	logger.error("buttondown_subscribe_error", { email, code: error.code });
	throw new ButtondownError(error.detail, error.code);
}
```

Each method focuses only on its specific logic. The authentication and common error handling are already taken care of by the hooks.

## Create a Custom Error Class

For better error handling, create a custom error class that includes API-specific information:

```ts {% path="app/services/buttondown.ts" %}
export class ButtondownError extends Error {
	override name = "ButtondownError";

	constructor(
		message: string,
		public readonly code: string,
	) {
		super(message);
	}
}
```

This allows callers to catch and handle API-specific errors with access to the error code returned by the API. For more complex error handling, consider using [Result objects](/articles/result-objects-in-ts) instead of throwing exceptions.

## Export the Client Instance

Finally, create and export a singleton instance of your client:

```ts {% path="app/services/buttondown.ts" %}
import { env } from "cloudflare:workers";

if (!env.BUTTONDOWN_API_KEY) {
	throw new Error("BUTTONDOWN_API_KEY is required");
}

export default new Buttondown({
	apiKey: env.BUTTONDOWN_API_KEY,
	fetch: globalThis.fetch.bind(globalThis),
});
export type { Buttondown };
```

Note the use of `globalThis.fetch.bind(globalThis)` when passing the fetch function. This is necessary in Cloudflare Workers to avoid "Illegal invocation" errors.

## Use the Client in Your Routes

Now you can import and use the client anywhere in your application:

```ts {% path="app/routes/subscribe.ts" %}
import buttondown from "~/services/buttondown";

export async function action({ request }: Route.ActionArgs) {
	let formData = await request.formData();
	let email = formData.get("email") as string;

	let isSubscribed = await buttondown.isSubscribed(email);
	if (!isSubscribed) {
		await buttondown.subscribe(email, {}, null);
	}

	return { success: true };
}
```

The client handles authentication and error handling automatically, keeping your route code clean and focused on business logic.

## Final Thoughts

This pattern works well for any HTTP API integration. The before hook handles authentication, custom headers, or request logging. The after hook handles error responses, rate limiting, or response transformation—you could even check for [misleading status codes](/articles/why-status-codes-lie-in-health-checks) here. By centralizing this logic in a base class, you ensure consistent behavior across all API calls and make it easier to update the integration in one place.
