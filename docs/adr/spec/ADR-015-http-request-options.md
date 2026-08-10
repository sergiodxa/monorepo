# ADR-015: HTTP Request Options — Headers and Non-JSON Bodies

## Status

**Proposed** - 2026-08-09

This ADR records how the built-in `http` capability lets a spec set request
**headers** and send **form-urlencoded**, **text**, and **JSON** bodies, on top
of the URL-and-optional-body shape v1 shipped. Like
[ADR-009](./ADR-009-v1-typescript-implementation.md),
[ADR-011](./ADR-011-project-and-third-party-plugins.md) through
[ADR-014](./ADR-014-compiled-binary-and-concurrency.md), it is an implementation
ADR: not standalone, free to reference this monorepo's packages and conventions,
and bound by the design suite
([ADR-001](./ADR-001-executable-specification-language.md) through
[ADR-008](./ADR-008-environments-and-compatibility.md)) rather than amending it.
Its parent is [ADR-009](./ADR-009-v1-typescript-implementation.md), the v1
implementation plan, whose §C5 specified the original `http` plugin. The choice
recorded here is **v1-provisional**: binding on this implementation, invisible to
the design record, cheap to revisit.

## Context

[ADR-009 §C5](./ADR-009-v1-typescript-implementation.md) shipped the `http`
plugin with exactly two positional arguments per verb: an absolute URL and an
optional body, where a string body traveled as `text/plain` and any other value
as `application/json`. That is enough to `GET` a page or `POST` a JSON document,
but it cannot express three things real HTTP APIs demand constantly:

- **Request headers.** An `Authorization: Bearer …` or `Authorization: Basic …`
  header, a custom `Accept`, an idempotency key, a cookie. Without headers a spec
  cannot reach any authenticated endpoint.
- **Form-urlencoded bodies.** The OAuth 2 token, introspection, and revocation
  endpoints — and countless classic form posts — require
  `application/x-www-form-urlencoded`, not JSON.
- **An explicit content type.** Sending a JSON document under a vendor media type
  (`application/vnd.api+json`), or plain text under a non-default type.

Concretely, the `r3-auth` acceptance suite could not specify a proper OAuth error
envelope, because it had no way to send a form body to `/oauth/token` with a
`Basic` credential header. The capability gap, not the language, was the blocker.

The design constraint is that whatever we add must not break the two forms
already in use across the dogfood suite and the `r3-*` app specs: `http.get url`
and `http.<verb> url <body>`. And it must not introduce a second permission
surface — reaching a host is already the privileged act, gated by `net`.

## Decision

### Word-tagged trailing options

A request call keeps `url` as its first argument and gains **optional
word-tagged options** that may follow in any order, on any verb. A tag is a bare
identifier (a `word` in the grammar, [ADR-002](./ADR-002-specification-language-design.md))
that consumes the single argument after it:

```
http.post "https://id.example.com/oauth/token" form {
	grant_type: "authorization_code"
	code: "abc123"
	redirect_uri: "https://app.example.com/callback"
} headers { authorization: "Basic dXNlcjpwYXNz" }
```

The four tags:

- `headers { Name: "value", … }` — request headers, an object of string→string.
  Values may be bindings or dotted references (the executor has already evaluated
  them to values); a number or boolean coerces to its string form, and an
  object/array/null value is a tool error naming the field. Header names are
  case-insensitive, and an explicit `content-type` here **overrides** the body's
  default content type.
- `form { field: "value", … }` — a body encoded with `URLSearchParams` as
  `application/x-www-form-urlencoded`, same value coercion as `headers`.
- `json <value>` — a body serialized as `application/json`. Accepts any value
  (object, array, or scalar); it is the explicit spelling of the bare-object
  back-compat form.
- `text "<string>"` — a body sent as `text/plain`; the explicit spelling of the
  bare-string back-compat form. A non-string value is a tool error.

**No parser change was needed.** `http.post url form { … } headers { … }` already
tokenizes as a call with a string, a word, an object, a word, and an object —
words in argument position are a v1 grammar primitive
([ADR-002](./ADR-002-specification-language-design.md)), the same mechanism
behind `expect file "x" exists` and `fill textbox "Email" with "y"`. The plugin
interprets the words; the language did not move.

### Back-compatibility is total

The two shipped forms are unchanged and are simply the untagged path through the
new parser:

- `http.get url` — no options, no body.
- `http.<verb> url <bareBody>` — a bare string is a `text` body, any other bare
  value is a `json` body. Identical bytes on the wire as before.

