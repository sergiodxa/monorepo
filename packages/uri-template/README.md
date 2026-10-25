# @sdxc/uri-template

Expand, parse and match RFC 6570 URI Templates at all four levels.

A [URI Template](https://www.rfc-editor.org/rfc/rfc6570) describes a family of URIs, such as
`/users/{id}{?fields*}`. This package expands every operator (`{var}`, `{+var}`, `{#var}`,
`{.var}`, `{/var}`, `{;var}`, `{?var}` and `{&var}`) with the `:N` prefix and `*` explode
modifiers, exposes a template's parts, and matches a URI back to the variables that produced it.
It passes the uritemplate-test suite.

## Installation

```sh
npm add @sdxc/uri-template
```

Fallible calls return [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) values.

## Usage

### Expand a template

```typescript
import { expand } from "@sdxc/uri-template";

expand("/search{?q,page}", { q: "uri templates" });
// success("/search?q=uri%20templates")

expand("{/path*}{?filters*}", { path: ["docs", "api"], filters: { state: "open" } });
// success("/docs/api?state=open")
```

### Parse once, expand many times

```typescript
import { UriTemplate } from "@sdxc/uri-template";
import { unwrap } from "@sdxc/result";

let user = unwrap(UriTemplate.parse("/users/{id}{?fields}"));

user.variableNames; // ["id", "fields"]
user.expand({ id: 42, fields: ["name", "email"] }); // success("/users/42?fields=name,email")
```

### Match a URI

```typescript
import { UriTemplate } from "@sdxc/uri-template";
import { unwrap } from "@sdxc/result";

let file = unwrap(UriTemplate.parse("file:///{+path}"));

file.match("file:///docs/a%20b.txt"); // success({ path: "docs/a b.txt" })
file.match("https://example.com"); // success(null)
```

## API

### `UriTemplate.parse(source: string): Result<UriTemplate, UriTemplateError>`

Parses a template, refusing unclosed or empty expressions, the reserved operators `=`, `,`, `!`,
`@` and `|`, invalid variable names, prefix lengths outside 1–9999, and literal characters a URI
cannot hold, such as spaces, `"`, `<` and `>`.

### `template.expand(variables: Variables): Result<string, UriTemplateError>`

The expanded URI reference. `undefined`, `null`, `[]` and `{}` are undefined and disappear along
with their operator's prefix and name; numbers and booleans are written as text. It fails only when
a `:N` prefix meets a list or object.

### `template.match(uri: string): Result<Record<string, MatchedValue> | null, UriTemplateError>`

The variables `uri` was expanded from, or `null` when the template cannot produce it:

- A value holding a raw `,` comes back as a list, and exploded `key=value` items as an object.
- Several variables in one expression take one piece each, in order.
- Named items (`{?a,b}`) match in any order, and a `{&…}` after `{?…}` reads as more of the same
  query.
- A `{+…}` or `{#…}` value keeps the percent-encoded octets of reserved characters and `%`, which
  that expansion passes through as written.

It fails for a template whose adjacent expressions have no boundary between them, such as `{a}{b}`.

### `template.parts`

The literal text (percent-encoded as expansion writes it) and expressions, in order. Each
`Expression` has its `operator`, `variables` (`{ name, prefix, explode }`) and `offset`.

### `template.variableNames`

Every variable name, once each, in order of first use.

### `template.source` / `toString()` / `toJSON()`

The template text, so a template interpolates and serializes as itself.

### `expand(template: string, variables: Variables): Result<string, UriTemplateError>`

`UriTemplate.parse` and `expand` in one call.

### `UriTemplateError`

The failure, with `offset` into the template.

### Types

#### `VariableValue`

A string, number or boolean; a list of them; an object; or `[key, value]` pairs, which keep their
order. `Variables` maps names to values.

#### `MatchedValue`

`string | string[] | Record<string, string>`.

#### `TemplatePart` / `Expression` / `VariableSpec` / `Operator`

The parsed template.

## Pattern: Route Requests By Published Templates

A server publishes resource templates and reads requests back with the same objects, so the
advertised shape and the routing cannot drift apart.

```typescript
import { UriTemplate } from "@sdxc/uri-template";
import { isFailure, unwrap } from "@sdxc/result";

let resources = [
	{ template: unwrap(UriTemplate.parse("users://{id}/profile")), read: readProfile },
	{ template: unwrap(UriTemplate.parse("file:///{+path}")), read: readFile },
];

function listTemplates() {
	return resources.map(({ template }) => ({ uriTemplate: template.source }));
}

async function read(uri: string) {
	for (let { template, read } of resources) {
		let matched = template.match(uri);
		if (isFailure(matched) || matched.data === null) continue;
		return read(matched.data);
	}
	return null;
}
```

## Pattern: Follow A Templated Link

APIs that publish templated links (HAL, JSON:API, a health check's `affectedEndpoints`, a JMAP
session's `downloadUrl`) expand them with the values the client has.

```typescript
import { expand } from "@sdxc/uri-template";
import { unwrap } from "@sdxc/result";

let session = await (await fetch("https://mail.example.com/.well-known/jmap")).json();
let url = unwrap(
	expand(session.downloadUrl, {
		accountId: "a1",
		blobId: "b7",
		name: "report.pdf",
		type: "application/pdf",
	}),
);
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
		"@sdxc/uri-template": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
