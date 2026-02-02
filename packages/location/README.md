# @pkg/location

A URL-like Location class for building and manipulating URL paths without a full URL.

## Usage

```typescript
import { Location } from "@pkg/location";

// Create a location
const location = new Location({
	pathname: "/users/123",
	search: "page=1&sort=name",
	hash: "section",
});

console.log(location.toString()); // "/users/123?page=1&sort=name#section"

// Modify the location
location.search.set("page", "2");
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

#### `search: URLSearchParams`

Gets the search parameters as a URLSearchParams object. Can be set using a string or URLSearchParams.

#### `hash: string`

Gets or sets the hash/fragment (without the `#` prefix).

### Methods

#### `toString(): string`

Returns the complete location as a string.

```typescript
const loc = new Location({ pathname: "/users", search: "id=1" });
loc.toString(); // "/users?id=1"
```

#### `toJSON(): string`

Returns the location as a string (same as `toString()`). Useful for JSON serialization.

### Static Methods

#### `Location.from(input: string | URL | Location): Location`

Creates a Location from a string, URL, or another Location.

```typescript
const loc1 = Location.from("/users?page=1");
const loc2 = Location.from(new URL("https://example.com/users?page=1"));
const loc3 = Location.from(loc1); // Clone
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
const location = new Location({ pathname: "/search" });
location.search.set("q", "react router");
location.search.set("page", "1");

return redirect(location);
```

### Manipulating search parameters

```typescript
const location = Location.from(request.url);
location.search.delete("temp_param");
location.search.set("updated", "true");

return redirect(location);
```

### Creating relative redirects

```typescript
const location = new Location({
	pathname: "/login",
	search: { redirect: request.url },
});

return redirect(location);
```
