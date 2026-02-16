# @pkg/response

Type-safe response helpers for React Router loaders and actions.

## Overview

This package provides type-safe response helpers for React Router applications:

- All responses automatically add `ok: true` or `ok: false` for discriminated unions
- Built on top of React Router's `data()` function
- Supports all common HTTP status codes with semantic function names

## Usage

```typescript
import { ok, badRequest, notFound, redirect } from "@pkg/response";
import { Location } from "@pkg/location";

export async function loader({ request }: Route.LoaderArgs) {
	let data = await fetchData();

	if (!data) {
		return notFound({ message: "Data not found" });
	}

	return ok({ data });
}

export async function action({ request }: Route.ActionArgs) {
	let result = await validateForm(request);

	if (!result.success) {
		return badRequest({ errors: result.errors });
	}

	await processData(result.data);

	// Redirect using Location for programmatic URL building
	let location = new Location({
		pathname: "/success",
		search: { id: result.data.id },
	});
	return redirect(location);
}
```

## API

All response helpers accept an optional `init` parameter of type `Omit<ResponseInit, "status" | "statusText">` for additional headers, etc.

### Success Responses (2xx)

All success responses (except `noContent`) add `ok: true` to the data for type discrimination.

#### `ok<T>(input: T, init?: Init)`

Returns a successful response with status 200 and adds `ok: true` to the data.

**When to use:** Default success response for GET requests returning data, or successful operations that return a result.

**Example:**

```typescript
return ok({ users: await db.users.findMany() });
// Returns: { users: [...], ok: true }
```

#### `created<T>(input: T, init?: Init)`

Returns a created response with status 201 and adds `ok: true` to the data.

**When to use:** After successfully creating a new resource (user signup, new post, file upload).

**Example:**

```typescript
let user = await db.users.create({ data: formData });
return created({ user });
// Returns: { user: {...}, ok: true }
```

#### `accepted<T>(input: T, init?: Init)`

Returns an accepted response with status 202 and adds `ok: true` to the data.

**When to use:** When a request has been accepted but will be processed asynchronously (background jobs, queued tasks, long-running operations).

**Example:**

```typescript
let job = await queue.enqueue("process-video", { videoId });
return accepted({ jobId: job.id, status: "processing" });
// Returns: { jobId: "456", status: "processing", ok: true }
```

#### `noContent(init?: Init)`

Returns an empty response with status 204 and `null` body. Per HTTP specification, this response has no content.

**When to use:** Successful operations that don't need to return data (DELETE requests, updates where client doesn't need confirmation data, marking notifications as read).

**Example:**

```typescript
await db.posts.delete({ where: { id: postId } });
return noContent();
// Returns: data(null) with status 204
```

### Redirects

#### `redirect(target: URL | Location | string, init?: RedirectInit)`

Returns a redirect response with status 307 by default (or custom 3xx status).

**Parameters:**

- `target`: The URL, Location, or string path to redirect to
- `init`: Optional init with custom headers and status code

**Supported status codes:**

Use the `redirect.Status` enum for better readability:

```typescript
redirect.Status.SeeOther; // 303 - POST → GET redirect
redirect.Status.Temporary; // 307 - preserves method (default)
redirect.Status.Permanent; // 308 - preserves method, permanent
```

Or use numeric literals directly:

```typescript
303; // See Other - POST → GET redirect
307; // Temporary Redirect (default)
308; // Permanent Redirect
```

**Returns:**

- A Response with 3xx status and Location header

**Examples:**

