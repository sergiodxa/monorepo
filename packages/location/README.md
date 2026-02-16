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

3. **Use `Location.from()` to parse existing URLs or paths** - This is the easiest way to create a Location from a request URL, a full URL string, or an existing path that you want to modify.

## Related Packages

- [`@pkg/response`](../response/README.md) - Uses Location for redirect targets with the `redirect()` function
