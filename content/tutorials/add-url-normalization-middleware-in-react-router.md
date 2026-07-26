---
title: How to Add URL Normalization Middleware in React Router
excerpt: Normalize URLs by removing trailing slashes and www prefixes using React Router middleware.
technologies: react-router@8.0.0
---

Inconsistent URLs hurt your SEO. Search engines treat `/about` and `/about/` as different pages, splitting your page authority and creating duplicate content issues. The same applies to `www.example.com` versus `example.com`: two URLs pointing to the same content.

React Router's [middleware API](/tutorials/use-middleware-in-react-router) lets you normalize URLs before they reach your route handlers. You can intercept requests, check for trailing slashes or `www` prefixes, and redirect to the canonical version in one place.

#### Create the Trailing Slash Middleware

First, let's create a middleware that removes trailing slashes from URLs. This middleware checks if the URL ends with a slash (except for the root path `/`) and redirects to the same URL without the trailing slash.

```ts {% path="app/middleware/no-trailing-slash.ts" %}
import type { MiddlewareFunction } from "react-router";

import { redirect } from "react-router";

function createNoTrailingSlashMiddleware(): MiddlewareFunction<Response> {
	return async function noTrailingSlashMiddleware({ request }, next) {
		let url = new URL(request.url);

		if (url.pathname.endsWith("/") && url.pathname !== "/") {
			throw redirect(url.toString().slice(0, url.toString().length - 1));
		}

		return await next();
	};
}

export const noTrailingSlashMiddleware = createNoTrailingSlashMiddleware();
```

The middleware parses the request URL and checks if the pathname ends with a slash. If it does (and it's not the root path), it throws a redirect to the URL without the trailing slash. The `throw redirect()` pattern short circuits the middleware chain and immediately sends the redirect response to the client.

#### Create the WWW Removal Middleware

Next, let's create a middleware that removes the `www.` prefix from hostnames. This is useful when you want to canonicalize your URLs to the non-www version.

```ts {% path="app/middleware/no-www.ts" %}
import type { MiddlewareFunction } from "react-router";

import { redirect } from "react-router";

function createNoWWWMiddleware(): MiddlewareFunction<Response> {
	return async function noWWWMiddleware({ request }, next) {
		let url = new URL(request.url);

		if (url.hostname.startsWith("www.")) {
			url.hostname = url.hostname.slice(4);
			throw redirect(url.href, 302);
		}

		return await next();
	};
}

export const noWWWMiddleware = createNoWWWMiddleware();
```

This middleware checks if the hostname starts with `www.` and, if so, removes it and redirects to the new URL. The redirect uses a 302 status code, which is appropriate for this type of redirect since it's not a permanent change to the resource location.

#### Register the Middleware in Your Root Route

Now you need to register both middleware functions in your root route module. By placing them in the root route, they will run for every request to your application.

```tsx {% path="app/root.tsx" %}
import { noTrailingSlashMiddleware } from "~/middleware/no-trailing-slash";
import { noWWWMiddleware } from "~/middleware/no-www";

export const middleware = [
	noWWWMiddleware,
	noTrailingSlashMiddleware,
	// ... other middleware
];

// ... rest of your root route
```

The order of middleware matters. By placing `noWWWMiddleware` before `noTrailingSlashMiddleware`, you ensure that the hostname is normalized first, then the path. This way, if a user visits `https://www.example.com/about/`, the middleware will first redirect to `https://example.com/about/` and then to `https://example.com/about` in the next step.

#### Understanding the Factory Pattern

You might notice that both middleware functions use a factory pattern: a function that returns the actual middleware function. This pattern is useful when you need to configure the middleware with options.

```ts {% path="app/middleware/example.ts" %}
import type { MiddlewareFunction } from "react-router";

import { redirect } from "react-router";

interface Options {
	statusCode?: number;
}

function createNoTrailingSlashMiddleware(options: Options = {}): MiddlewareFunction<Response> {
	let { statusCode = 301 } = options;

	return async function noTrailingSlashMiddleware({ request }, next) {
		let url = new URL(request.url);

		if (url.pathname.endsWith("/") && url.pathname !== "/") {
			throw redirect(url.toString().slice(0, url.toString().length - 1), statusCode);
		}

		return await next();
	};
}

export const noTrailingSlashMiddleware = createNoTrailingSlashMiddleware({
	statusCode: 308,
});
```

With this pattern, you can customize the redirect status code or add other configuration options without modifying the core middleware logic.

#### Testing the Middleware

To verify your middleware is working correctly, you can test it by visiting URLs with trailing slashes or the `www.` prefix:

- `https://www.example.com/about/` should redirect to `https://example.com/about`
- `https://example.com/about/` should redirect to `https://example.com/about`
- `https://www.example.com/` should redirect to `https://example.com/`

The middleware runs on every request, so all your routes benefit from URL normalization automatically. For SEO, you may also want to [add dynamic canonical URLs](/tutorials/add-dynamic-canonical-url-to-remix-routes) to your pages.