```typescript
import { redirect } from "@pkg/response";
import { Location } from "@pkg/location";

// Simple string redirect (defaults to 307)
return redirect("/login");

// Using enum (more readable)
return redirect("/new-path", { status: redirect.Status.Permanent });

// Using number literal
return redirect("/new-path", { status: 308 });

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

- `303` - See Other (after POST to prevent form resubmission)
- `307` - Temporary redirect preserving request method
- `308` - Permanent redirect preserving request method

### Client Error Responses (4xx)

All error responses add `ok: false` to the data for type discrimination.

#### `badRequest<T>(input: T, init?: Init)`

Returns a bad request response with status 400 and adds `ok: false` to the data.

**When to use:** Malformed request syntax, invalid request parameters, or missing required fields that prevent the server from understanding the request.

**Example:**

```typescript
if (!request.headers.get("Content-Type")?.includes("application/json")) {
	return badRequest({ error: "Request must be JSON" });
}
// Returns: { error: "Request must be JSON", ok: false }
```

#### `unauthorized<T>(input: T, init?: Init)`

Returns an unauthorized response with status 401 and adds `ok: false`.

**When to use:** User is not authenticated (no session, expired token, invalid credentials). The user needs to log in.

**Example:**

```typescript
let session = await getSession(request);
if (!session.userId) {
	return unauthorized({ error: "Please log in to continue" });
}
// Returns: { error: "Please log in to continue", ok: false }
```

#### `paymentRequired<T>(input: T, init?: Init)`

Returns a payment required response with status 402 and adds `ok: false`.

**When to use:** User needs to pay or upgrade their subscription to access a feature or resource.

**Example:**

```typescript
if (user.plan === "free" && usage.apiCalls >= 1000) {
	return paymentRequired({ error: "Upgrade to Pro for unlimited API calls" });
}
// Returns: { error: "Upgrade to Pro for unlimited API calls", ok: false }
```

#### `forbidden<T>(input: T, init?: Init)`

Returns a forbidden response with status 403 and adds `ok: false`.

**When to use:** User is authenticated but lacks permission to access the resource (wrong role, not the owner, feature disabled for their account).

**Example:**

```typescript
if (post.authorId !== session.userId && !user.isAdmin) {
	return forbidden({ error: "You can only edit your own posts" });
}
// Returns: { error: "You can only edit your own posts", ok: false }
```

#### `notFound<T>(input: T, init?: Init)`

Returns a not found response with status 404 and adds `ok: false`.

**When to use:** Requested resource doesn't exist (invalid ID, deleted content, wrong URL).

**Example:**

```typescript
let post = await db.posts.findUnique({ where: { id: postId } });
if (!post) {
	return notFound({ error: "Post not found" });
}
// Returns: { error: "Post not found", ok: false }
```

#### `methodNotAllowed<T>(input: T, init?: Init)`

Returns a method not allowed response with status 405 and adds `ok: false`.

**When to use:** HTTP method is not supported for the endpoint (trying to DELETE on a read-only resource, GET on a write-only endpoint).

**Example:**

```typescript
if (request.method === "DELETE") {
	return methodNotAllowed({ error: "Cannot delete system resources" });
}
// Returns: { error: "Cannot delete system resources", ok: false }
```

#### `notAcceptable<T>(input: T, init?: Init)`

Returns a not acceptable response with status 406 and adds `ok: false`.

**When to use:** Server cannot produce a response matching the Accept headers (requested format not supported, language not available).

**Example:**

```typescript
let accept = request.headers.get("Accept");
if (accept && !accept.includes("application/json")) {
	return notAcceptable({ error: "Only JSON responses are supported" });
}
// Returns: { error: "Only JSON responses are supported", ok: false }
```

#### `conflict<T>(input: T, init?: Init)`

Returns a conflict response with status 409 and adds `ok: false`.

**When to use:** Request conflicts with current state (duplicate entry, concurrent edit conflict, trying to create something that already exists).

**Example:**

```typescript
let existing = await db.users.findUnique({ where: { email } });
if (existing) {
	return conflict({ error: "A user with this email already exists" });
}
// Returns: { error: "A user with this email already exists", ok: false }
```

#### `gone<T>(input: T, init?: Init)`

Returns a gone response with status 410 and adds `ok: false`.

**When to use:** Resource existed but has been permanently deleted (better than 404 when you know it was intentionally removed, deprecated API endpoints).

**Example:**

```typescript
if (post.deletedAt) {
	return gone({ error: "This post has been permanently deleted" });
}
// Returns: { error: "This post has been permanently deleted", ok: false }
```

#### `preconditionFailed<T>(input: T, init?: Init)`

Returns a precondition failed response with status 412 and adds `ok: false`.

**When to use:** Conditional request headers (If-Match, If-Unmodified-Since) failed, typically for optimistic concurrency control.

**Example:**

```typescript
let ifMatch = request.headers.get("If-Match");
if (ifMatch && ifMatch !== post.etag) {
	return preconditionFailed({ error: "Resource was modified, please refresh" });
}
// Returns: { error: "Resource was modified, please refresh", ok: false }
```

#### `requestEntityTooLarge<T>(input: T, init?: Init)`

Returns a request entity too large response with status 413 and adds `ok: false`.

**When to use:** Request body or uploaded file exceeds size limits.

**Example:**

```typescript
let contentLength = Number(request.headers.get("Content-Length"));
if (contentLength > 10 * 1024 * 1024) {
	return requestEntityTooLarge({ error: "File exceeds 10MB limit", maxSize: "10MB" });
}
// Returns: { error: "File exceeds 10MB limit", maxSize: "10MB", ok: false }
```

#### `unsupportedMediaType<T>(input: T, init?: Init)`

Returns an unsupported media type response with status 415 and adds `ok: false`.

**When to use:** Request Content-Type is not supported (wrong file format, unexpected encoding).

**Example:**

```typescript
let contentType = request.headers.get("Content-Type");
if (!contentType?.includes("multipart/form-data")) {
	return unsupportedMediaType({ error: "File uploads require multipart/form-data" });
}
// Returns: { error: "File uploads require multipart/form-data", ok: false }
```

#### `unprocessableEntity<T>(input: T, init?: Init)`

Returns an unprocessable entity response with status 422 and adds `ok: false`.

**When to use:** Request is well-formed but contains semantic errors (validation failures, business rule violations). Preferred over 400 for form validation errors.

**Example:**

```typescript
let result = schema.safeParse(formData);
if (!result.success) {
	return unprocessableEntity({ errors: result.error.flatten().fieldErrors });
}
// Returns: { errors: { email: ["Invalid email"], ... }, ok: false }
```

#### `tooManyRequests<T>(input: T, init?: Init)`

Returns a too many requests response with status 429 and adds `ok: false`.

**When to use:** Rate limiting - user has sent too many requests in a given time window.

**Example:**

```typescript
let rateLimit = await checkRateLimit(request);
if (rateLimit.exceeded) {
	return tooManyRequests({
		error: "Rate limit exceeded",
		retryAfter: rateLimit.resetIn,
	});
}
// Returns: { error: "Rate limit exceeded", retryAfter: 60, ok: false }
```

### Server Error Responses (5xx)

All server error responses add `ok: false` to the data for type discrimination.

#### `internalServerError<T>(input: T, init?: Init)`

Returns an internal server error response with status 500 and adds `ok: false`.

**When to use:** Unexpected server error that isn't the client's fault. Use sparingly - prefer specific error types when possible.

**Example:**

```typescript
try {
	await processPayment(order);
} catch (error) {
	logger.error("Payment processing failed", { error, orderId: order.id });
	return internalServerError({ error: "Payment processing failed" });
}
// Returns: { error: "Payment processing failed", ok: false }
```

#### `notImplemented<T>(input: T, init?: Init)`

Returns a not implemented response with status 501 and adds `ok: false`.

**When to use:** Server doesn't support the functionality required (feature not built yet, planned but unfinished endpoints).

**Example:**

```typescript
export async function action() {
	return notImplemented({ error: "CSV export coming soon" });
}
// Returns: { error: "CSV export coming soon", ok: false }
```

#### `badGateway<T>(input: T, init?: Init)`

Returns a bad gateway response with status 502 and adds `ok: false`.

**When to use:** An upstream/external service returned an invalid response (third-party API error, malformed response from microservice).

**Example:**

```typescript
let response = await fetch(PAYMENT_API);
if (!response.ok) {
	return badGateway({ error: "Payment provider returned an error" });
}
// Returns: { error: "Payment provider returned an error", ok: false }
```

#### `serviceUnavailable<T>(input: T, init?: Init)`

Returns a service unavailable response with status 503 and adds `ok: false`.

**When to use:** Server is temporarily unavailable (maintenance mode, overloaded, dependencies down).

**Example:**

```typescript
if (await isMaintenanceMode()) {
	return serviceUnavailable({
		error: "System is under maintenance",
		retryAfter: 300,
	});
}
// Returns: { error: "System is under maintenance", retryAfter: 300, ok: false }
```

#### `gatewayTimeout<T>(input: T, init?: Init)`

Returns a gateway timeout response with status 504 and adds `ok: false`.

**When to use:** An upstream/external service took too long to respond.

**Example:**

```typescript
try {
	await fetchWithTimeout(EXTERNAL_API, { timeout: 5000 });
} catch (error) {
	if (error.name === "TimeoutError") {
		return gatewayTimeout({ error: "External service timed out" });
	}
	throw error;
}
// Returns: { error: "External service timed out", ok: false }
```

## Type Safety

All response helpers preserve the type of the input and add the `ok` property:

```typescript
let response = ok({ message: "Success", data: [1, 2, 3] });
// Type: { message: string, data: number[], ok: true }

