# @sdxc/problem

Build, detect and parse [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) problem details
(`application/problem+json`), and declare an API's problem types in one catalog.

## Installation

```bash
npm add @sdxc/problem
```

Extension members are validated with [`remix/data-schema`](https://www.npmjs.com/package/remix)
or any other [Standard Schema](https://standardschema.dev/), and results come back as
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) values; both install alongside
this package.

## Usage

### Answer With A Problem

```typescript
import { problem } from "@sdxc/problem";

return problem({ status: 404 });
// 404, Content-Type: application/problem+json
// {"type":"about:blank","title":"Not Found","status":404}
```

A status alone is a complete document: `type` defaults to `about:blank` and `title` to the
status phrase. Add `type`, `title`, `detail`, `instance` and `extensions` as needed:

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

Extensions are written at the document's top level, and one named like a standard member
never replaces it.

### Declare A Catalog

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

Each entry becomes a builder that writes its `type` (the base URL followed by the slug),
`status` and `title`, so a call site supplies only `detail`, `instance` and the extensions
its schema types. The base URL must end in `/`.

### Read A Problem

```typescript
import { isProblem, parseProblem } from "@sdxc/problem";
import { isSuccess } from "@sdxc/result";

if (isProblem(response)) {
	let result = await parseProblem(response);
	if (isSuccess(result)) result.data.type; // "https://example.com/probs/out-of-credit"
}
```

With a catalog, `parse` names the entry a response belongs to and validates its extensions:

```typescript
let result = await problems.parse(response);

if (isSuccess(result) && problems.is(result.data, "outOfCredit")) {
	result.data.extensions.balance; // number
}
```

A `type` outside the catalog still parses, with `name: null`, as RFC 9457 requires clients
to accept problem types they do not know.

### Report Validation Failures

```typescript
import { issuesFrom, validationProblem } from "@sdxc/problem";
import * as s from "remix/data-schema";

let result = s.parseSafe(schema, body);
if (!result.success) return validationProblem(issuesFrom(result.issues));
// 422 with {"errors":[{"pointer":"/user/email","code":"invalid","message":"..."}], ...}
```

## API

### `problem(options, init?)`

Returns a `Response` whose status line and body `status` both come from `options.status`,
with `Content-Type: application/problem+json`. `init` adds headers.

### `stringify(options)`

The document's JSON text, for writing a problem somewhere other than a `Response`.

### `defineProblems(base, entries)`

A catalog: one builder per entry, plus `parse(response)`, `is(problem, name)` and
`entries()`, which lists every entry with its resolved `type` for rendering an error
reference, plus the `extensions` schema of an entry declared with one, for documenting its
members. Entries cannot be named `parse`, `is` or `entries`.

### `isProblem(message)`

Whether a `Request` or `Response` declares `application/problem+json`, ignoring parameters
and case. The body is left unread.

### `parseProblem(response, options?)`

Reads a problem `Response` into a `Result<Problem, ProblemParseError>`. Absent members take
their RFC defaults, and the status line wins over the body's `status`. Pass
`options.extensions`, a synchronous Standard Schema, to validate and type the extensions.

### `parse(text, options?)`

The same, from JSON text; `options.status` stands in for the status line.

### `validationProblem(issues, options?)`

A `422` problem whose `errors` extension lists each invalid field. `options` sets any
standard member, including a different `status`.

### `issuesFrom(source, code?)`

Converts Standard Schema issues, or an error carrying them in `issues`, into `errors`
entries, turning each path into a JSON Pointer. Every entry gets `code`, `"invalid"` by
default.

### `toPointer(path)`

Formats an issue path as an RFC 6901 JSON Pointer, escaping `~` and `/`.

### `ISSUES_SCHEMA`

The schema for the `errors` extension, for `s.object({ errors: ISSUES_SCHEMA })`. It also
implements [Standard JSON Schema](https://standardschema.dev/), so a tool that documents a
catalog can describe the extension.

### `ProblemParseError`

Why a document is not a problem. `issues` holds the extension schema's issues when that is
the reason.

### `PROBLEM_MEDIA_TYPE`, `ABOUT_BLANK`

`"application/problem+json"` and `"about:blank"`.

### Types

`Problem<Extensions>` is a parsed document, with `detail` and `instance` as `string | null`
and extension members under `extensions`. `ProblemOptions<Extensions>` is what a writer
passes, and `ProblemIssue` is one `errors` entry.

## Pattern: Share A Catalog Between A Server And Its Client

```typescript
// api-problems.ts, imported by both
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

let result = s.parseSafe(schema, body);
if (!result.success) {
	return apiProblems.validationFailed({ extensions: { errors: issuesFrom(result.issues) } });
}
```

```typescript
// client
import { isSuccess } from "@sdxc/result";

let response = await fetch(url, { method: "POST", body });
if (!response.ok) {
	let result = await apiProblems.parse(response);
	if (isSuccess(result) && apiProblems.is(result.data, "validationFailed")) {
		for (let issue of result.data.extensions.errors) showError(issue.pointer, issue.message);
	}
}
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
