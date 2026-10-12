# @sdxc/trailing-slash-middleware

Router middleware that redirects every path to one canonical trailing-slash form, so search engines, caches and relative links see one URL per page.

## Installation

```sh
npm add @sdxc/trailing-slash-middleware
```

It goes on a `remix/router` middleware chain, so [`remix`](https://www.npmjs.com/package/remix) (v3) installs alongside it.

## Usage

### Strip trailing slashes

The default makes the slash-free form canonical. Only the path changes, so the query string carries over.

```typescript
import { trailingSlash } from "@sdxc/trailing-slash-middleware";
import { createRouter } from "remix/router";

let router = createRouter({ middleware: [trailingSlash()] });

// GET /posts/?page=2 -> 308, Location: https://example.com/posts?page=2
// GET /posts///      -> 308, Location: https://example.com/posts
// GET /posts         -> the matched handler
// GET /              -> the matched handler
```

### Enforce a trailing slash

`{ mode: "always" }` makes the slashed form canonical, and lets a file name such as `/robots.txt` through as it arrived.

```typescript
import { trailingSlash } from "@sdxc/trailing-slash-middleware";
import { createRouter } from "remix/router";

let router = createRouter({ middleware: [trailingSlash({ mode: "always" })] });

// GET /posts      -> 308, Location: https://example.com/posts/
// GET /posts/     -> the matched handler
// GET /robots.txt -> the matched handler
```

### The longhand

In the default mode, `trailingSlash()` stands in for this hand-written middleware:

```typescript
import type { Middleware } from "remix/router";

let stripTrailingSlash: Middleware = (context, next) => {
	let url = new URL(context.request.url);
	if (url.pathname === "/" || !url.pathname.endsWith("/")) return next();
	url.pathname = url.pathname.replace(/\/+$/, "") || "/";
	return new Response(null, { status: 308, headers: { Location: url.href } });
};
```

## API

### `trailingSlash(options?: TrailingSlashOptions): Middleware`

Returns a middleware that passes a request in canonical form to `next()` and answers any other with a `308` to the same URL with only the path changed. `/` is canonical in both modes, and a run of trailing slashes reaches the canonical form in one redirect.

- `options.mode`: `"never"` (default) makes `/posts` canonical and strips every non-root trailing slash. `"always"` makes `/posts/` canonical, except that a slash-free path whose last segment contains a `.` (`/robots.txt`, `/.well-known/security.txt`) is a file and passes through.

### Types

#### `TrailingSlashOptions`

```typescript
interface TrailingSlashOptions {
	mode?: "never" | "always";
}
```

## Pattern: Placing It First

Router middleware runs before route matching, so the router's chain sees both forms of every path. Put `trailingSlash()` at the top: a redirected request skips the session, authentication and body parsing its canonical retry runs anyway, while a middleware above it, such as a logger, still sees the redirect.

```typescript
import { catchResponse } from "@sdxc/catch-response-middleware";
import { trailingSlash } from "@sdxc/trailing-slash-middleware";
import { createRouter } from "remix/router";

let router = createRouter({ middleware: [trailingSlash(), catchResponse()] });

router.get("/posts", () => new Response("posts"));
```

## Pattern: Forms Keep Their Method

A `308` makes the client repeat the method and body, so a form that posts to the non-canonical path still reaches its handler as a `POST`.

```typescript
import { trailingSlash } from "@sdxc/trailing-slash-middleware";
import { createRouter } from "remix/router";

let router = createRouter({ middleware: [trailingSlash()] });

router.post("/comments", async ({ request }) => {
	let form = await request.formData();
	return new Response(`Saved: ${form.get("body")}`, { status: 201 });
});

// POST /comments/ -> 308, Location: https://example.com/comments
// POST /comments  -> 201, with the same body
```

## Pattern: Directory URLs Beside Static Files

In `"always"` mode, only a dot in the last segment marks a file. A file without one (`/LICENSE`) gets a slash, a dot in an earlier segment (`/v1.2/docs`) does not count, and a slashed path such as `/tags/node.js/` already has its slash and passes through.

```typescript
import { trailingSlash } from "@sdxc/trailing-slash-middleware";
import { createRouter } from "remix/router";

let router = createRouter({ middleware: [trailingSlash({ mode: "always" })] });

router.get(
	"/feed.xml",
	() => new Response("<feed />", { headers: { "Content-Type": "application/atom+xml" } }),
);
router.get("/v1.2/docs/", () => new Response("docs"));

// GET /feed.xml          -> the matched handler
// GET /assets/app.min.js -> passes through
// GET /v1.2/docs         -> 308, Location: https://example.com/v1.2/docs/
// GET /LICENSE           -> 308, Location: https://example.com/LICENSE/
```

## Pattern: Picking The Mode Once

Generate links in the canonical form, so a click never costs a redirect; the middleware catches the links other sites and people write by hand. Browsers cache a `308`, so switching a live site from one mode to the other sends returning visitors into a redirect loop until those entries expire.

```typescript
import { trailingSlash } from "@sdxc/trailing-slash-middleware";
import { createRouter } from "remix/router";

let router = createRouter({ middleware: [trailingSlash({ mode: "always" })] });

router.get(
	"/posts/",
	() =>
		new Response('<a href="/posts/2026/">2026</a>', { headers: { "Content-Type": "text/html" } }),
);
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/trailing-slash-middleware": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
