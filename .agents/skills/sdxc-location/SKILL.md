---
name: sdxc-location
description: "@sdxc/location is a URL-like Location class for paths without an origin — pathname, search, searchParams and hash — plus Location.safe/isSafe for validating an untrusted redirect target. Use when building or mutating a redirect target or link, editing a request's query string for filters or pagination, or checking a ?returnTo= value before putting it in a Location header."
---

# @sdxc/location

URL-like `Location` class for URL paths without an origin. It keeps the `URL` members that describe a path — `pathname`, `search`, `searchParams`, `hash` — and drops the ones that name a server, so a redirect target or a link is built and mutated without inventing a base URL for it. `Location.from` parses a string, `URL` or `Location`; `Location.safe` and `Location.isSafe` validate an untrusted target against open-redirect tricks; `Location.canParse` reports parseability alone. No dependencies, one entry point, and nothing runtime-specific.

Full API, options and examples: [packages/location/README.md](packages/location/README.md)

## When to reach for it

- A `?returnTo=` or `?next=` value comes back from the browser and is about to be written into a `Location` header.
- A `startsWith("/")` check is guarding a redirect — `//evil.com`, `/\evil.com` and `/..//evil.com` all pass it and still resolve to another origin.
- Filters, sorting or pagination rewrite one query param and keep the rest, and the current code reaches for `new URL(request.url)` and then has to strip the origin again.
- A path with a query string and a fragment is being assembled by string concatenation.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/location": "workspace:*" } }
```

```ts
import { Location } from "@sdxc/location";

let location = new Location({ pathname: "/users/123", search: "page=1&sort=name" });

location.searchParams.set("page", "2");
location.hash = "details";

location.toString(); // "/users/123?page=2&sort=name#details"
```

```ts
let returnTo = Location.safe(url.searchParams.get("returnTo"), { fallback: "/dashboard" });

return new Response(null, { status: 302, headers: { Location: returnTo.toString() } });
```

## Suggestions

- `Location.safe` always returns a usable `Location`, so a caller cannot forward an attacker's value by accident; a fallback that is itself off-origin degrades to `/`. Reach for `Location.isSafe` only when the caller branches rather than substitutes.
- Pass `options.origin` when absolute URLs on your own origin should count as ours — they are then reduced to their path, and everything else still falls back.
- The write side of a round trip needs no validation and the read side always does: carry the current path into a sign-in URL as a param freely, then run the value back through `Location.safe` before redirecting.
- `pathname` is read and written verbatim — nothing is normalized or encoded on assignment. `Location.from` is what normalizes, by resolving against a base URL and discarding the origin, so `/a/../b` becomes `/b`.
- `searchParams` is the live `URLSearchParams` behind `search` and is read-only as a property; assign `search` to replace the whole query.
- `toJSON` returns the same string as `toString`, so a location inside `JSON.stringify` serializes as its path.
