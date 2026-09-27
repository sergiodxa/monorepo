# @sdxc/micropub

Read Micropub requests into typed operations and build the spec's responses.

## Installation

```bash
npm add @sdxc/micropub
```

Parsers return [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) values; it installs
alongside this package, as does [`@sdxc/microformats`](https://www.npmjs.com/package/@sdxc/microformats),
whose `MF2` item shape every create and `q=source` answer takes.

[Micropub](https://www.w3.org/TR/micropub/) is the W3C Recommendation for publishing to a site
from a client the site's owner did not write. Clients POST creates, updates, deletes and
undeletes, form-encoded, multipart (with files) or as JSON in the microformats2 shape, and GET
queries (`q=config`, `q=source`, `q=syndicate-to`) to learn what the server supports and to read
a post back for editing.

- **`@sdxc/micropub`** decodes a POST into one of four typed operations and a GET into a typed
  query, returns the access token from whichever place it was sent, names the scopes each
  operation needs, and builds every response the specification defines. Form bodies are
  reshaped into the JSON shape first (`h` into `type`, `name[]` into arrays, `mp-*` into
  commands), and property values are validated as microformats2, so both encodings yield the
  same operation for the same post.
- **`@sdxc/micropub/media`** reads the single `file` part a media endpoint upload carries,
  checked for size and media type, and answers it.

Verifying the token, mapping operations onto posts and storing files stay with you. Every
example of the Recommendation and every server test of [micropub.rocks](https://micropub.rocks/)
is replayed in the test suite.

## Usage

### Handle A Write

Check the token before looking at the operation's contents, and answer `unauthorized` when
`accessToken` is `null`; the parser leaves the decision of who may write to you.

```typescript
import { created, deleted, error, parseOperation, requiredScopes, updated } from "@sdxc/micropub";
import { isFailure } from "@sdxc/result";

let parsed = await parseOperation(request);
if (isFailure(parsed)) return error("invalid_request", parsed.error.message);

let { body: operation, accessToken } = parsed.data;
if (accessToken === null) return error("unauthorized");
let token = await verify(accessToken);
if (!requiredScopes(operation).some((scope) => token.has(scope))) {
	return error("insufficient_scope", undefined, { scope: requiredScopes(operation) });
}

switch (operation.action) {
	case "create":
		return created(await posts.create(operation)); // 201, Location: <url>
	case "update":
		await posts.update(operation);
		return updated(); // 204
	case "delete":
	case "undelete":
		await posts[operation.action](operation.url);
		return deleted(); // 204
}
```

### Answer A Query

```typescript
import { config, error, parseQuery, source, syndicateTo } from "@sdxc/micropub";
import { isFailure } from "@sdxc/result";

let parsed = parseQuery(request);
if (isFailure(parsed)) return error("invalid_request", parsed.error.message);

let query = parsed.data.body;
switch (query.q) {
	case "config":
		return config({ mediaEndpoint: "https://example.com/micropub/media", q: ["source"] });
	case "syndicate-to":
		return syndicateTo([]); // {"syndicate-to":[]}
	case "source": {
		let item = await posts.toItem(query.url);
		return item ? source(item, query.properties) : error("invalid_request", "No such post");
	}
	default:
		return error("invalid_request", "Unsupported query");
}
```

### Accept An Upload

```typescript
import { error } from "@sdxc/micropub";
import { parseUpload, uploaded } from "@sdxc/micropub/media";
import { isFailure } from "@sdxc/result";

let upload = parseUpload(request, { formData: await request.formData(), accept: ["image/*"] });
if (isFailure(upload)) return error("invalid_request", upload.error.message);

let url = await storage.put(upload.data.body);
return uploaded(url); // 201, Location: <url>
```

## API

### `@sdxc/micropub`

#### `parseOperation(request: Request, options?: Micropub.ParseOptions): Promise<Result<Micropub.Parsed<Micropub.Operation>, MicropubRequestError>>`

Decodes a POST by its `Content-Type`: `application/json` (or any `+json` type),
`application/x-www-form-urlencoded` or `multipart/form-data`.

- A form with `action=delete` or `action=undelete` and a `url` is a `Delete` or `Undelete`;
  any other form is a `Create`. `h=entry` becomes `type: ["h-entry"]`, and a missing `h`
  defaults to `h-entry`. `category[]` and `category` collect into one array. File parts go
  to `files` by property name, `photo[]` included; an empty file input is dropped.
- A JSON body with `action: "update"` is an `Update`, `delete`/`undelete` a `Delete` or
  `Undelete`, and a body without `action` a `Create` validated with `ITEM_SCHEMA`: `{ html }`
  content gains its text as `value`, and a nested item without `value` takes its first
  `name` or `url`. Numbers and booleans inside property arrays are read as their text,
  since clients send coordinates as JSON numbers.
- `mp-slug`, `mp-syndicate-to` and `post-status` become `commands.slug`,
  `commands.syndicateTo` and `commands.status`; every other `mp-*` name lands in
  `commands.other` with its values as sent. None of them stays in `properties`.
- An update's `delete` as a list fills `deleteProperties`; as a map it fills `deleteValues`.
- The token comes from `Authorization: Bearer` (scheme matched case-insensitively) or a
  form's `access_token`, which is never kept as a property. JSON bodies carry no token.

These are `invalid_request` failures, each with a message fit for `error_description` and
the data-schema `issues` behind it: an unsupported media type, text that is not JSON, a
JSON body that is not an object or is over `maxJsonBytes`, an update over a form body, an
update naming no change, an unknown `action`, a `url` that is not an absolute URL, a
`post-status` other than `published` or `draft`, and a token sent both in the header and in
the body (RFC 6750 forbids it).

**Options:**

- `formData`: the form body when your framework already read it (the request stream is
  consumed by then); without it the parser reads form bodies itself
- `maxJsonBytes`: the JSON body cap, enforced while streaming (default `1_048_576`)

#### `parseQuery(request: Request): Result<Micropub.Parsed<Micropub.Query>, MicropubRequestError>`

Decodes a GET into a query discriminated on `q`: `{ q: "config" }`, `{ q: "syndicate-to" }`,
`{ q: "source", url, properties }` (from `properties[]` or `properties`; empty asks for the
whole post), `{ q: "category", filter }` (the widely implemented extension), and
`{ q: "extension", name, params }` for any other `q`. A missing `q`, and a `source` query
without an absolute `url`, are `invalid_request`. The token comes from the header.

#### `requiredScopes(operation: Micropub.Operation): Micropub.Scope[]`

The scopes any one of which authorizes the operation: `create`, or `draft`/`create` for a
create with `post-status: draft`; `update`; `delete`; `undelete`/`delete`.

```typescript
requiredScopes(operation).some((scope) => token.has(scope));
```

#### Responses

| Builder                               | Response                                                          |
| ------------------------------------- | ----------------------------------------------------------------- |
| `created(location)`                   | `201 Created` with `Location`                                     |
| `accepted(location)`                  | `202 Accepted` with `Location`, for asynchronous creates          |
| `updated(location?)`                  | `204`, or `201` with `Location` when the update moved the post    |
| `deleted(location?)`                  | `204`, or `201` with `Location` when an undelete moved the post   |
| `error(code, description?, details?)` | JSON `{ error, error_description?, scope? }` with the code status |
| `config(config)`                      | `q=config` with wire names; `{}` when nothing is set              |
| `syndicateTo(targets)`                | `{ "syndicate-to": [...] }`                                       |
| `source(item, properties?)`           | the item, or `{ properties }` with only the requested names       |
| `categories(names)`                   | `{ categories: [...] }`, the `q=category` extension answer        |

Error statuses follow the Micropub specification: `invalid_request` 400, `unauthorized`
401, `forbidden` 403, `insufficient_scope` 401. `unauthorized` carries
`WWW-Authenticate: Bearer`; `insufficient_scope` carries
`WWW-Authenticate: Bearer error="insufficient_scope", …` with its description and
`details.scope`.

```typescript
error("insufficient_scope", "Token lacks create", { scope: ["create"] });
// 401, WWW-Authenticate: Bearer error="insufficient_scope", error_description="Token lacks create", scope="create"
// {"error":"insufficient_scope","error_description":"Token lacks create","scope":"create"}
```

#### `MicropubRequestError`

The failure of every parser. `message` suits `error_description`; `issues` holds the
data-schema issues, empty for failures outside the body's shape.

#### `Micropub` namespace

`Operation` (`Create | Update | Delete | Undelete`), `Commands`, `Properties`, `Query` and
its members, `Parsed<Body>`, `Scope`, `Config`, `SyndicationTarget`, `SyndicationDetail`,
`PostType`, `ErrorCode`, `ErrorDetails` and `ParseOptions`. Every type is exported from the
namespace, including each query member (`ConfigQuery`, `SyndicateToQuery`, `SourceQuery`,
`CategoryQuery`, `ExtensionQuery`) and each operation (`Create`, `Update`, `Delete`,
`Undelete`).

### `@sdxc/micropub/media`

#### `parseUpload(request: Request, options: Media.Options): Result<Micropub.Parsed<File>, MicropubRequestError>`

Returns the one part named `file`, and the token from the header or the form's
`access_token`. A missing, textual or repeated `file` part, a file over `maxBytes`
(default `26_214_400`) and a media type outside `accept` are `invalid_request`. `accept`
matches on the essence, case-insensitively, with `image/*` and `*/*` wildcards; an untyped
file matches only `*/*`.

#### `uploaded(location: string | URL): Response`

`201 Created` with the file's URL in `Location`.

#### `Media`

Types only: `Options` (`formData`, `maxBytes`, `accept`).

## Pattern: Keep Files And URLs Together

A multipart create puts uploaded files in `files` and URLs in `properties`, so a photo sent
either way reaches the post. Ignore properties your content model does not know: the
specification has servers create the post from the properties they recognize.

```typescript
import type { Micropub } from "@sdxc/micropub";

async function photosOf(operation: Micropub.Create) {
	let uploaded = await Promise.all((operation.files.photo ?? []).map((file) => storage.put(file)));
	return [...(operation.properties.photo ?? []), ...uploaded];
}
```

## Pattern: Read A Post Back In The Shape A Create Sends

`source` writes an `MF2.Item`, the same shape `parseOperation` produces for a JSON create, so a
round trip through a client's editor keeps HTML content as `{ html }` and alt text as
`{ value, alt }`. Advertise only the queries you answer in `config({ q })`; clients treat a
missing query as unsupported.

```typescript
import type { MF2 } from "@sdxc/microformats";
import { source } from "@sdxc/micropub";

let item: MF2.Item = { type: ["h-entry"], properties: { content: [{ html, value: text }] } };
return source(item, query.properties);
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
