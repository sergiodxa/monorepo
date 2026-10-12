# @sdxc/location

URL-like `Location` class for URL paths without an origin.

A `Location` keeps the [`URL`](https://developer.mozilla.org/en-US/docs/Web/API/URL) members that
describe a path — `pathname`, `search`, `searchParams` and `hash` — and none that name a server, so
a link or a redirect target is built and edited without inventing a base URL for it.

## Installation

```sh
npm add @sdxc/location
```

## Usage

### Build a path

```typescript
import { Location } from "@sdxc/location";

let location = new Location({ pathname: "/users/123", search: "page=1&sort=name" });

location.searchParams.set("page", "2");
location.hash = "details";

location.toString(); // "/users/123?page=2&sort=name#details"
```

### Parse a URL down to its path

```typescript
import { Location } from "@sdxc/location";

Location.from("https://example.com/users?page=1").toString(); // "/users?page=1"
Location.from("/a/../b").toString(); // "/b"
```

### Validate an untrusted redirect target

```typescript
import { Location } from "@sdxc/location";

let target = new URL(request.url).searchParams.get("returnTo");
let returnTo = Location.safe(target, { fallback: "/dashboard" });

return new Response(null, { status: 302, headers: { Location: returnTo.toString() } });
```

`Location.safe` answers the target when it is a root-relative path on your own site, and the
fallback for anything else.

## API

### `new Location(input: URL | Location | Location.Options)`

Builds a location from a `URL` (its origin is discarded), another `Location` (a copy), or
`{ pathname, search?, hash? }`.

### `location.pathname`, `location.search`, `location.searchParams`, `location.hash`

`pathname` is read and written verbatim. `search` reads with its leading `?`, or `""` with no
params, and assigning it (with or without the `?`) replaces every param. `searchParams` is the live
[`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams) behind
`search`. `hash` reads and writes without its `#`.

### `location.toString(): string` / `location.toJSON(): string`

The path, plus `?search` and `#hash` when each is non-empty; `JSON.stringify` serializes a location
as that string.

### `Location.from(input: string | URL | Location): Location`

Resolves a string against a placeholder origin, then keeps only the path, so an absolute URL loses
its origin and a relative one has its `.` and `..` segments resolved. Throws a `TypeError` for any
other input type.

### `Location.safe(input, options: Location.SafeOptions): Location`

Answers `input` as a location when it is an unambiguous root-relative path, or an absolute URL on
`options.origin` reduced to its path; otherwise answers `options.fallback`, or `/` when the fallback
itself fails the check. `input` is `string | URL | Location | null | undefined`.

It compares resolved origins, so `//evil.com`, `/\evil.com`, `/..//evil.com`, `javascript:` and
`data:` URLs, relative paths such as `ok`, empty values and values carrying whitespace or control
characters all fall back. Percent-encoding is preserved: `/%2F%2Fevil.com` stays a path.

### `Location.isSafe(input: unknown, options?: Location.OriginOptions): boolean`

The `Location.safe` check as a boolean.

### `Location.canParse(input: unknown): boolean`

Whether `Location.from` accepts the input: a `URL`, a `Location`, or a string that parses as an
absolute URL or a path. It says nothing about where the value points; `isSafe` does.

### Types

- `Location.Options`: `{ pathname: string; search?: string | URLSearchParams; hash?: string }`; a
  leading `#` on `hash` is dropped.
- `Location.OriginOptions`: `{ origin?: string | URL }`, the origin whose absolute URLs count as
  your own.
- `Location.SafeOptions`: `OriginOptions` plus `fallback: string | URL | Location`.

## Pattern: Round-Trip A Sign-In Return Target

Carry the requested path into the sign-in page as a param, then read it back through
`Location.safe`, because it returns from the browser.

```typescript
import { Location } from "@sdxc/location";

function signInRedirect(request: Request) {
	let current = Location.from(request.url);
	let signIn = new Location({
		pathname: "/login",
		search: new URLSearchParams({ returnTo: current.toString() }),
	});
	return new Response(null, { status: 302, headers: { Location: signIn.toString() } });
}

function afterSignIn(request: Request) {
	let returnTo = Location.safe(new URL(request.url).searchParams.get("returnTo"), {
		fallback: "/dashboard",
	});
	return new Response(null, { status: 303, headers: { Location: returnTo.toString() } });
}
```

## Pattern: Rewrite One Query Param And Keep The Rest

Filters, sorting and pagination links change one param of the current URL.

```typescript
import { Location } from "@sdxc/location";

function pageLink(requestUrl: string, page: number) {
	let location = Location.from(requestUrl);
	location.searchParams.set("page", String(page));
	location.searchParams.delete("cursor");
	return location.toString();
}

pageLink("https://example.com/posts?tag=css&cursor=abc", 2); // "/posts?tag=css&page=2"
```

The result carries no origin, so it goes straight into an `href`.

## Pattern: Send A Form Back Where It Came From

The `Referer` header is an absolute URL; `origin` accepts your own site's URLs and reduces them to
their path, while any other site's falls back.

```typescript
import { Location } from "@sdxc/location";

let ORIGIN = "https://app.example.com";

function back(request: Request) {
	let target = Location.safe(request.headers.get("Referer"), { fallback: "/", origin: ORIGIN });
	return new Response(null, { status: 303, headers: { Location: target.toString() } });
}
```

## Pattern: Reject An Unsafe Target Instead Of Replacing It

An API that stores a callback path answers `400` for a bad one rather than silently storing a
fallback.

```typescript
import { Location } from "@sdxc/location";

async function saveCallback(request: Request) {
	let form = await request.formData();
	let callback = form.get("callback");
	if (!Location.isSafe(callback)) return new Response("Invalid callback path", { status: 400 });

	let path = Location.from(String(callback));
	return Response.json({ callback: path });
}
```

`Response.json` serializes `path` through `toJSON`, as `{ "callback": "/the/path" }`.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/location": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
