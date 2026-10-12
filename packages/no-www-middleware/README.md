# @sdxc/no-www-middleware

Router middleware that permanently redirects a `www.` hostname to the apex domain, so a site answers on one host for search engines and for the cookies scoped to it.

## Installation

```sh
npm add @sdxc/no-www-middleware
```

It runs on a `remix/router` middleware chain, so [`remix`](https://www.npmjs.com/package/remix) (v3) installs alongside it.

## Usage

### Redirect to the apex domain

```typescript
import { noWWW } from "@sdxc/no-www-middleware";
import { createRouter } from "remix/router";

let router = createRouter({ middleware: [noWWW()] });

// GET https://www.example.com/posts?page=2 -> 308, Location: https://example.com/posts?page=2
// GET https://example.com/posts            -> the matched handler
// GET https://blog.example.com/            -> the matched handler
```

### The longhand

`noWWW()` stands in for this hand-written middleware:

```typescript
import type { Middleware } from "remix/router";

let stripWWW: Middleware = (context, next) => {
	let url = new URL(context.request.url);
	if (!url.hostname.startsWith("www.")) return next();
	url.hostname = url.hostname.slice(4);
	return new Response(null, { status: 308, headers: { Location: url.href } });
};
```

## API

### `noWWW(): Middleware`

Returns a middleware that answers a request whose hostname starts with the `www.` label with a `308` to the same URL minus that one label, keeping scheme, port, path and query string; every other request goes to `next()`. The hostname is matched as the URL parser lowercases it, so `WWW.Example.com` redirects to `example.com`, while `blog.www.example.com` and `wwwexample.com` pass through.

## Pattern: Canonical Host Ahead of Other Middleware

Put it at the top of the chain, before sessions, authentication and body parsing, so a redirected request skips work its retry on the apex domain repeats. Pair it with [`@sdxc/trailing-slash-middleware`](https://www.npmjs.com/package/@sdxc/trailing-slash-middleware) to settle the whole canonical URL.

```typescript
import { noWWW } from "@sdxc/no-www-middleware";
import { trailingSlash } from "@sdxc/trailing-slash-middleware";
import { createRouter } from "remix/router";

let router = createRouter({ middleware: [noWWW(), trailingSlash()] });

router.get("/posts", () => new Response("posts"));
```

The `www.` host has to reach the same Worker for the redirect to run, so route both hostnames to it. Browsers cache a `308`, so keep the apex domain canonical once it is live.

## Pattern: Form Posts Through the Redirect

A `308` makes the client repeat the method and body, so a form that posts to the `www.` host still arrives as a `POST` on the apex domain.

```typescript
import { noWWW } from "@sdxc/no-www-middleware";
import { createRouter } from "remix/router";

let router = createRouter({ middleware: [noWWW()] });

router.post("/comments", async ({ request }) => {
	let form = await request.formData();
	return Response.json({ text: form.get("text") });
});

// POST https://www.example.com/comments -> 308, Location: https://example.com/comments
// the browser re-sends the POST and its body to https://example.com/comments
```

## Pattern: Observe Redirects From an Outer Middleware

A middleware above `noWWW()` receives the redirect like any other response, so it can log it or add headers.

```typescript
import type { Middleware } from "remix/router";

import { noWWW } from "@sdxc/no-www-middleware";
import { createRouter } from "remix/router";

let poweredBy: Middleware = async (_context, next) => {
	let response = await next();
	response.headers.set("X-Powered-By", "example");
	return response;
};

let router = createRouter({ middleware: [poweredBy, noWWW()] });
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/no-www-middleware": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
