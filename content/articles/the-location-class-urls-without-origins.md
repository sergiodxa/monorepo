---
title: "The Location Class: URLs Without Origins"
excerpt: A lightweight alternative to the URL class for working with paths, search params, and hashes.
technologies: typescript@5.0.0
---

The browser's `URL` class is powerful, but it comes with baggage. Every `URL` instance requires a complete origin: protocol, hostname, and optionally a port. This makes sense for absolute URLs, but what about when you only care about the path?

Consider a server-side router matching incoming requests. The router doesn't care whether the request came over HTTP or HTTPS, or whether the hostname is `localhost` or `api.example.com`. It only needs the pathname, search parameters, and hash. Yet to use the `URL` class, you must provide or fabricate an origin.

## The Problem with URL

When you create a `URL` instance, you must provide a valid origin:

```ts
// This works
let url = new URL("https://example.com/users?page=1");

// This throws an error
let url = new URL("/users?page=1"); // TypeError: Invalid URL
```

To work around this, developers often use a dummy base URL:

```ts
let url = new URL("/users?page=1", "https://example.com");
```

This works, but it's awkward. You're creating properties you don't need (`protocol`, `hostname`, `port`, `origin`) just to access the ones you do (`pathname`, `search`, `hash`).

## Introducing the Location Class

The `Location` class provides a URL-like interface focused solely on the parts that matter for routing and navigation: pathname, search parameters, and hash.

```ts
export class Location implements Omit<
	URL,
	"origin" | "protocol" | "username" | "password" | "host" | "hostname" | "port" | "href"
> {
	#pathname: string;
	#search: URLSearchParams;
	#hash: string;

	constructor(input: URL | Location | Location.Options) {
		this.#pathname = input.pathname;
		this.#search = new URLSearchParams(input.search);
		this.#hash = input.hash || "";
	}

	get pathname() {
		return this.#pathname;
	}

	get search(): string {
		let search = this.#search.toString();
		return search ? `?${search}` : "";
	}

	get searchParams(): URLSearchParams {
		return this.#search;
	}

	get hash() {
		return this.#hash;
	}

	set pathname(value: string) {
		this.#pathname = value;
	}

	set search(value: string) {
		this.#search = new URLSearchParams(value.startsWith("?") ? value.slice(1) : value);
	}

	set hash(value: string) {
		this.#hash = value;
	}

	toString() {
		let search = this.#search.toString();
		let parts = [this.#pathname];
		if (search) parts.push(`?${search}`);
		if (this.#hash) parts.push(`#${this.#hash}`);
		return parts.join("");
	}

	toJSON() {
		return this.toString();
	}
}
```

The class uses private fields (`#pathname`, `#search`, `#hash`) to encapsulate state and provides getters and setters that mirror the `URL` API. This wrapper pattern—similar to [creating type-safe JWT wrapper classes](/tutorials/create-type-safe-jwt-wrapper-classes)—gives you a focused API without the overhead of the underlying implementation. The `toString()` method reconstructs the path string, and `toJSON()` ensures proper serialization.

## Static Factory Methods

The class includes two static methods that make it easier to work with various input types.

### Location.from()

The `from` method accepts strings, `URL` instances, or existing `Location` instances:

```ts
static from(input: string | URL | Location): Location {
  if (typeof input === "string") {
    return Location.from(new URL(input, "https://example.com"));
  }

  if (input instanceof Location) return new Location(input);
  if (input instanceof URL) return new Location(input);

  throw new TypeError("Location.from expects a string, URL, or Location");
}
```

When given a string, it uses the dummy base URL internally, then extracts only the relevant parts. This encapsulates the workaround so consumers don't need to think about it:

```ts
let location = Location.from("/users?page=1#section");
console.log(location.pathname); // "/users"
console.log(location.search); // "?page=1"
console.log(location.hash); // "#section"
```

### Location.canParse()

Similar to `URL.canParse()`, this method checks whether an input can be converted to a `Location`:

```ts
static canParse(input: unknown): boolean {
  if (input instanceof URL) return true;
  if (input instanceof Location) return true;
  if (typeof input === "string") {
    if (URL.canParse(input)) return true;
    if (URL.canParse(input, "https://example.com")) return true;
  }
  return false;
}
```

This is useful for validation before attempting to create a `Location` instance.

## Use Cases

### Server-Side Routing

Routers need to match incoming requests against route patterns. They only care about the path:

```ts
function matchRoute(request: Request): Route | null {
	let location = Location.from(new URL(request.url));

	for (let route of routes) {
		if (route.pattern.test(location.pathname)) {
			return route;
		}
	}

	return null;
}
```

### Building Redirect URLs

When constructing redirects, you often want to preserve or modify query parameters without worrying about the full URL:

```ts
function buildRedirect(currentPath: string, newPage: number): string {
	let location = Location.from(currentPath);
	location.searchParams.set("page", String(newPage));
	return location.toString();
}

buildRedirect("/users?page=1&sort=name", 2);
// Returns: "/users?page=2&sort=name"
```

### Relative URL Manipulation

When working with relative URLs in components or utilities, you don't always have access to the full origin:

```ts
function addReturnTo(path: string, returnTo: string): string {
	let location = Location.from(path);
	location.searchParams.set("returnTo", returnTo);
	return location.toString();
}

addReturnTo("/login", "/dashboard");
// Returns: "/login?returnTo=%2Fdashboard"
```

### Testing

In tests, you often want to verify URL manipulation logic without setting up full URLs:

```ts
test("adds pagination to path", () => {
	let location = Location.from("/articles");
	location.searchParams.set("page", "2");

	expect(location.toString()).toBe("/articles?page=2");
});
```

## Why Not Just Use URL?

You could always use `URL` with a dummy base, but the `Location` class offers several advantages:

1. **Intent clarity**: The code communicates that you're working with paths, not full URLs.
2. **Type safety**: The TypeScript types exclude origin-related properties, preventing accidental usage. For more on leveraging TypeScript's type system, see [detecting the any type](/articles/advanced-typescript-detecting-the-any-type).
3. **Encapsulation**: The dummy base URL is an implementation detail, hidden from consumers.
4. **Consistency**: The API matches `URL` where it makes sense, reducing cognitive load.

## Trade-offs

The `Location` class is intentionally minimal. It doesn't handle:

- URL resolution (combining relative and base URLs)
- Path normalization (removing `..` or `.` segments)
- Encoding edge cases beyond what `URLSearchParams` handles

For these cases, you might still need the full `URL` class or additional utilities.

## Conclusion

The `Location` class fills a gap in the standard library: a way to work with URL paths without the overhead of origins. It's particularly useful in server-side routing, redirect building, and anywhere you need to manipulate paths independently of their host.

The implementation is small enough to copy into any project, and the API is familiar enough that anyone who knows `URL` can use it immediately. For validating the data you extract from these paths, see [building a universal validator with Standard Schema](/tutorials/build-a-universal-validator-with-standard-schema).
