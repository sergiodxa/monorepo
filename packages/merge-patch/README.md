# @sdxc/merge-patch

Apply, diff and read RFC 7396 JSON Merge Patch documents.

A [JSON merge patch](https://www.rfc-editor.org/rfc/rfc7396) is a partial update in the shape of
the resource: it lists only the members that change, a nested object merges into the member it
lands on, `null` removes a member, and arrays and scalars replace what was there. The root entry
point works on plain JSON values, so clients and servers share it; `@sdxc/merge-patch/request`
reads a patch off a standard `Request`.

## Installation

```sh
npm add @sdxc/merge-patch
```

Fallible calls return [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) values, and
the `./request` entry point answers refusals with
[`@sdxc/problem`](https://www.npmjs.com/package/@sdxc/problem) responses.

## Usage

### Apply a patch

```typescript
import { apply } from "@sdxc/merge-patch";

apply(
	{ title: "Goodbye!", tags: ["a", "b"], draft: true },
	{ title: "Hello!", tags: ["a"], draft: null },
);
// { title: "Hello!", tags: ["a"] }
```

### Compute a patch

```typescript
import { diff } from "@sdxc/merge-patch";
import { unwrap } from "@sdxc/result";

unwrap(diff({ name: "Home", interval: 60, note: "x" }, { name: "Home", interval: 30 }));
// { interval: 30, note: null }
```

`diff` fails when the target holds `null` as an object member, because a merge patch reads `null`
as removal.

### Parse and write patch text

```typescript
import { parse, stringify } from "@sdxc/merge-patch";
import { isFailure } from "@sdxc/result";

let patch = parse('{"title":"Hello!"}');
if (isFailure(patch)) console.error(patch.error.message); // not JSON

stringify({ title: null }); // '{"title":null}'
```

### Read a PATCH request

```typescript
import { mergePatchProblem, readMergePatch } from "@sdxc/merge-patch/request";
import { isFailure } from "@sdxc/result";

let patch = await readMergePatch(request);
if (isFailure(patch)) return mergePatchProblem(patch.error); // 415 or 400
```

## API

### `@sdxc/merge-patch`

#### `apply(target: JSONValue, patch: JSONValue): JSONValue`

Applies `patch` to `target` per RFC 7396 and returns a new value that shares no object or array
with either input. A non-object patch replaces the target, and an object patch applied to a
non-object merges into `{}`.

#### `diff(source: JSONValue, target: JSONValue): Result<JSONValue, UnrepresentableChangeError>`

The smallest patch for which `apply(source, patch)` equals `target`: removed members become
`null`, changed arrays are sent whole, `{}` means two objects are equal, and a non-object target
is its own patch.

#### `applyValidated(target, patch, schema): Result<Output, MergePatchValidationError>`

Applies the patch and validates the result with a synchronous Standard Schema, such as one from
`remix/data-schema`, so the create schema also judges updates. Issue paths point into the patched
result.

#### `parse(text: string): Result<JSONValue, MergePatchParseError>`

Reads a merge patch document; any JSON value is a valid patch, so it fails only on text that is
not JSON.

#### `stringify(patch: JSONValue): string`

Writes a patch as the JSON text a request body carries.

#### `MEDIA_TYPE`

`"application/merge-patch+json"`.

#### `UnrepresentableChangeError`

The `diff` failure, with `pointer`: an RFC 6901 JSON Pointer to the member that holds `null` in
the target.

#### `MergePatchValidationError`

The `applyValidated` failure, with the schema's `issues`; `issuesFrom` from `@sdxc/problem` reads
it directly.

#### `MergePatchParseError`

The `parse` failure, with the JSON parser's message.

### `@sdxc/merge-patch/request`

#### `readMergePatch(request: Request, options?: ReadMergePatchOptions): Promise<Result<JSONValue, MergePatchRequestError>>`

Checks the `Content-Type` first, leaving a refused request's body unread, then reads and parses
the body. `options.alsoAccept` lists further media types read the same way.

#### `isMergePatch(request: Request): boolean`

Whether the `Content-Type` is `application/merge-patch+json`, case-insensitively and ignoring
parameters.

#### `mergePatchProblem(error: MergePatchRequestError): Response`

The `application/problem+json` response for a refusal, with the error's status and message, and
`Accept-Patch` on a `415`.

#### `MergePatchRequestError`

Carries `reason` (`"unsupported-media-type"` or `"invalid-json"`) and the `status` to answer with
(`415` or `400`).

#### `ACCEPT_PATCH_HEADER`

`["Accept-Patch", "application/merge-patch+json"]`, a header tuple for `Headers` or a
`ResponseInit`.

### Types

#### `MergePatchOf<T>`

A valid patch for a resource `T`: every member optional, `null` only where the member itself is
optional, objects recursively patchable, arrays and scalars replaced whole.

#### `JSONValue` / `JSONObject`

The JSON values every function reads and writes.

#### `ReadMergePatchOptions`

`{ alsoAccept?: readonly string[] }`, the options of `readMergePatch`.

## Pattern: Validate A PATCH With The Create Schema

The handler applies the patch to the stored resource, validates the result with the schema the
create endpoint uses, and writes only the members that changed.

```typescript
import { applyValidated, diff } from "@sdxc/merge-patch";
import { mergePatchProblem, readMergePatch } from "@sdxc/merge-patch/request";
import { issuesFrom, validationProblem } from "@sdxc/problem";
import { isFailure, unwrap } from "@sdxc/result";
import * as s from "remix/data-schema";
import { minLength } from "remix/data-schema/checks";

let articleSchema = s.object({
	title: s.string().pipe(minLength(1)),
	summary: s.optional(s.string()),
	tags: s.array(s.string()),
});

async function updateArticle(request: Request, id: string) {
	let patch = await readMergePatch(request);
	if (isFailure(patch)) return mergePatchProblem(patch.error);

	let current = await articles.find(id);
	let next = applyValidated(current, patch.data, articleSchema);
	if (isFailure(next)) return validationProblem(issuesFrom(next.error)); // 422, pointers into the article

	await articles.update(id, unwrap(diff(current, next.data)));
	return Response.json(next.data);
}
```

A patch removing `title` fails on `/title`, and a patch setting it to `""` fails there too.

## Pattern: Send Only What Changed

A client keeps the snapshot it loaded, lets the user edit a copy, and sends the difference.

```typescript
import { diff, MEDIA_TYPE, stringify } from "@sdxc/merge-patch";
import { isFailure } from "@sdxc/result";

let patch = diff(original, edited);
if (isFailure(patch)) throw new Error(`Cannot set ${patch.error.pointer} to null in a merge patch`);

await fetch(`/articles/${id}`, {
	method: "PATCH",
	headers: { "Content-Type": MEDIA_TYPE },
	body: stringify(patch.data),
});
```

## Pattern: Type The Patches A Client Builds

```typescript
import type { MergePatchOf } from "@sdxc/merge-patch";

import { MEDIA_TYPE, stringify } from "@sdxc/merge-patch";

interface Article {
	title: string;
	summary?: string;
	tags: string[];
}

function patchArticle(id: string, patch: MergePatchOf<Article>) {
	return fetch(`/articles/${id}`, {
		method: "PATCH",
		headers: { "Content-Type": MEDIA_TYPE },
		body: stringify(patch),
	});
}

await patchArticle("a1", { summary: null, tags: ["http"] }); // clears summary, replaces tags
await patchArticle("a1", { title: null }); // type error: title is required
```

## Pattern: Adopt Merge Patch On An Existing Endpoint

`alsoAccept` keeps callers that send `application/json` working, `isMergePatch` tells the two
apart, and `ACCEPT_PATCH_HEADER` advertises the format on `OPTIONS`.

```typescript
import {
	ACCEPT_PATCH_HEADER,
	isMergePatch,
	mergePatchProblem,
	readMergePatch,
} from "@sdxc/merge-patch/request";
import { isFailure } from "@sdxc/result";

async function handle(request: Request) {
	if (request.method === "OPTIONS") {
		return new Response(null, {
			status: 204,
			headers: [ACCEPT_PATCH_HEADER, ["Allow", "GET, PATCH"]],
		});
	}

	let patch = await readMergePatch(request, { alsoAccept: ["application/json"] });
	if (isFailure(patch)) return mergePatchProblem(patch.error);

	let response = await applyPatch(patch.data);
	if (!isMergePatch(request)) response.headers.set("Deprecation", "true");
	return response;
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
		"@sdxc/merge-patch": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