let error = badRequest({ error: "Invalid input", fields: ["email"] });
// Type: { error: string, fields: string[], ok: false }

let notFoundResponse = notFound({ message: "Not found" });
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

## Patterns

### Discriminated Unions

The `ok` property makes responses work great with discriminated unions:

```typescript
export async function action({ request }: Route.ActionArgs) {
	let result = await processForm(request);

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

### Client Action with Toast Notifications

A common pattern is using client actions to show toast notifications based on server action results:

```typescript
import { redirect } from "@pkg/response";
import { href } from "react-router";
import { toast } from "sonner";

export async function clientAction({ serverAction, params }: Route.ClientActionArgs) {
	let result = await serverAction();
	if (result.ok) {
		toast.success(result.message);
		return redirect(href("/dashboard", params));
	}
	toast.error(result.message);
	return result;
}
```

## Related Packages

- `@pkg/result` - Commonly used with response for error handling
- `@pkg/validate` - Validation results often returned as badRequest
- `@pkg/location` - Used for building redirect URLs

## Tips

1. Use 303 (SeeOther) after POST to prevent form resubmission
2. Use 307/308 when you need to preserve the HTTP method
3. All responses add `ok` property automatically for type discrimination
4. Combine with @pkg/validate for consistent error responses

## Status Code Reference

### Success (2xx)

- `200` - OK (success)
- `201` - Created (resource created)
- `202` - Accepted (async processing)
- `204` - No Content (empty response)

### Redirects (3xx)

- `303` - See Other (POST -> GET redirect)
- `307` - Temporary Redirect (preserves method)
- `308` - Permanent Redirect (preserves method)

### Client Errors (4xx)

- `400` - Bad Request (client error)
- `401` - Unauthorized (authentication required)
- `402` - Payment Required
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `405` - Method Not Allowed
- `406` - Not Acceptable
- `409` - Conflict
- `410` - Gone
- `412` - Precondition Failed
- `413` - Request Entity Too Large
- `415` - Unsupported Media Type
- `422` - Unprocessable Entity (validation errors)
- `429` - Too Many Requests (rate limiting)

### Server Errors (5xx)

- `500` - Internal Server Error
- `501` - Not Implemented
- `502` - Bad Gateway
- `503` - Service Unavailable
- `504` - Gateway Timeout