`json` and `text` exist so an author can be **explicit** about a body's encoding;
they are never required. A call may still omit all tags entirely.

### Combination and conflict rules

Options compose freely, but a request has **one body** and **one header set**:

- At most one body across the bare body and the `json`/`form`/`text` tags. A
  second body is a tool error naming both contributors (e.g. "a bare body and a
  `json` body").
- At most one `headers` block; a second is a tool error.
- A body on a `GET` is a tool error naming the method — `fetch` forbids a body on
  `GET`, and surfacing that as a clear usage error beats an opaque network
  failure.
- An unknown option word, or a tag with no value after it, is a tool error
  listing the accepted words.

These are all **tool errors** (the tool ran and rejected its arguments), raised
before any socket is opened, so a malformed request never reaches the network.

### Permission model is unchanged

The tools still declare `requires: "net"`; the runtime's central family gate
still denies the whole `net` family before the plugin runs when no `--allow-net`
is present; and the plugin still parses the URL and calls
`checkNet(host, port)` — including the per-hop re-check on every redirect. The
permission check is positioned as the **last guard before the fetch**, after
argument validation and body/header encoding, so no well-formed-but-unauthorized
request escapes and no malformed request wastes a permission decision. Headers
are author-provided data, not a capability, so they add **no new permission
surface**. Header values are never logged.

### Redirects carry headers on body-preserving hops

The manual-redirect logic ([ADR-009 §C5](./ADR-009-v1-typescript-implementation.md),
which follows redirects by hand so each hop re-passes the `net` check) is intact.
The built request `init` — method, body, and any author headers — carries forward
on a body-preserving redirect (307/308, and 301/302 answering a GET). On a
redirect that rewrites the method to GET (303, or 301/302 answering a non-GET),
the request is reissued as a bare GET, dropping the body **and its headers** with
it. This is the conservative reading of the fetch method-rewrite: a cross-method
redirect does not silently replay an `Authorization` header onto a new
destination. It is recorded here as the deliberate, simple choice; a future
revision could preserve non-body headers across a method rewrite if a real need
appears.

## Consequences

- A spec can now reach authenticated endpoints (`Bearer`/`Basic` headers), post
  the OAuth form endpoints (`form`), and pin a vendor content type — the concrete
  cases that motivated this ADR. The `r3-auth` suite can specify the OAuth error
  envelope it previously could not.
- Existing specs are untouched: `http.get url` and `http.<verb> url <body>` mean
  exactly what they did, and every dogfood and app spec that used them still
  passes without edit.
- The capability grew without the language growing: no new tokens, productions,
  or evaluation rules — only the `http` plugin's argument reader changed, so the
  grammar's surface area is unchanged.
- No new permission was introduced. The `net` grant remains the whole
  authorization story for HTTP, which keeps the deny-by-default model
  ([ADR-007](./ADR-007-deny-by-default-permissions.md)) intact and the operator's
  mental model small.
- Argument-shape mistakes (two bodies, a body on GET, an unknown tag, a
  non-scalar header value) now fail as precise tool errors before any network
  access, rather than as opaque fetch exceptions or silent misencoding.

## Open Questions

These are v1-provisional pressure points, not reopenings of the design suite.

- **String interpolation is still the gating gap.** The end-to-end OAuth chain —
  `authorization_code` → `/token` → `userinfo` — needs a spec to extract the
  `?code=` from a redirect URL and compose `"Bearer " + <runtime token>`. The v1
  language has no interpolation or string operators
  ([ADR-002](./ADR-002-specification-language-design.md)), and this ADR does
  **not** close that. Request options make the individual requests expressible;
  wiring one request's output into the next request's header still awaits an
  interpolation decision. That is the next capability gap, tracked separately.
- **Multipart bodies.** `multipart/form-data` (file uploads) has no tag here. It
  was left out until a spec genuinely needs it, to avoid inventing a
  file-reference syntax speculatively.
- **Repeated header names.** The `headers` object is a map, so a header cannot be
  sent twice under the same name (`Set-Cookie`-style requests). No spec has
  needed it; an array-valued form could be added later without breaking the
  object form.
- **Preserving non-body headers across a method-rewrite redirect.** The current
  choice drops all headers when a redirect rewrites to GET. Keeping non-body
  headers (dropping only `content-*`) would match browsers more closely; it was
  deferred as unneeded complexity for v1.
