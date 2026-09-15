# @sdxc/validate

Validate a form submission, a request body, or a plain object against any Standard Schema, and get a `Result` back instead of a thrown error.

## Installation

```bash
npm add @sdxc/validate
```

The schema itself comes from any library implementing [Standard Schema](https://standardschema.dev) — [`remix`](https://www.npmjs.com/package/remix), [Valibot](https://valibot.dev), [ArkType](https://arktype.io) — installed alongside this package. [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) installs with it and supplies `isSuccess`, `isFailure` and `unwrap`.

```bash
npm add valibot
```

## Usage

### Validate a plain object

```typescript
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { email, minLength } from "remix/data-schema/checks";

let schema = s.object({
	email: s.string().pipe(email()),
	name: s.string().pipe(minLength(2)),
});

let result = await validate({ email: "ada@example.com", name: "Ada" }, schema);

if (isFailure(result)) console.error(result.error.issues);
else console.log(result.data.email); // typed `string` from the schema
```

### Validate a form submission

`FormData` and `URLSearchParams` flatten to an object first: a name submitted once becomes a value, and a name submitted several times becomes an array.

```typescript
let form = new FormData();
form.append("email", "ada@example.com");
form.append("tags", "typescript");
form.append("tags", "validation");

let result = await validate(form, s.object({ email: s.string(), tags: s.array(s.string()) }));
```

### Validate a request

A `Request` is read according to its `Content-Type`, so one call covers every kind of submission a route accepts:

```typescript
async function handler(request: Request) {
	let result = await validate(request, schema);

	if (isFailure(result)) {
		return Response.json({ errors: result.error.issues }, { status: 400 });
	}

	return Response.json({ user: result.data });
}
```

### Read the failure

Every issue carries the path it failed at, so a refusal can be reported field by field:

```typescript
if (isFailure(result)) {
	for (let issue of result.error.issues) console.log(issue.path, issue.message);
	// ["email"] Expected valid email
	// ["name"] Expected at least 2 characters
}
```

## API

### `validate<Schema>(input, schema): Promise<Result<InferOutput<Schema>, ValidationError>>`

Normalizes `input`, runs it through `schema`, and resolves to a `Result` carrying either the schema's own output type or a `ValidationError`. A rejected submission is a value, not an exception.

`input` is any of:

- `FormData` or `URLSearchParams` — entries flatten to an object, a repeated name becoming an array.
- `Request` — the body is read by content type: `application/json`, `multipart/form-data`, or `application/x-www-form-urlencoded`. Any other type refuses with `Unsupported content-type: …`, and a body that is not valid JSON refuses with `Invalid JSON in request body`.
- A plain object, or any JSON value — handed to the schema as it stands.

Some schemas validate the raw source rather than a flattened object — `remix/data-schema/form-data`'s `object()` is one, and it rejects the flattened object with `Expected FormData or URLSearchParams`. That rejection is retried against the original `FormData` or `URLSearchParams`, so those schemas pass through the same call as any other.

`schema` is any Standard Schema V1 value, and the success type is inferred from it, so nothing restates the shape the schema already describes.

### `ValidationError`

What a refused submission carries. `message` is always `"Validation Error"`, and `issues` is the schema's own `StandardSchemaV1.Issue[]` — each a `message` plus the `path` it failed at, in whatever vocabulary the schema library produced.

## Pattern: One Schema Behind Several Entry Points

A schema is a value, so the rule a form enforces in the browser and the rule an API enforces on the wire can be the same object rather than two that drift:

```typescript
// schemas.ts
import * as s from "remix/data-schema";
import { email, min, minLength } from "remix/data-schema/checks";

export let signup = s.object({
	email: s.string().pipe(email()),
	name: s.string().pipe(minLength(2)),
	age: s.optional(s.number().pipe(min(18))),
});
```

```typescript
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";

import { signup } from "./schemas.js";

async function handler(request: Request) {
	let result = await validate(request, signup);
	if (isFailure(result)) return Response.json({ errors: result.error.issues }, { status: 400 });
	return Response.json({ user: await createUser(result.data) });
}
```

There is no `.partial()` helper, so a variant where every field is optional wraps each one in `s.optional()`.

## Pattern: Rendering A Refused Submission

`ValidationError.issues` already matches the issue shape [`@sdxc/ui`](https://www.npmjs.com/package/@sdxc/ui)'s `Form` takes, so a refusal re-renders the same page with the array passed straight through. Each field looks its own messages up by `name`, renders them, marks itself `aria-invalid`, and the first invalid field of the render takes focus — so nothing else is threaded down:

```tsx
import type { Handle } from "remix/ui";

import { Button, Form, TextField } from "@sdxc/ui";

function SignupForm(handle: Handle<{ issues?: ReadonlyArray<Form.Issue> }>) {
	return () => (
		<Form method="post" issues={handle.props.issues}>
			<TextField label="Email" name="email" type="email" required />
			<TextField label="Password" name="password" type="password" required />
			<Button type="submit">Sign up</Button>
		</Form>
	);
}
```

```tsx
let result = await validate(submission, schema);

if (isFailure(result)) return <SignupForm issues={result.error.issues} />;
```

## Pattern: Normalizing While Validating

A schema transforms as it validates, so the handler receives values in the shape it wants rather than the shape the wire delivered. Everything arriving from a form is a string, which is where this earns the most:

```typescript
let schema = s.object({
	email: s
		.string()
		.pipe(email())
		.transform((value) => value.toLowerCase()),
	age: s.string().transform(Number),
	tags: s.string().transform((value) => value.split(",")),
});

let form = new FormData();
form.append("email", "ADA@EXAMPLE.COM");
form.append("age", "25");
form.append("tags", "typescript,validation");

let result = await validate(form, schema);
// { email: "ada@example.com", age: 25, tags: ["typescript", "validation"] }
```

## Pattern: Custom Messages

Checks are plain objects, so a custom message spreads the check and overrides its `message`. There is no regex check, so a pattern rule goes through `.refine()`, which takes its message as a second argument:

```typescript
let schema = s.object({
	email: s.string().pipe({ ...email(), message: "Please enter a valid email address" }),
	password: s
		.string()
		.pipe({ ...minLength(8), message: "Password must be at least 8 characters" })
		.refine((value) => /[A-Z]/.test(value), "Password must contain an uppercase letter"),
});
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/validate": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
