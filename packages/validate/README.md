# @pkg/validate

Type-safe form and request validation using Standard Schema with Result types.

## Overview

This package provides a unified validation function that works with FormData, Request objects (both form-encoded and JSON), and plain JavaScript objects. It uses the [Standard Schema](https://standardschema.dev) specification, which means it works with any schema validation library that implements the standard, including `remix/data-schema`, Valibot, ArkType, and more.

The validation result is returned as a `Result<T, ValidationError>` type from `@pkg/result`, making error handling explicit and type-safe.

## Installation

This package requires `@pkg/result` and works with any Standard Schema-compliant validation library.

```bash
bun add remix  # or valibot, arktype, etc.
```

## Usage

### Basic Example with `remix/data-schema`

```typescript
import { validate } from "@pkg/validate";
import { isSuccess, isFailure } from "@pkg/result";
import * as s from "remix/data-schema";
import { email, minLength } from "remix/data-schema/checks";

let schema = s.object({
	email: s.string().pipe(email()),
	name: s.string().pipe(minLength(2)),
});

export async function action({ request }: Route.ActionArgs) {
	let result = await validate(request, schema);

	if (isFailure(result)) {
		return badRequest({ errors: result.error.issues });
	}

	// TypeScript knows result.data is { email: string, name: string }
	await saveUser(result.data);
	return ok({ message: "User created!" });
}
```

### With FormData

```typescript
let formData = new FormData();
formData.append("email", "user@example.com");
formData.append("name", "Alice");

let result = await validate(formData, schema);

if (isSuccess(result)) {
	console.log(result.data.email); // "user@example.com"
	console.log(result.data.name); // "Alice"
}
```

### With Request (Form-Encoded)

```typescript
export async function action({ request }: Route.ActionArgs) {
	// Request with Content-Type: application/x-www-form-urlencoded
	let result = await validate(request, schema);

	if (isFailure(result)) {
		return badRequest({ errors: result.error.issues });
	}

	return ok({ data: result.data });
}
```

### With Request (JSON)

```typescript
export async function action({ request }: Route.ActionArgs) {
	// Request with Content-Type: application/json
	let result = await validate(request, schema);

	if (isFailure(result)) {
		return badRequest({ errors: result.error.issues });
	}

	return ok({ data: result.data });
}
```

### With Plain Objects

```typescript
let data = {
	email: "user@example.com",
	name: "Bob",
};

let result = await validate(data, schema);

if (isSuccess(result)) {
	console.log(result.data);
}
```

### With URLSearchParams

```typescript
let params = new URLSearchParams();
params.append("email", "user@example.com");
params.append("name", "Charlie");

let result = await validate(params, schema);

if (isSuccess(result)) {
	console.log(result.data.email); // "user@example.com"
	console.log(result.data.name); // "Charlie"
}
```

## API

### `validate<Schema>(input, schema): Promise<Result<T, ValidationError>>`

Validates input data against a Standard Schema-compliant schema.

**Parameters:**

- `input`: `FormData | URLSearchParams | Request | Record<string, unknown>` - The data to validate
  - `FormData`: Converts entries to an object and validates
  - `URLSearchParams`: Converts entries to an object and validates
  - `Request`: Automatically detects content type
    - `application/json`: Parses JSON body
    - `application/x-www-form-urlencoded`: Parses as URLSearchParams
    - `multipart/form-data`: Parses as FormData
  - `Record<string, unknown>`: Validates plain object directly
- `schema`: Any Standard Schema V1 compliant schema (`remix/data-schema`, Valibot, ArkType, etc.)

**Returns:**

- `Promise<Result<T, ValidationError>>` where:
  - `Success<T>`: Contains validated and typed data
  - `Failure<ValidationError>`: Contains validation issues

**Example:**

```typescript
let result = await validate(request, schema);

if (isSuccess(result)) {
	// result.data is fully typed based on your schema
	console.log(result.data);
} else {
	// result.error is ValidationError with detailed issues
	console.error(result.error.issues);
}
```

### `ValidationError`

Error class containing validation issues from the schema.

**Properties:**

- `message`: Always `"Validation Error"`
- `issues`: `StandardSchemaV1.Issue[]` - Array of validation issues

**Issue Structure:**

```typescript
interface Issue {
	message: string; // Error message
	path?: ReadonlyArray<PropertyKey | PathSegment> | undefined; // Path to the field
}
```

**Example:**

```typescript
if (isFailure(result)) {
	console.log(result.error.message); // "Validation Error"
	console.log(result.error.issues);
	// [
	//   { message: "Expected valid email", path: ["email"] },
	//   { message: "Expected at least 2 characters", path: ["name"] }
	// ]
}
```

## Schema Libraries

This package works with any library that implements the Standard Schema specification.

### `remix/data-schema`

```typescript
import * as s from "remix/data-schema";
import { email, min } from "remix/data-schema/checks";

let schema = s.object({
	email: s.string().pipe(email()),
	age: s.number().pipe(min(18)),
	role: s.enum_(["user", "admin"]),
});

let result = await validate(formData, schema);
```

### Valibot

```typescript
import * as v from "valibot";

let schema = v.object({
	email: v.pipe(v.string(), v.email()),
	age: v.pipe(v.number(), v.minValue(18)),
	role: v.picklist(["user", "admin"]),
});

let result = await validate(formData, schema);
```

### ArkType

```typescript
import { type } from "arktype";

let schema = type({
	email: "string.email",
	"age>=": 18,
	role: "'user'|'admin'",
});

let result = await validate(formData, schema);
```

## Type Safety

The `validate` function automatically infers the output type from your schema:

```typescript
let schema = s.object({
	email: s.string().pipe(email()),
	name: s.string(),
	age: s.number(),
});

let result = await validate(request, schema);

if (isSuccess(result)) {
	// TypeScript knows:
	// result.data = {
	//   email: string;
	//   name: string;
	//   age: number;
	// }
	let email: string = result.data.email; // ✓ Type-safe
	let name: string = result.data.name; // ✓ Type-safe
	let age: number = result.data.age; // ✓ Type-safe
}
```

## Integration with React Router

### Basic Action

```typescript
import { validate } from "@pkg/validate";
import { isFailure } from "@pkg/result";
import { ok, badRequest } from "@pkg/response";
import * as s from "remix/data-schema";
import { email, minLength } from "remix/data-schema/checks";

let schema = s.object({
	email: s.string().pipe(email()),
	password: s.string().pipe(minLength(8)),
});

export async function action({ request }: Route.ActionArgs) {
	let result = await validate(request, schema);

	if (isFailure(result)) {
		return badRequest({ errors: result.error.issues });
	}

	let user = await createUser(result.data);
	return ok({ user });
}
```

### With Early Returns

```typescript
export async function action({ request }: Route.ActionArgs) {
	let validation = await validate(request, loginSchema);
	if (isFailure(validation)) {
		return badRequest({ errors: validation.error.issues });
	}

	let userResult = await findUser(validation.data.email);
	if (isFailure(userResult)) {
		return notFound({ error: "User not found" });
	}

	let passwordValid = await verifyPassword(validation.data.password, userResult.data.passwordHash);
	if (!passwordValid) {
		return unauthorized({ error: "Invalid credentials" });
	}

	return ok({ user: userResult.data });
}
```

### Displaying Errors in Components

```typescript
export default function SignupForm({ actionData }: Route.ComponentProps) {
	return (
		<Form method="post">
			<input type="email" name="email" />
			{actionData?.errors
				?.filter((issue) => issue.path?.[0] === "email")
				.map((issue) => (
					<p key={issue.message} className="error">
						{issue.message}
					</p>
				))}

			<input type="password" name="password" />
			{actionData?.errors
				?.filter((issue) => issue.path?.[0] === "password")
				.map((issue) => (
					<p key={issue.message} className="error">
						{issue.message}
					</p>
				))}

			<button type="submit">Sign Up</button>
		</Form>
	);
}
```

## Content Type Detection

The `validate` function automatically detects and handles different content types when given a `Request`:

### Supported Content Types

- **`application/json`** - Parses JSON request body
- **`multipart/form-data`** - Parses multipart form data
- **`application/x-www-form-urlencoded`** - Parses URL-encoded form data

### JSON Requests

```typescript
// Request with Content-Type: application/json
let request = new Request("https://api.example.com/users", {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({ email: "user@example.com", name: "Alice" }),
});

let result = await validate(request, schema);
// Automatically parses JSON body
```

### Form Requests (multipart/form-data)

```typescript
// When you pass FormData to Request, it automatically sets
// Content-Type: multipart/form-data with boundary
let formData = new FormData();
formData.append("email", "user@example.com");
formData.append("name", "Alice");

let request = new Request("https://example.com/submit", {
	method: "POST",
	body: formData,
});

let result = await validate(request, schema);
// Automatically parses FormData
```

### Form Requests (application/x-www-form-urlencoded)

```typescript
// URL-encoded form data
let params = new URLSearchParams();
params.append("email", "user@example.com");
params.append("name", "Alice");

let request = new Request("https://example.com/submit", {
	method: "POST",
	headers: { "Content-Type": "application/x-www-form-urlencoded" },
	body: params,
});

let result = await validate(request, schema);
// Automatically parses URL-encoded data
```

### Unsupported Content Types

If a Request has an unsupported content-type, validation will fail:

```typescript
let request = new Request("https://example.com/submit", {
	method: "POST",
	headers: { "Content-Type": "text/plain" },
	body: "plain text",
});

let result = await validate(request, schema);

if (isFailure(result)) {
	console.log(result.error.issues[0].message);
	// "Unsupported content-type: text/plain. Expected application/json, multipart/form-data, or application/x-www-form-urlencoded"
}
```

### Invalid JSON Handling

```typescript
let request = new Request("https://api.example.com/users", {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: "{ invalid json",
});

let result = await validate(request, schema);

if (isFailure(result)) {
	console.log(result.error.issues[0].message);
	// "Invalid JSON in request body"
}
```

## Pattern: Reusable Schemas

Define schemas once and reuse them across your application:

```typescript
// schemas.ts
import * as s from "remix/data-schema";
import { email, min, minLength } from "remix/data-schema/checks";

export let userSchema = s.object({
	email: s.string().pipe(email()),
	name: s.string().pipe(minLength(2)),
	age: s.optional(s.number().pipe(min(18))),
});

export let loginSchema = s.object({
	email: s.string().pipe(email()),
	password: s.string().pipe(minLength(8)),
});

// There is no `.partial()` helper, so a schema where every field is optional is
// spelled out by wrapping each one in `s.optional()`.
export let updateUserSchema = s.object({
	email: s.optional(s.string().pipe(email())),
	name: s.optional(s.string().pipe(minLength(2))),
	age: s.optional(s.number().pipe(min(18))),
});
```

```typescript
// routes/signup.ts
import { validate } from "@pkg/validate";
import { userSchema } from "~/schemas";

export async function action({ request }: Route.ActionArgs) {
	let result = await validate(request, userSchema);
	// ...
}
```

## Pattern: Custom Error Messages

Checks are plain objects, so a custom message is applied by spreading the check
and overriding its `message`. There is no regex check, so pattern rules go
through `.refine()`, which takes the message as its second argument.

```typescript
import * as s from "remix/data-schema";
import { email, minLength } from "remix/data-schema/checks";

let schema = s.object({
	email: s.string().pipe({ ...email(), message: "Please enter a valid email address" }),
	password: s
		.string()
		.pipe({ ...minLength(8), message: "Password must be at least 8 characters" })
		.refine((value) => /[A-Z]/.test(value), "Password must contain at least one uppercase letter"),
});
```

## Pattern: Transformations

Schema libraries can transform data during validation:

```typescript
import * as s from "remix/data-schema";
import { email } from "remix/data-schema/checks";

let schema = s.object({
	email: s
		.string()
		.pipe(email())
		.transform((value) => value.toLowerCase()), // Transform to lowercase
	age: s.string().transform(Number), // Convert string to number
	tags: s.string().transform((str) => str.split(",")), // Split into array
});

let formData = new FormData();
formData.append("email", "USER@EXAMPLE.COM");
formData.append("age", "25");
formData.append("tags", "javascript,typescript,react");

let result = await validate(formData, schema);

if (isSuccess(result)) {
	console.log(result.data);
	// {
	//   email: "user@example.com",  // Transformed to lowercase
	//   age: 25,                     // Transformed to number
	//   tags: ["javascript", "typescript", "react"]  // Transformed to array
	// }
}
```

## Pattern: Nested Objects

```typescript
let schema = s.object({
	user: s.object({
		name: s.string(),
		email: s.string().pipe(email()),
	}),
	preferences: s.object({
		newsletter: s.boolean(),
		theme: s.enum_(["light", "dark"]),
	}),
});

let result = await validate(data, schema);

if (isFailure(result)) {
	// Issues include paths like ["user", "email"] or ["preferences", "theme"]
	result.error.issues.forEach((issue) => {
		console.log(issue.path, issue.message);
	});
}
```

## Pattern: Array Validation

```typescript
let schema = s.object({
	tags: s.array(s.string()),
	emails: s.array(s.string().pipe(email())),
});

// With FormData, you can append multiple values with the same name
let formData = new FormData();
formData.append("tags", "javascript");
formData.append("tags", "typescript");
formData.append("emails", "user1@example.com");
formData.append("emails", "user2@example.com");
```

## Error Handling

### Checking Individual Fields

```typescript
if (isFailure(result)) {
	let emailIssues = result.error.issues.filter((issue) => issue.path?.[0] === "email");

	let passwordIssues = result.error.issues.filter((issue) => issue.path?.[0] === "password");

	if (emailIssues.length > 0) {
		console.log("Email errors:", emailIssues);
	}
}
```

### Grouping Errors by Field

```typescript
if (isFailure(result)) {
	let errorsByField = result.error.issues.reduce(
		(acc, issue) => {
			let field = issue.path?.[0]?.toString() ?? "general";
			if (!acc[field]) acc[field] = [];
			acc[field].push(issue.message);
			return acc;
		},
		{} as Record<string, string[]>,
	);

	console.log(errorsByField);
	// {
	//   email: ["Invalid email format"],
	//   password: ["Password too short", "Password must contain uppercase"]
	// }
}
```

## Why Standard Schema?

The Standard Schema specification allows this package to work with any compliant validation library without needing adapters or library-specific code. Benefits include:

1. **Library agnostic** - Switch between `remix/data-schema`, Valibot, ArkType without changing validation code
2. **Future-proof** - New libraries implementing the standard work automatically
3. **Smaller bundles** - Use lightweight libraries like Valibot if bundle size matters
4. **Ecosystem growth** - More tools and libraries are adopting the standard

## Related Packages

- [`@pkg/result`](/packages/result) - Result type for explicit error handling
- [`@pkg/response`](/packages/response) - Type-safe response helpers for React Router
- [Standard Schema](https://standardschema.dev) - The specification this package implements

## Tips

1. **Prefer early returns** - Check for validation failures early and return error responses
2. **Reuse schemas** - Define schemas in a central location and import them
3. **Custom messages** - Provide user-friendly error messages in your schemas
4. **Transform data** - Use schema transformations to normalize data (lowercase emails, trim strings, etc.)
5. **Type inference** - Let TypeScript infer types from your schemas instead of duplicating type definitions
