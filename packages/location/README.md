# @sdxc/location

URL-like `Location` class for URL paths without an origin.

It keeps the [`URL`](https://developer.mozilla.org/en-US/docs/Web/API/URL) members that describe a path — `pathname`, `search`, `searchParams`, `hash` — and drops the ones that name a server, `origin`, `protocol`, `host`, `port` and `href` among them. A redirect target or a link is then built and mutated without inventing a base URL for it.

## Installation

```bash
npm add @sdxc/location
```

No dependencies, and a single entry point.

## Usage

### Building A Path

```typescript
import { Location } from "@sdxc/location";

let location = new Location({ pathname: "/users/123", search: "page=1&sort=name" });

location.toString(); // "/users/123?page=1&sort=name"

location.searchParams.set("page", "2");
location.hash = "details";

location.toString(); // "/users/123?page=2&sort=name#details"
```

### Validating An Untrusted Redirect Target

A `?returnTo=` value arrives from the browser, so it can name another origin. `Location.safe` answers with the value or with the fallback, never with an attacker's destination.

```typescript
let returnTo = Location.safe(url.searchParams.get("returnTo"), { fallback: "/dashboard" });

return new Response(null, { status: 302, headers: { Location: returnTo.toString() } });
```

## API

### `new Location(input)`

Builds a location from a `URL`, another `Location`, or `Location.Options` — `{ pathname: string; search?: string | URLSearchParams; hash?: string }`. An origin on a `URL` input is discarded, and a leading `#` on `hash` is dropped.

### Properties

- `pathname`: the path, read and written verbatim — nothing is normalized or encoded on assignment.
- `search`: the query string with its leading `?`, or `""` when there are no params. Assigning takes the string with or without the `?` and replaces every param.
- `searchParams`: the live [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams) behind `search`, so `set`, `append` and `delete` on it change what `toString()` returns. Read-only as a property; assign `search` to replace the whole query.
- `hash`: the fragment without its `#`, in both directions. `""` leaves the fragment off the string.

### `location.toString()` / `location.toJSON()`

The path, plus `?search` and `#hash` when either is non-empty. `toJSON` returns the same string, so a location inside `JSON.stringify` serializes as its path.

### `Location.from(input)`

Parses a `string | URL | Location`, resolving a relative string against a base URL and then discarding the origin — which normalizes the path. Throws a `TypeError` for anything else.

```typescript
Location.from("https://example.com/users?page=1").toString(); // "/users?page=1"
Location.from("/a/../b").toString(); // "/b"
Location.from(location); // a clone
```

### `Location.safe(input, options)`

Validates an untrusted redirect target and returns `options.fallback` for anything that could send a browser to another origin. It always returns a usable `Location`, so a caller cannot forward an attacker's value by accident, and a fallback that is itself off-origin degrades to `/`.

- `input`: the untrusted value, as `string | URL | Location | null | undefined`
- `options.fallback`: the destination used whenever `input` fails validation
- `options.origin`: an origin whose absolute URLs count as ours, reduced to their path

```typescript
Location.safe("/dashboard?tab=1", { fallback: "/" }).toString(); // "/dashboard?tab=1"
Location.safe("//evil.com", { fallback: "/" }).toString(); // "/"
Location.safe(null, { fallback: "/" }).toString(); // "/"

let options = { fallback: "/", origin: "https://app.example.com" };
Location.safe("https://app.example.com/foo", options).toString(); // "/foo"
Location.safe("https://evil.com/foo", options).toString(); // "/"
```

A `startsWith("/")` check is not enough: `//evil.com`, `/\evil.com` and `/..//evil.com` all pass it and still resolve to `https://evil.com`. `Location.safe` resolves the value against a base URL and compares origins instead, then rejects the result unless it is an unambiguous root-relative path.

Rejected: absolute URLs on an origin that was not configured, protocol-relative URLs, backslash variants, non-HTTP schemes such as `javascript:` and `data:`, relative paths with no leading slash, empty values, `null`, `undefined`, and any value carrying whitespace or a control character — `new URL` strips those before parsing, so they hide the real destination from string-level checks, and a newline would split a `Location` header. Preserved: the pathname, search and hash of a root-relative path, including percent-encoding, so `/%2F%2Fevil.com` stays encoded rather than becoming a host.

### `Location.isSafe(input, options?)`

The same validation as a boolean, for a caller that branches rather than substitutes. Takes an `unknown` input and the same optional `origin`.

```typescript
Location.isSafe("/dashboard"); // true
Location.isSafe("//evil.com"); // false
Location.isSafe("https://app.example.com/foo", { origin: "https://app.example.com" }); // true
```

### `Location.canParse(input)`

Whether `Location.from` would accept the input: a `URL`, a `Location`, or a string that parses as either an absolute URL or a path. Unlike `isSafe`, it says nothing about where the value points.

```typescript
Location.canParse("/users"); // true
Location.canParse("https://example.com"); // true
Location.canParse({}); // false
```

## Pattern: Round-Tripping A Sign-In Return Target

Carry the path the visitor asked for into the sign-in page as a param, then read it back through `Location.safe` before redirecting. The write side needs no validation; the read side always does, because the value comes back from the browser.

```typescript
import { Location } from "@sdxc/location";

let current = Location.from(request.url);

let signIn = new Location({
	pathname: "/login",
	search: new URLSearchParams({ returnTo: current.toString() }),
});

// On the way back, from the sign-in page's own request.
let returnTo = Location.safe(new URL(request.url).searchParams.get("returnTo"), {
	fallback: "/dashboard",
});
```

## Pattern: Editing The Current Request's Query String

Filters, sorting and pagination rewrite one param and keep the rest, which is `Location.from` on the request URL plus a `searchParams` call.

```typescript
import { Location } from "@sdxc/location";

let location = Location.from("https://example.com/posts?tag=css&cursor=abc");

location.searchParams.set("page", "2");
location.searchParams.delete("cursor");

location.toString(); // "/posts?tag=css&page=2"
```

The origin is gone from the result, so it goes into an `href` or a `Location` header without a second check.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/location": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
