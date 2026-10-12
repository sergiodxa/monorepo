# @sdxc/validate

Standard Schema validation for form submissions, request bodies and plain objects, answering a `Result` instead of throwing.

## Installation

```sh
npm add @sdxc/validate
```

Bring a schema library that implements [Standard Schema](https://standardschema.dev), such as [`remix`](https://www.npmjs.com/package/remix)'s `remix/data-schema`, [Valibot](https://valibot.dev) or [ArkType](https://arktype.io). [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) installs with this package and supplies `isFailure`, `success` and `failure`.

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
else console.log(result.data.email); // typed from the schema
```

### Validate a form submission

`FormData` and `URLSearchParams` flatten to an object first: a name submitted once becomes a value, and a name submitted several times becomes an array.

```typescript
let form = new FormData();
form.append("email", "ada@example.com");
form.append("tags", "typescript");
form.append("tags", "validation");

let result = await validate(form, s.object({ email: s.string(), tags: s.array(s.string()) }));
// result.data: { email: "ada@example.com", tags: ["typescript", "validation"] }
```

### Validate a request

A `Request` is read by its `Content-Type`, so one call covers JSON, multipart and URL-encoded submissions:

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

Every issue carries the `path` it failed at, so a refusal reports field by field:

```typescript
if (isFailure(result)) {
	for (let issue of result.error.issues) console.log(issue.path, issue.message);
	// ["email"] Expected valid email
	// ["name"] Expected at least 2 characters
}
```

## API

### `validate<Schema>(input, schema): Promise<Result<StandardSchemaV1.InferOutput<Schema>, ValidationError>>`

Runs `input` through any Standard Schema V1 `schema` and resolves to the schema's output type or a `ValidationError`; the success type is inferred from the schema. `input` is one of:

- `FormData` or `URLSearchParams`: flattened to an object, a repeated name becoming an array. A schema that validates the raw source (one that reports `Expected FormData or URLSearchParams`, such as `remix/data-schema/form-data`'s `object()`) receives the original `FormData` or `URLSearchParams` instead.
- `Request`: the body is read as JSON for `application/json` and any `+json` media type, as `FormData` for `multipart/form-data`, and as `URLSearchParams` for `application/x-www-form-urlencoded`. A malformed JSON body refuses with `Invalid JSON in request body`, and any other content type refuses with `Unsupported content-type: …`.
- A plain object or any JSON value, handed to the schema as it is.

### `ValidationError`

The `Error` a refusal carries. `message` is `"Validation Error"` and `issues` is the schema's own `StandardSchemaV1.Issue[]`, each a `message` plus an optional `path`.

#### `new ValidationError(issues: readonly StandardSchemaV1.Issue[])`

Builds a refusal from your own issues, so a rule checked outside the schema fails the same way the schema does.

## Pattern: One Schema Behind Every Entry Point

A schema is a value, so a JSON API, an HTML form and a query string can share it. Validate a query string by passing the URL's `searchParams`:

```typescript
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { email, minLength } from "remix/data-schema/checks";
import * as coerce from "remix/data-schema/coerce";

let signup = s.object({
	email: s.string().pipe(email()),
	name: s.string().pipe(minLength(2)),
});

let search = s.object({
	q: s.defaulted(s.string(), ""),
	page: s.defaulted(coerce.number(), 1),
});

async function create(request: Request) {
	let result = await validate(request, signup); // JSON or form body
	if (isFailure(result)) return Response.json({ errors: result.error.issues }, { status: 400 });
	return Response.json({ user: result.data }, { status: 201 });
}

async function list(request: Request) {
	let result = await validate(new URL(request.url).searchParams, search);
	if (isFailure(result)) return Response.json({ errors: result.error.issues }, { status: 400 });
	return Response.json({ query: result.data.q, page: result.data.page });
}
```

## Pattern: Normalizing While Validating

Everything a form submits is a string. Coerce and transform in the schema so the handler receives the shape it wants:

```typescript
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { email } from "remix/data-schema/checks";
import * as coerce from "remix/data-schema/coerce";

let schema = s.object({
	email: s
		.string()
		.pipe(email())
		.transform((value) => value.toLowerCase()),
	age: coerce.number(),
	newsletter: s.defaulted(coerce.boolean(), false),
	tags: s.string().transform((value) => value.split(",")),
});

let form = new FormData();
form.append("email", "ADA@EXAMPLE.COM");
form.append("age", "25");
form.append("tags", "typescript,validation");

let result = await validate(form, schema);
// result.data: { email: "ada@example.com", age: 25, newsletter: false, tags: ["typescript", "validation"] }
```

## Pattern: Uploads With a Form-Data Schema

Schemas from `remix/data-schema/form-data` read the `FormData` itself, which is what file fields need. `validate` hands them the original submission:

```typescript
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";

let upload = f.object({
	title: f.field(s.string()),
	attachments: f.files(s.array(s.instanceof_(File))),
});

async function handler(request: Request) {
	let result = await validate(request, upload);
	if (isFailure(result)) return Response.json({ errors: result.error.issues }, { status: 400 });

	for (let file of result.data.attachments) console.log(file.name, file.size);
	return new Response(null, { status: 204 });
}
```

## Pattern: Refusing On a Business Rule

Some rules need a database or another service. Fail them with your own `ValidationError` so callers handle one error type:

```typescript
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";
import { ValidationError, validate } from "@sdxc/validate";

async function register(request: Request): Promise<Result<{ email: string }, ValidationError>> {
	let result = await validate(request, signup);
	if (isFailure(result)) return result;

	if (await emailTaken(result.data.email)) {
		return failure(new ValidationError([{ message: "That email is taken", path: ["email"] }]));
	}

	return success({ email: result.data.email });
}
```

Leave `path` out for a refusal that belongs to no single field.

## Pattern: Rendering a Refused Submission

`ValidationError.issues` matches the issue shape of the `Form` in [`@sdxc/ui`](https://www.npmjs.com/package/@sdxc/ui). Pass it straight through: each field shows its own messages by `name`, marks itself invalid, and the first invalid field takes focus. Issues without a `path` render at the top of the form.

```tsx
import type { Handle } from "remix/component";

import { isFailure } from "@sdxc/result";
import { Button, Form, TextField } from "@sdxc/ui";
import { validate } from "@sdxc/validate";

function SignupForm(handle: Handle<{ issues?: ReadonlyArray<Form.Issue> }>) {
	return () => (
		<Form method="post" issues={handle.props.issues}>
			<TextField label="Email" name="email" type="email" required />
			<TextField label="Name" name="name" required />
			<Button type="submit">Sign up</Button>
		</Form>
	);
}

let result = await validate(request, signup);
if (isFailure(result)) return <SignupForm issues={result.error.issues} />;
```

## Pattern: Custom Messages

The messages in `issues` are the schema's. With `remix/data-schema`, a check is a plain object, so spread it and override `message`; `.refine()` takes its message as the second argument:

```typescript
import * as s from "remix/data-schema";
import { email, minLength } from "remix/data-schema/checks";

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
