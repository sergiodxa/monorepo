# @sdxc/micropub

Read Micropub requests into typed operations and build the spec's responses.

[Micropub](https://www.w3.org/TR/micropub/) is the W3C Recommendation for publishing to a site
from any client. This package decodes a POST (form-encoded, multipart or JSON) into one of four
typed operations and a GET into a typed query, finds the access token wherever it was sent,
names the scopes each operation needs, and builds every response the specification defines.
Both encodings of the same post yield the same operation. Verifying the token, storing posts and
storing files stay with you.

## Installation

```sh
npm add @sdxc/micropub
```

Parsers answer a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), and
post properties take the `MF2` shape of
[`@sdxc/microformats`](https://www.npmjs.com/package/@sdxc/microformats).

## Usage

### Parse a write

`parseOperation` reads a POST into a `create`, `update`, `delete` or `undelete`. Every parse
failure is an `invalid_request` whose message fits `error_description`.

```typescript
import { created, error, parseOperation } from "@sdxc/micropub";
import { isFailure } from "@sdxc/result";

export async function handlePost(request: Request) {
	let parsed = await parseOperation(request);
	if (isFailure(parsed)) return error("invalid_request", parsed.error.message);

	let operation = parsed.data.body;
	if (operation.action !== "create") return error("invalid_request", "Only creates for now");

	let url = await savePost(operation.type, operation.properties);
	return created(url); // 201, Location: <url>
}
```

### Check the token and its scopes

`accessToken` comes from `Authorization: Bearer` or the form's `access_token`, and is `null`
when the client sent none. `requiredScopes` lists the scopes any one of which authorizes the
operation.

```typescript
import { error, parseOperation, requiredScopes } from "@sdxc/micropub";
import { isFailure } from "@sdxc/result";

let parsed = await parseOperation(request);
if (isFailure(parsed)) return error("invalid_request", parsed.error.message);

let { body: operation, accessToken } = parsed.data;
if (accessToken === null) return error("unauthorized");

let granted = await verifyToken(accessToken); // your token endpoint or store
if (granted === null) return error("forbidden", "Unknown token");

let scopes = requiredScopes(operation);
if (!scopes.some((scope) => granted.includes(scope))) {
	return error("insufficient_scope", "The token cannot do this", { scope: scopes });
}
```

### Answer a query

`parseQuery` reads a GET into a query discriminated on `q`; each answer has its own builder.

```typescript
import { config, error, parseQuery, source, syndicateTo } from "@sdxc/micropub";
import { isFailure } from "@sdxc/result";

export async function handleGet(request: Request) {
	let parsed = parseQuery(request);
	if (isFailure(parsed)) return error("invalid_request", parsed.error.message);

	let query = parsed.data.body;
	switch (query.q) {
		case "config":
			return config({ mediaEndpoint: "https://example.com/micropub/media", q: ["source"] });
		case "syndicate-to":
			return syndicateTo([]);
		case "source": {
			let item = await loadPost(query.url);
			return item ? source(item, query.properties) : error("invalid_request", "No such post");
		}
		default:
			return error("invalid_request", "Unsupported query");
	}
}
```

### Accept an upload

The `./media` entry point reads the one `file` part a media endpoint upload carries.

```typescript
import { error } from "@sdxc/micropub";
import { parseUpload, uploaded } from "@sdxc/micropub/media";
import { isFailure } from "@sdxc/result";

export async function handleUpload(request: Request) {
	let upload = parseUpload(request, { formData: await request.formData(), accept: ["image/*"] });
	if (isFailure(upload)) return error("invalid_request", upload.error.message);

	let url = await storeFile(upload.data.body);
	return uploaded(url); // 201, Location: <url>
}
```

## API

### `parseOperation(request: Request, options?: Micropub.ParseOptions): Promise<Result<Micropub.Parsed<Micropub.Operation>, MicropubRequestError>>`

Decodes a POST by its `Content-Type`: `application/json` (or any `+json` type),
`application/x-www-form-urlencoded` or `multipart/form-data`. Forms are reshaped into the JSON
shape first: `h=entry` becomes `type: ["h-entry"]` (the default when `h` is missing), `name[]`
and `name` collect into one array, and file parts go to `files`. Values are validated as
microformats2, so `{ html }` content gains its text as `value` and JSON numbers are read as
text. `mp-slug`, `mp-syndicate-to` and `post-status` become `commands`; other `mp-*` names land
in `commands.other`.

Updates are JSON only. An update's `delete` as a list fills `deleteProperties`, as a map
`deleteValues`. A token sent both in the header and the form is `invalid_request`.

- `options.formData`: the form body, when middleware already read the request stream
- `options.maxJsonBytes`: the JSON body cap, enforced while streaming (default `1_048_576`)

### `parseQuery(request: Request): Result<Micropub.Parsed<Micropub.Query>, MicropubRequestError>`

Decodes a GET into `config`, `syndicate-to`, `source` (an absolute `url` plus the requested
`properties[]`, empty for the whole post), `category` (with an optional `filter`) or
`extension` (any other `q`, with its `name` and every `params`). The token comes from the header.

### `requiredScopes(operation: Micropub.Operation): Micropub.Scope[]`

The scopes any one of which authorizes the operation: `create` (or `draft` for a create with
`post-status: draft`), `update`, `delete`, and `undelete` or `delete`.

### Responses

| Builder                               | Response                                                        |
| ------------------------------------- | --------------------------------------------------------------- |
| `created(location)`                   | `201` with `Location`                                           |
| `accepted(location)`                  | `202` with `Location`, for a create processed asynchronously    |
| `updated(location?)`                  | `204`, or `201` with `Location` when the update moved the post  |
| `deleted(location?)`                  | `204`, or `201` with `Location` when an undelete moved the post |
| `error(code, description?, details?)` | JSON `{ error, error_description?, scope? }`                    |
| `config(config)`                      | The `q=config` answer with wire names (`media-endpoint`, …)     |
| `syndicateTo(targets)`                | `{ "syndicate-to": [...] }`                                     |
| `source(item, properties?)`           | The item, or `{ properties }` with only the requested names     |
| `categories(names)`                   | `{ categories: [...] }`, the `q=category` answer                |

`error` answers `invalid_request` 400, `unauthorized` 401, `forbidden` 403 and
`insufficient_scope` 401. `unauthorized` and `insufficient_scope` carry a
`WWW-Authenticate: Bearer` challenge, the latter with its description and `details.scope`.

### `MicropubRequestError`

The failure every parser answers. `message` suits `error_description`; `issues` holds the
data-schema issues behind it, empty when the request failed outside the body's shape.

### `parseUpload(request: Request, options: Media.Options): Result<Micropub.Parsed<File>, MicropubRequestError>` from `./media`

The single part named `file`, with the token from the header or the form. A missing, textual or
repeated `file`, a file over `maxBytes` and a type outside `accept` are `invalid_request`.

- `options.formData`: the multipart body, already read
- `options.accept`: media types matched on the essence, with `image/*` and `*/*` wildcards; an
  untyped file matches only `*/*`
- `options.maxBytes`: the size cap (default `26_214_400`)

### `uploaded(location: string | URL): Response` from `./media`

`201` with the file's URL in `Location`.

### Types

The `Micropub` namespace holds every type. `Operation` is `Create | Update | Delete | Undelete`,
discriminated on `action`; `Create` carries `type`, `properties`, `commands` (`Commands`) and
`files`, and `Update` carries `url`, `replace`, `add`, `deleteProperties` and `deleteValues`.
`Query` is `ConfigQuery | SyndicateToQuery | SourceQuery | CategoryQuery | ExtensionQuery`,
discriminated on `q`. `Parsed<Body>` pairs a body with its `accessToken`. `Properties`, `Scope`,
`Config`, `SyndicationTarget`, `SyndicationDetail`, `PostType`, `ErrorCode`, `ErrorDetails` and
`ParseOptions` complete it. `Media.Options` from `./media` types `parseUpload`'s options.

## Pattern: One Endpoint For Every Write

Each operation maps onto its own response; `accepted` answers a create stored after responding.

```typescript
import type { Micropub } from "@sdxc/micropub";

import { accepted, created, deleted, updated } from "@sdxc/micropub";

export async function applyOperation(operation: Micropub.Operation, queue: boolean) {
	switch (operation.action) {
		case "create": {
			let url = urlFor(operation.commands.slug ?? Date.now().toString(36));
			if (queue) {
				await enqueueCreate(url, operation);
				return accepted(url); // 202
			}
			await savePost(url, operation);
			return created(url); // 201
		}
		case "update": {
			let movedTo = await updatePost(operation);
			return updated(movedTo ?? undefined); // 204, or 201 when the URL changed
		}
		case "delete":
		case "undelete":
			await setDeleted(operation.url, operation.action === "delete");
			return deleted(); // 204
	}
}
```

## Pattern: Apply An Update To A Stored Item

An `Update` names four change sets; applied in order to an `MF2.Item`, they give the post's new
properties. A property left with no values is removed.

```typescript
import type { MF2 } from "@sdxc/microformats";
import type { Micropub } from "@sdxc/micropub";

export function applyUpdate(item: MF2.Item, update: Micropub.Update): MF2.Item {
	let properties = { ...item.properties, ...update.replace };
	for (let [name, values] of Object.entries(update.add)) {
		properties[name] = [...(properties[name] ?? []), ...values];
	}
	for (let name of update.deleteProperties) delete properties[name];
	for (let [name, values] of Object.entries(update.deleteValues)) {
		let removed = new Set(values.map((value) => JSON.stringify(value)));
		let kept = (properties[name] ?? []).filter((value) => !removed.has(JSON.stringify(value)));
		if (kept.length > 0) properties[name] = kept;
		else delete properties[name];
	}
	return { ...item, properties };
}
```

## Pattern: Files, URLs And Commands On A Create

A multipart create puts uploaded files in `files` and URLs in `properties`, so a photo sent
either way reaches the post. `commands` holds the slug, the syndication targets and the draft
status, none of which stays in `properties`.

```typescript
import type { Micropub } from "@sdxc/micropub";

export async function prepareCreate(operation: Micropub.Create) {
	let uploaded = await Promise.all((operation.files.photo ?? []).map((file) => storeFile(file)));
	let photos = [...(operation.properties.photo ?? []), ...uploaded];

	return {
		properties: { ...operation.properties, photo: photos },
		slug: operation.commands.slug,
		draft: operation.commands.status === "draft",
		syndicateTo: operation.commands.syndicateTo, // uids from q=syndicate-to
	};
}
```

## Pattern: Forms Already Read By Middleware

When a framework has consumed the request stream, pass the `FormData` it read. A JSON body is
read from the request either way, capped at `maxJsonBytes`.

```typescript
import { error, parseOperation } from "@sdxc/micropub";
import { isFailure } from "@sdxc/result";

export async function handle(request: Request, formData: FormData | undefined) {
	let parsed = await parseOperation(request, { formData, maxJsonBytes: 256 * 1024 });
	if (isFailure(parsed)) return error("invalid_request", parsed.error.message);
	return applyOperation(parsed.data.body, false);
}
```

## Pattern: Advertise What The Server Supports

`config` lists the media endpoint, the syndication targets, the post types and the queries the
server answers; clients treat a query missing from `q` as unsupported. `categories` answers the
`q=category` extension, and any other `q` arrives as an `extension` query.

```typescript
import type { Micropub } from "@sdxc/micropub";

import { categories, config, error, syndicateTo } from "@sdxc/micropub";

let TARGETS: Micropub.SyndicationTarget[] = [
	{
		uid: "mastodon",
		name: "Mastodon",
		service: { name: "Mastodon", url: "https://joinmastodon.org" },
	},
];

export async function answerQuery(query: Micropub.Query) {
	switch (query.q) {
		case "config":
			return config({
				mediaEndpoint: "https://example.com/micropub/media",
				syndicateTo: TARGETS,
				q: ["source", "syndicate-to", "category"],
				postTypes: [
					{ type: "note", name: "Note" },
					{ type: "photo", name: "Photo" },
				],
			});
		case "syndicate-to":
			return syndicateTo(TARGETS);
		case "category": {
			let prefix = query.filter ?? "";
			let tags = await listTags();
			return categories(tags.filter((tag) => tag.startsWith(prefix)));
		}
		case "extension":
			return error("invalid_request", `Unsupported query ${query.name}`);
		default:
			return error("invalid_request", "Unsupported query");
	}
}
```

## Pattern: Read A Post Back For Editing

`source` answers with an `MF2.Item`, the same shape a JSON create sends, so an editor's round
trip keeps HTML content as `{ html, value }` and alt text as `{ value, alt }`. Requested
`properties` narrow the answer to those names.

```typescript
import type { MF2 } from "@sdxc/microformats";
import type { Micropub } from "@sdxc/micropub";

import { error, source } from "@sdxc/micropub";

export async function answerSource(query: Micropub.SourceQuery) {
	let post = await loadStoredPost(query.url);
	if (post === null) return error("invalid_request", "No such post");

	let item: MF2.Item = {
		type: ["h-entry"],
		properties: {
			content: [{ html: post.html, value: post.text }],
			photo: post.photos.map((photo) => ({ value: photo.url, alt: photo.alt })),
		},
	};
	return source(item, query.properties); // whole item, or { properties } with the requested names
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
		"@sdxc/micropub": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
