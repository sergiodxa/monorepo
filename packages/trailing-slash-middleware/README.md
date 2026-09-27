# @sdxc/trailing-slash-middleware

Router middleware that redirects every path to one canonical trailing-slash form, so search engines, caches and relative links see one URL per page.

## Installation

```bash
npm add @sdxc/trailing-slash-middleware
```

It goes on a `remix/router` middleware chain, so [`remix`](https://www.npmjs.com/package/remix) (v3) installs alongside it.

## Usage

### Strip Trailing Slashes

The default makes the slash-free form canonical.

```typescript
import { trailingSlash } from "@sdxc/trailing-slash-middleware";
import { createRouter } from "remix/router";

let router = createRouter({ middleware: [trailingSlash()] });

// GET /posts/?page=2 -> 308, Location: https://example.com/posts?page=2
// GET /posts         -> the matched handler
// GET /              -> the matched handler
```

### Enforce A Trailing Slash

`{ mode: "always" }` makes the slashed form canonical, and leaves files in the form they arrived in.

```typescript
import { trailingSlash } from "@sdxc/trailing-slash-middleware";
import { createRouter } from "remix/router";

let router = createRouter({ middleware: [trailingSlash({ mode: "always" })] });

// GET /posts      -> 308, Location: https://example.com/posts/
// GET /posts/     -> the matched handler
// GET /robots.txt -> the matched handler
```

### The Longhand

In the default mode, `trailingSlash()` stands in for this hand-written middleware, with a `308` in place of the `301` such copies usually send:

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

Returns a middleware for a router's, controller's, or route's `middleware` chain. A request in canonical form passes to `next()` untouched; any other gets a `308` whose `Location` is the request URL with only the path changed, so origin, port and query string carry over. A `308` makes the client repeat the method and body, so a `POST` to `/comments/` arrives at `/comments` as a `POST`.

`options.mode` is `"never"` (default, `/posts` is canonical) or `"always"` (`/posts/` is canonical). The canonical form follows these rules:

- `/` is canonical in both modes and never redirects. A path made only of slashes (`//`) redirects to `/`.
- A run of trailing slashes counts as one, so `/posts///` reaches `/posts` (or `/posts/`) in a single redirect.
- In `"always"` mode, a slash-free path whose **last segment** contains a literal `.` is a file and passes through: `/robots.txt`, `/feed.xml`, `/assets/app.min.js`, `/.well-known/security.txt`. A dot in an earlier segment does not count, so `/v1.2/docs` redirects to `/v1.2/docs/`. A slashed path such as `/tags/node.js/` already has its one slash and passes through too.
- In `"never"` mode every non-root trailing slash is stripped, file-like paths included: `/robots.txt/` redirects to `/robots.txt`.
- Only the trailing run of slashes is canonicalized. Slashes inside the path (`/a//b`) stay as they are, a percent-encoded dot (`%2E`) is not a file dot, and a file without a dot in its name (`/LICENSE`) gets a slash in `"always"` mode.

### `TrailingSlashOptions`

```typescript
interface TrailingSlashOptions {
	mode?: "never" | "always";
}
```

## Pattern: Placing It First

Install it at the top of the router's chain. A redirected request then skips the session, authentication and body parsing that its canonical retry runs anyway, while a middleware above it — a logger, server timing — still sees the redirect and may add headers to it.

```typescript
import { catchResponse } from "@sdxc/catch-response-middleware";
import { trailingSlash } from "@sdxc/trailing-slash-middleware";
import { createRouter } from "remix/router";

let router = createRouter({ middleware: [trailingSlash(), catchResponse()] });

router.get("/posts", () => new Response("posts"));
```

Generate links in the canonical form, so a click never costs a redirect; the middleware catches the links other sites and users write by hand. Browsers cache a `308`, so switching a live site from one mode to the other sends returning visitors into a redirect loop until those cached entries expire — pick the mode once.

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
