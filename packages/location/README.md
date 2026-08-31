# @pkg/location

A URL-like Location class for building and manipulating URL paths without a full URL.

## Overview

Location solves the problem of building and manipulating URL paths when you don't need (or want) a full URL with origin and protocol. It works like the standard `URL` class but without the `origin`, `protocol`, `host`, or `port` - focusing only on the path, search params, and hash.

This is particularly useful for:

- Building redirect targets where you only need the path
- Constructing links in your application
- Manipulating query parameters without parsing full URLs

## Usage

```typescript
import { Location } from "@pkg/location";

// Create a location
let location = new Location({
	pathname: "/users/123",
	search: "page=1&sort=name",
	hash: "section",
});

console.log(location.toString()); // "/users/123?page=1&sort=name#section"

// Modify the location
location.searchParams.set("page", "2");
location.hash = "details";

console.log(location.toString()); // "/users/123?page=2&sort=name#details"
```

## API

### Constructor

#### `new Location(options: Location.Options)`

Creates a new Location instance.

**Parameters:**

- `options.pathname`: The path portion (e.g., "/users/123")
- `options.search`: Optional search parameters (string or URLSearchParams)
- `options.hash`: Optional hash/fragment

### Properties

#### `pathname: string`

Gets or sets the pathname portion.

#### `search: string`

Gets the search string including the `?` prefix (e.g., `"?page=1"`). Returns an empty string if there are no search params.

#### `searchParams: URLSearchParams`

Gets the search parameters as a URLSearchParams object. Use this for manipulating individual parameters. Different from `search` which returns the string representation with the `?` prefix.

```typescript
let location = new Location({ pathname: "/users", search: "page=1&sort=name" });

// searchParams gives you URLSearchParams for manipulation
location.searchParams.set("page", "2");
location.searchParams.append("filter", "active");

// search gives you the string representation
console.log(location.search); // "?page=2&sort=name&filter=active"
```

#### `hash: string`

Gets or sets the hash/fragment (without the `#` prefix).

### Methods

#### `toString(): string`

Returns the complete location as a string.

```typescript
let loc = new Location({ pathname: "/users", search: "id=1" });
loc.toString(); // "/users?id=1"
```

#### `toJSON(): string`

Returns the location as a string (same as `toString()`). Useful for JSON serialization.

### Static Methods

#### `Location.from(input: string | URL | Location): Location`

Creates a Location from a string, URL, or another Location.

```typescript
let loc1 = Location.from("/users?page=1");
let loc2 = Location.from(new URL("https://example.com/users?page=1"));
let loc3 = Location.from(loc1); // Clone
```

#### `Location.safe(input, options): Location`

Validates an untrusted redirect target - a `?returnTo=` or `?next=` query param - and returns the `fallback` for anything that could send a browser to another origin. It always returns a usable `Location`, so a caller can never forward an attacker's value by accident.

**Parameters:**

- `input`: The untrusted value (`string | URL | Location | null | undefined`)
- `options.fallback`: The destination used whenever `input` fails validation
- `options.origin`: Optional origin whose absolute URLs count as our own

```typescript
Location.safe("/dashboard?tab=1", { fallback: "/" }).toString(); // "/dashboard?tab=1"
Location.safe("//evil.com", { fallback: "/" }).toString(); // "/"
Location.safe("/..//evil.com", { fallback: "/" }).toString(); // "/"
Location.safe("https://evil.com/x", { fallback: "/" }).toString(); // "/"
Location.safe(null, { fallback: "/" }).toString(); // "/"
```

A `startsWith("/")` check is not enough: `//evil.com`, `/\evil.com` and `/..//evil.com` all pass it and still resolve to `https://evil.com`. `Location.safe` resolves the value against a base URL and compares origins instead, then rejects the result unless it is an unambiguous root-relative path.

