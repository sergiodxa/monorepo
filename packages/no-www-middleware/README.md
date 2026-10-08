# @sdxc/no-www-middleware

Router middleware that permanently redirects a `www.` hostname to the apex domain, so a site answers on one host for search engines and for the cookies scoped to it.

## Installation

```bash
npm add @sdxc/no-www-middleware
```

It goes on a `remix/router` middleware chain, so [`remix`](https://www.npmjs.com/package/remix) (v3) installs alongside it.

## Usage

### Redirect To The Apex Domain

```typescript
import { noWWW } from "@sdxc/no-www-middleware";
import { createRouter } from "remix/router";

let router = createRouter({ middleware: [noWWW()] });

// GET https://www.example.com/posts?page=2 -> 308, Location: https://example.com/posts?page=2
// GET https://example.com/posts            -> the matched handler
// GET https://blog.example.com/            -> the matched handler
```

### The Longhand

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

Returns a middleware for a router's, controller's, or route's `middleware` chain. A request whose hostname starts with `www.` gets a `308` whose `Location` is the request URL with that leading label removed, so scheme, port, path and query string carry over. Every other request passes to `next()` untouched.

- Only the first label is checked: `www.example.com` redirects, while `blog.www.example.com` and `wwwexample.com` pass through.
- Only one label is removed, so `www.www.example.com` redirects to `www.example.com`, which redirects again.
- The hostname is compared as the URL parser normalizes it, so `WWW.Example.com` redirects to `example.com`.
- A `308` makes the client repeat the method and body, so a `POST` to `www.example.com/comments` arrives at `example.com/comments` as a `POST`.

## Pattern: Placing It First

Install it near the top of the router's chain, ahead of sessions, authentication and body parsing, so a redirected request skips work its retry on the apex domain runs anyway. A middleware above it, such as a logger, still sees the redirect.

```typescript
import { noWWW } from "@sdxc/no-www-middleware";
import { trailingSlash } from "@sdxc/trailing-slash-middleware";
import { createRouter } from "remix/router";

let router = createRouter({ middleware: [noWWW(), trailingSlash()] });

router.get("/posts", () => new Response("posts"));
```

The `www.` host must still reach the Worker for the redirect to run: route it to the same Worker (or point its DNS record at it) alongside the apex domain. Browsers cache a `308`, so keep the apex domain as the canonical host once it is live.

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
