# @pkg/response

Type-safe response helpers for React Router loaders and actions.

## Usage

```typescript
import { ok, badRequest, notFound, redirect } from "@pkg/response";
import { Location } from "@pkg/location";

export async function loader({ request }: Route.LoaderArgs) {
	const data = await fetchData();

	if (!data) {
		return notFound({ message: "Data not found" });
	}

	return ok({ data });
}

export async function action({ request }: Route.ActionArgs) {
	const result = await validateForm(request);

	if (!result.success) {
		return badRequest({ errors: result.errors });
	}

	await processData(result.data);

	// Redirect using Location for programmatic URL building
	const location = new Location({
		pathname: "/success",
		search: { id: result.data.id },
	});
	return redirect(location);
}
```

## API

All response helpers accept an optional `init` parameter of type `Omit<ResponseInit, "status" | "statusText">` for additional headers, etc.

### Success Responses

#### `ok<T>(input: T, init?: Init)`

Returns a successful response with status 200 and adds `ok: true` to the data.

**Parameters:**

- `input`: The data to return
- `init`: Optional ResponseInit for additional headers, etc.

**Returns:**

- A React Router `data()` response with status 200 and `ok: true`

**Example:**

```typescript
return ok({ message: "Success" });
// Returns: { message: "Success", ok: true }
```

### Redirects

#### `redirect(target: URL | Location | string, init?: RedirectInit)`

Returns a redirect response with status 302 by default (or custom 3xx status).

**Parameters:**

- `target`: The URL, Location, or string path to redirect to
- `init`: Optional init with custom headers and status code

**Supported status codes:**

Use the `redirect.Status` enum for better readability:

```typescript
redirect.Status.MultipleChoices; // 300
redirect.Status.MovedPermanently; // 301
redirect.Status.Found; // 302 (default)
redirect.Status.SeeOther; // 303
redirect.Status.NotModified; // 304
redirect.Status.TemporaryRedirect; // 307
redirect.Status.PermanentRedirect; // 308
```

Or use numeric literals directly (saves ~230 bytes in bundle):

```typescript
300; // Multiple Choices
301; // Moved Permanently
302; // Found (default)
303; // See Other
304; // Not Modified
307; // Temporary Redirect
308; // Permanent Redirect
```

**Returns:**

- A Response with 3xx status and Location header

**Examples:**

```typescript
import { redirect, Location } from "@pkg/response";

// Simple string redirect (defaults to 302)
return redirect("/login");

// Using enum (more readable, +230 bytes)
return redirect("/new-path", { status: redirect.Status.MovedPermanently });

// Using number literal (smaller bundle)
return redirect("/new-path", { status: 301 });

// Temporary redirect preserving method (307)
return redirect("/temporary", { status: redirect.Status.TemporaryRedirect });

// See Other - POST → GET redirect (303)
return redirect("/success", { status: redirect.Status.SeeOther });

// URL redirect
return redirect(new URL("/users", request.url));

// Location redirect with search params
let location = new Location({
	pathname: "/search",
	search: { q: "react", page: "1" },
});
return redirect(location);

// With custom headers
return redirect("/logout", {
	status: redirect.Status.SeeOther,
	headers: {
		"Set-Cookie": "session=; Max-Age=0",
	},
});
```

**When to use which redirect status:**

- `301` - Permanent redirect (SEO transfer, old URLs)
- `302` - Temporary redirect (default, general purpose)
- `303` - See Other (after POST to prevent resubmission)
- `307` - Temporary redirect preserving request method
- `308` - Permanent redirect preserving request method

### Client Error Responses (4xx)

All error responses add `ok: false` to the data for type discrimination.

#### `badRequest<T>(input: T, init?: Init)`

Returns a bad request response with status 400 and adds `ok: false` to the data.

**Example:**

```typescript
return badRequest({ error: "Invalid input" });
// Returns: { error: "Invalid input", ok: false }
```

#### `unauthorized<T>(input: T, init?: Init)`

Returns an unauthorized response with status 401 and adds `ok: false`.

**Example:**

```typescript
return unauthorized({ error: "Authentication required" });
// Returns: { error: "Authentication required", ok: false }
```

#### `paymentRequired<T>(input: T, init?: Init)`

Returns a payment required response with status 402 and adds `ok: false`.

#### `forbidden<T>(input: T, init?: Init)`

Returns a forbidden response with status 403 and adds `ok: false`.

**Example:**

```typescript
return forbidden({ error: "Insufficient permissions" });
// Returns: { error: "Insufficient permissions", ok: false }
```

#### `notFound<T>(input: T, init?: Init)`

Returns a not found response with status 404 and adds `ok: false`.

**Example:**

```typescript
return notFound({ error: "Resource not found" });
// Returns: { error: "Resource not found", ok: false }
```

#### `unprocessableEntity<T>(input: T, init?: Init)`

Returns an unprocessable entity response with status 422 and adds `ok: false`.

**Example:**

```typescript
return unprocessableEntity({
	errors: { email: "Invalid format", age: "Must be 18+" },
});
// Returns: { errors: {...}, ok: false }
```

## Type Safety

All response helpers preserve the type of the input and add the `ok` property:

```typescript
const response = ok({ message: "Success", data: [1, 2, 3] });
// Type: { message: string, data: number[], ok: true }

const error = badRequest({ error: "Invalid input", fields: ["email"] });
// Type: { error: string, fields: string[], ok: false }

const notFoundResponse = notFound({ message: "Not found" });
// Type: { message: string, ok: false }
```

## Custom Headers

You can pass additional headers or options:

```typescript
return ok(
	{ data },
	{
		headers: {
			"Cache-Control": "max-age=3600",
		},
	},
);

return redirect("/login", {
	headers: {
		"Set-Cookie": "session=; Max-Age=0",
	},
});
```

## Pattern: Discriminated Unions

The `ok` property makes responses work great with discriminated unions:

```typescript
export async function action({ request }: Route.ActionArgs) {
	const result = await processForm(request);

	if (!result.success) {
		return badRequest({ errors: result.errors });
	}

	return ok({ data: result.data });
}

// In your component:
export default function Component({ actionData }: Route.ComponentProps) {
	if (actionData?.ok === false) {
		// TypeScript knows this has an error
		return <ErrorMessage errors={actionData.errors} />;
	}

	if (actionData?.ok === true) {
		// TypeScript knows this has data
		return <SuccessMessage data={actionData.data} />;
	}

	return <Form />;
}
```

## Status Code Reference

- `200` - OK (success)
- `302` - Redirect
- `400` - Bad Request (client error)
- `401` - Unauthorized (authentication required)
- `402` - Payment Required
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `422` - Unprocessable Entity (validation errors)