Rejected: absolute URLs, protocol-relative URLs, backslash variants, non-HTTP schemes such as `javascript:` and `data:`, relative paths with no leading slash, empty values, `null`, `undefined`, and any value carrying raw whitespace or a control character - `new URL` strips those before parsing, so they hide the real destination from string-level checks, and a newline would split the `Location` header.

Preserved: the pathname, search, and hash of a root-relative path, including percent-encoding.

By default only root-relative paths are accepted, because an absolute URL cannot be judged without knowing which origin is ours. Pass `origin` where that is known and matching absolute URLs are reduced to their path:

```typescript
let options = { fallback: "/", origin: "https://app.example.com" };

Location.safe("https://app.example.com/foo", options).toString(); // "/foo"
Location.safe("https://evil.com/foo", options).toString(); // "/"
```

#### `Location.isSafe(input, options?): boolean`

Reports whether an untrusted redirect target stays on our own origin, for callers that branch rather than substitute. It runs the same validation as `Location.safe` and takes the same optional `origin`.

```typescript
Location.isSafe("/dashboard"); // true
Location.isSafe("//evil.com"); // false
Location.isSafe("https://app.example.com/foo", { origin: "https://app.example.com" }); // true
```

#### `Location.canParse(input: unknown): boolean`

Checks if the input can be parsed as a Location.

```typescript
Location.canParse("/users"); // true
Location.canParse("https://example.com"); // true
Location.canParse(new URL("https://example.com")); // true
Location.canParse({}); // false
```

## Use Cases

### Building URLs programmatically

```typescript
let location = new Location({ pathname: "/search" });
location.searchParams.set("q", "react router");
location.searchParams.set("page", "1");

return redirect(location);
```

### Manipulating search parameters

```typescript
let location = Location.from(request.url);
location.searchParams.delete("temp_param");
location.searchParams.set("updated", "true");

return redirect(location);
```

### Creating relative redirects

```typescript
let location = new Location({
	pathname: "/login",
	search: { redirect: request.url },
});

return redirect(location);
```

### Validating an untrusted redirect target

`redirect()` forwards a string target as-is, which is what makes redirecting to an external URL possible. Run any target that came from the request through `Location.safe` first:

```typescript
let returnTo = Location.safe(url.searchParams.get("returnTo"), {
	fallback: "/dashboard",
});

return redirect(returnTo);
```

### Integration with redirect()

Use Location with `redirect()` from `@pkg/response` to build type-safe redirects:

```typescript
import { redirect } from "@pkg/response";
import { Location } from "@pkg/location";

export async function loader({ request }: Route.LoaderArgs) {
	let session = await getSession(request);

	if (!session) {
		let location = new Location({
			pathname: "/login",
			search: new URLSearchParams({ returnTo: new URL(request.url).pathname }),
		});

		throw redirect(location);
	}

	// ...
}
```

### Usage with href() for dynamic routes

Combine Location with `href()` from react-router for type-safe dynamic route building:

```typescript
import { href } from "react-router";
import { Location } from "@pkg/location";

// Build a location with a dynamic route path
let location = new Location({
	pathname: href("/users/:id", { id: userId }),
	search: new URLSearchParams({ tab: "settings" }),
});

// Use in redirects or links
return redirect(location);
```

## Tips

1. **Use `searchParams` for manipulating params, `search` for the string representation** - `searchParams` returns a `URLSearchParams` object for adding, removing, or modifying individual parameters, while `search` gives you the final string with the `?` prefix.

2. **Location automatically handles encoding of search params** - When you use `searchParams.set()` or pass values to the constructor, special characters are automatically URL-encoded.

3. **Never pass a request-supplied redirect target straight to `redirect()`** - `Location.safe` is the only check that holds, and `startsWith("/")` is not one.

4. **Use `Location.from()` to parse existing URLs or paths** - This is the easiest way to create a Location from a request URL, a full URL string, or an existing path that you want to modify.

## Related Packages

- [`@pkg/response`](../response/README.md) - Uses Location for redirect targets with the `redirect()` function
