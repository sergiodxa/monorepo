# @sdxc/problem

Build, detect and parse [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) problem details
(`application/problem+json`), cataloged per API.

## Installation

```sh
npm add @sdxc/problem
```

Reads answer a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result).
Extension members validate with `remix/data-schema` from [`remix`](https://www.npmjs.com/package/remix)
or any other [Standard Schema](https://standardschema.dev/).

## Usage

### Answer with a problem

```typescript
import { problem } from "@sdxc/problem";

return problem({ status: 404 });
// 404, Content-Type: application/problem+json
// {"type":"about:blank","title":"Not Found","status":404}
```

A status alone is a complete document: `type` defaults to `about:blank` and `title` to the
status phrase. Add `type`, `title`, `detail`, `instance` and `extensions`, plus headers:

```typescript
return problem(
	{
		status: 403,
		type: "https://example.com/probs/out-of-credit",
		title: "You do not have enough credit.",
		detail: "Your current balance is 30, but that costs 50.",
		extensions: { balance: 30 },
	},
	{ headers: { "Cache-Control": "no-store" } },
);
```

Extensions are written at the document's top level, and the standard members always win over
an extension of the same name.

### Declare a catalog

```typescript
import { defineProblems } from "@sdxc/problem";
import * as s from "remix/data-schema";

export const problems = defineProblems("https://docs.example.com/errors/", {
	notFound: { slug: "not-found", status: 404, title: "The resource does not exist" },
	outOfCredit: {
		slug: "out-of-credit",
		status: 403,
		title: "You do not have enough credit",
		extensions: s.object({ balance: s.number() }),
	},
});

return problems.notFound({ detail: "No article has that slug." });
return problems.outOfCredit({ extensions: { balance: 30 } });
```

Each entry becomes a builder that writes `type` (the base URL, which ends in `/`, followed by
the slug), `status` and `title`; a call site supplies `detail`, `instance` and, exactly when the
entry declares a schema, the typed `extensions`.

### Read a problem

```typescript
import { isProblem, parseProblem } from "@sdxc/problem";
import { isSuccess } from "@sdxc/result";

if (isProblem(response)) {
	let result = await parseProblem(response);
	if (isSuccess(result)) result.data.type; // "https://example.com/probs/out-of-credit"
}
```

A catalog's `parse` names the entry a response belongs to and validates its extensions:

```typescript
let result = await problems.parse(response);

if (isSuccess(result) && problems.is(result.data, "outOfCredit")) {
	result.data.extensions.balance; // number
}
```

A `type` outside the catalog parses with `name: null`, since RFC 9457 has clients accept
problem types they do not know.

### Report validation failures

```typescript
import { issuesFrom, validationProblem } from "@sdxc/problem";
import * as s from "remix/data-schema";

let result = s.parseSafe(schema, body);
if (!result.success) return validationProblem(issuesFrom(result.issues));
// 422 {"errors":[{"pointer":"/user/email","code":"invalid","message":"..."}],"type":"about:blank",...}
```

## API

### `problem(options: ProblemOptions, init?: ResponseInit): Response`

A `Response` whose status line and body `status` both come from `options.status`, with
`Content-Type: application/problem+json`; `init` adds headers.

### `stringify(options: ProblemOptions): string`

The document's JSON text, for writing a problem somewhere other than a `Response`. A `null`
or omitted `detail` and `instance` are left out.

### `defineProblems(base: string, entries: ProblemEntries): ProblemCatalog`

`base` ends in `/`, and each `type` is `base` followed by the entry's slug. A catalog with one builder per entry, plus `parse(response)`, `is(problem, name)` and
`entries()`, which lists every entry in declaration order with its resolved `type` and, when
declared, its `extensions` schema. Entries cannot be named `parse`, `is` or `entries`.

### `isProblem(message: Request | Response): boolean`

Whether the message declares `application/problem+json`, comparing the media type
case-insensitively and accepting parameters. The body stays unread.

### `parseProblem(response: Response, options?): Promise<Result<Problem, ProblemParseError>>`

Reads a problem `Response`. Absent members take their RFC defaults and the status line wins
over the body's `status`; `options.extensions`, a synchronous Standard Schema, validates and
types the extensions. A response without the problem media type is a failure.

### `parse(text: string, options?: ParseOptions): Result<Problem, ProblemParseError>`

The same, from JSON text; `options.status` stands in for the status line.

### `validationProblem(issues: ProblemIssue[], options?): Response`

A `422` problem listing each invalid field in its `errors` extension. `options` sets any
standard member, including a different `status`.

### `issuesFrom(source, code = "invalid"): ProblemIssue[]`

Converts Standard Schema issues, or anything carrying them in `issues`, into `errors`
entries, turning each path into a JSON Pointer and giving every entry `code`.

### `toPointer(path): string`

Formats a Standard Schema issue path as an RFC 6901 JSON Pointer, escaping `~` and `/`; an
empty path is `""`.

### `ISSUES_SCHEMA`

The schema of the `errors` extension, for `s.object({ errors: ISSUES_SCHEMA })`. It also
implements [Standard JSON Schema](https://standardschema.dev/), so a tool can describe it.

### `ProblemParseError`

Why a document is not a problem; `issues` holds the extension schema's issues when that is the
reason, and is empty otherwise.

### `PROBLEM_MEDIA_TYPE`, `ABOUT_BLANK`

`"application/problem+json"` and `"about:blank"`.

### Types

`Problem<Extensions>` is a parsed document, with `detail` and `instance` as `string | null`
and every non-standard member under `extensions`. `ProblemOptions<Extensions>` is what a
writer passes, `ProblemIssue` is one `errors` entry (`pointer`, `code`, `message`) and
`ParseOptions<Extensions>` holds `extensions` and `status`.

For catalogs, `ProblemEntry` is one declared entry (`slug`, `status`, `title`, `extensions?`)
and `ProblemEntries` the record of them; `ProblemCatalog<Entries>` is what `defineProblems`
returns, made of a `ProblemBuilder` per entry, whose argument is a `BuilderInput`, and the
`CatalogMethods`. `CatalogProblem<Entries>` is a parsed problem carrying `name`, and
`CatalogEntry` one item of `entries()`.

## Pattern: Share A Catalog Between A Server And Its Client

One module declares the catalog; the server answers with its builders and the client branches
on the entry a response belongs to.

```typescript
// api-problems.ts, imported by both sides
import { ISSUES_SCHEMA, defineProblems } from "@sdxc/problem";
import * as s from "remix/data-schema";

export const apiProblems = defineProblems("https://docs.example.com/errors/", {
	notFound: { slug: "not-found", status: 404, title: "The resource does not exist" },
	validationFailed: {
		slug: "validation-failed",
		status: 422,
		title: "The request body is invalid",
		extensions: s.object({ errors: ISSUES_SCHEMA }),
	},
});
```

```typescript
// server
import { issuesFrom } from "@sdxc/problem";
import * as s from "remix/data-schema";

import { apiProblems } from "./api-problems.js";

let result = s.parseSafe(schema, body);
if (!result.success) {
	return apiProblems.validationFailed({ extensions: { errors: issuesFrom(result.issues) } });
}
```

```typescript
// client
import { isSuccess } from "@sdxc/result";

import { apiProblems } from "./api-problems.js";

let response = await fetch(url, { method: "POST", body });
if (!response.ok) {
	let result = await apiProblems.parse(response);
	if (isSuccess(result) && apiProblems.is(result.data, "validationFailed")) {
		for (let issue of result.data.extensions.errors) showError(issue.pointer, issue.message);
	}
}
```

## Pattern: Render An Error Reference From The Catalog

Each `type` is a URL under the catalog's base, so the page at that base can list every entry,
with each anchor matching a slug and each extension described where its schema implements
Standard JSON Schema.

```typescript
import { apiProblems } from "./api-problems.js";

let reference = apiProblems.entries().map((entry) => {
	let converter =
		entry.extensions !== undefined && "jsonSchema" in entry.extensions["~standard"]
			? entry.extensions["~standard"].jsonSchema
			: undefined;
	return {
		anchor: new URL(entry.type).pathname.split("/").at(-1),
		title: entry.title,
		status: entry.status,
		extensions: converter?.output({ target: "draft-2020-12" }) ?? null,
	};
});

return Response.json(reference);
```

## Pattern: Validation Failures With Custom Codes

`issuesFrom` reads the `issues` of a thrown or returned validation error as readily as a bare
list, and its `code` names the failure for a client branching without reading `message`.

```typescript
import { issuesFrom, validationProblem } from "@sdxc/problem";
import * as s from "remix/data-schema";

let signup = s.object({ email: s.string(), password: s.string() });

let parsed = s.parseSafe(signup, await request.json());
if (!parsed.success) {
	return validationProblem(issuesFrom(parsed.issues), {
		detail: "Fix the highlighted fields and try again.",
		instance: `/signups/${requestId}`,
	});
}

if (await emailTaken(parsed.value.email)) {
	return validationProblem(
		issuesFrom([{ message: "That email is already registered.", path: ["email"] }], "taken"),
		{ status: 409, title: "Conflict" },
	);
}
```

## Pattern: Read A Third-Party API's Problems

A service that answers RFC 9457 documents can have its extensions typed with a schema of
your own, with any other failure falling back to the status.

```typescript
import { parseProblem } from "@sdxc/problem";
import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";

let RateLimited = s.object({ retryAfter: s.number() });

let response = await fetch("https://api.example.com/v1/charges", { method: "POST", body });
if (response.status === 429) {
	let result = await parseProblem(response, { extensions: RateLimited });
	let retryAfter = isFailure(result) ? 60 : result.data.extensions.retryAfter;
	return new Response(null, { status: 503, headers: { "Retry-After": String(retryAfter) } });
}
```

`parseProblem` fails for a response whose `Content-Type` is not the problem media type, and
`result.error.issues` lists what the extension schema rejected, so a proxy's HTML error page or
an unexpected document takes the fallback.

## Pattern: Problems Outside HTTP

`stringify` and `parse` carry a problem through a queue, a WebSocket or a log, where there is
no status line; the body's own `status` is used, or `options.status` when the transport carries
one separately.

```typescript
import { parse, stringify } from "@sdxc/problem";
import { isSuccess } from "@sdxc/result";

socket.send(
	stringify({
		status: 503,
		title: "The import worker is offline",
		detail: "Retrying in 30 seconds.",
	}),
);

socket.addEventListener("message", (event) => {
	let result = parse(String(event.data));
	if (isSuccess(result)) showBanner(result.data.title, result.data.detail);
});
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/problem": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
