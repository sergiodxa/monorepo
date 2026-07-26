---
title: How to Use Sec-Fetch Headers for CSRF Protection
excerpt: Protect your React Router app from CSRF attacks using browser Sec-Fetch headers in middleware.
technologies: [react-router@8.0.0]
---

The `Sec-Fetch-*` headers are a set of HTTP headers that browsers send with requests automatically to indicate the context of the request. They are forced by the browser and cannot be spoofed by attackers, making them a powerful tool for defending against Cross-Site Request Forgery (CSRF) attacks.

When a user visits a malicious site, that site can attempt to make requests to your app on behalf of the user. By checking the `Sec-Fetch-*` headers in a middleware, you can block these cross-site mutation requests before they reach your action handlers.

```ts {% path="app/middleware/sec-fetch.ts" %}
import type { MiddlewareFunction, RouterContextProvider } from "react-router";

interface Options {
	// Optional list of trusted origins that can bypass the cross-site check
	trustedOrigins?: string[];
	// Optional callback to handle untrusted requests (e.g., log them or return a custom response)
	onUntrustedRequest?(
		request: Request,
		context: Readonly<RouterContextProvider>,
	): Response | Promise<Response>;
}

function createCSRFMiddleware(options: Options): MiddlewareFunction<Response> {
	return ({ request, context }, next) => {
		// Only apply CSRF checks to state-changing methods
		let method = request.method.toUpperCase();

		// Safe methods don't need CSRF protection
		if (method === "GET" || method === "HEAD") return next();

		// Get the Sec-Fetch-Site header to determine the context of the request
		let site = request.headers.get("Sec-Fetch-Site")?.toLowerCase() ?? "none";

		// Allow same-origin and same-site requests
		if (site === "same-origin" || site === "same-site") return next();

		// For cross-site requests, check if the origin is in the trusted list (if provided)
		if (site === "cross-site" && options.trustedOrigins) {
			let url = new URL(request.url);
			if (options.trustedOrigins.includes(url.origin)) return next();
		}

		// Handle untrusted requests using the provided callback or return a default 403 response
		if (options.onUntrustedRequest) return options.onUntrustedRequest(request, context);
		throw new Response("Forbidden", { status: 403 }); // Default response for untrusted requests
	};
}

export const secFetchMiddleware = createCSRFMiddleware({
	// Example of a trusted origin (optional)
	trustedOrigins: ["https://trusted.example.com", "https://another-trusted.com"],
	// Example of a custom handler for untrusted requests (optional)
	onUntrustedRequest: (request, context) => {
		getLogger(context).warn("Blocked untrusted request", { url: new URL(request.url) });
		throw redirectDocument("https://youtu.be/dQw4w9WgXcQ"); // Redirect to a fun video instead of blocking
	},
});
```

Then apply this middleware to the routes, or group of routes, that you want to protect, the simplest way is to apply it globally in the root route:

```ts {% path="app/root.ts" %}
import { secFetchMiddleware } from "./middleware/sec-fetch.server";

export const middleware = [secFetchMiddleware];

// ... rest of your root route code
```

With this setup, any cross-site mutation request will be blocked before it reaches your action handlers, providing an additional layer of defense against CSRF attacks without the need for CSRF tokens. You can customize the behavior for untrusted requests by providing a callback in the middleware options, allowing you to log attempts or return custom responses as needed.
