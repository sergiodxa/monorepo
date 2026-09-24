# ADR-095: Micropub Package

## Status

**Proposed** - 2026-09-23

## Background

[Micropub](https://www.w3.org/TR/micropub/) is a W3C Recommendation for publishing to a
website from a client the site's owner did not write: a phone app posting a note, an editor
publishing an article, a feed reader sending a like. The client finds the site's Micropub
endpoint from its home page, obtains an access token through
[IndieAuth](https://indieauth.spec.indieweb.org/), and POSTs a create, an update or a
delete. Requests arrive form-encoded, multipart (with files) or as JSON in the
microformats2 shape, and queries (`q=config`, `q=source`, `q=syndicate-to`) tell the client
what the server supports and hand an existing post back for editing.

`apps/blog` publishes only through its CMS, a set of server-rendered forms behind an OIDC
session with `auth.sergiodxa.com` (`apps/r3-auth`). There is no API, no bearer-token
surface and no way for any other tool to write a post. Micropub is the standard answer, and
together with Webmention (ADR-094) and microformats (ADR-093) it is what lets the blog take
part in the IndieWeb. The blog adopts it first; blog-saas follows when it is rebuilt.

## Context

### What the blog would map Micropub onto

| Area           | Current state in `apps/blog`                                                                                                           |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Post types     | `article`, `tutorial`, `like` (bookmarks: `title`, `url`), `glossary`; `comment` is in the enum and unused; there is no note type      |
| Storage        | D1 `posts` row plus `post_meta` key/value rows; slug, title, content, excerpt and tags are meta rows                                   |
| Content        | Markdown, rendered with `@sdxc/markdown`                                                                                               |
| Publish state  | `published_at` null or past is published, future is scheduled; there are no drafts                                                     |
| Deletes        | `destroy` removes the rows, so a deleted post answers 404 (ADR-094 adds a `deleted_at` tombstone)                                      |
| Writes         | `app/http/controllers/cms/*.tsx` call `ArticlePost.create/update/destroy(ctx.db, …)` and purge cache tags                              |
| Media          | No media bucket; the only R2 binding is `BACKUPS`                                                                                      |
| Authentication | OIDC session with r3-auth via `@sdxc/auth` (`app/auth/relying-party.ts`, `app/http/middleware/auth.ts`); `requireAdmin` guards the CMS |
| Bearer tokens  | None; `ResourceServer` and `bearerScheme` exist in `@sdxc/auth` and no app uses them                                                   |
| Body parsing   | `formData()` middleware consumes form and multipart bodies into `ctx.formData` before controllers run                                  |
| Discovery      | `/.well-known/webfinger` lists `rel: "me"` links; no `<link rel>` or `Link` header advertises any endpoint                             |

### What the specification asks of a server

| Rule                                                                                                                                 | Consequence for the package                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Create arrives form-encoded (`h=entry`, `category[]=…`), multipart (files), or JSON (an mf2 item)                                    | three decoders produce one `Create` operation with mf2 properties                               |
| `mp-*` names are commands (`mp-slug`, `mp-syndicate-to`), not properties                                                             | commands are split from properties into a typed `commands` field                                |
| JSON `content` may be `{ "html": … }`; `photo` may be `{ "value", "alt" }`                                                           | property values are mf2 values (ADR-093), so both shapes type-check                             |
| Update is JSON only: `replace`, `add`, and `delete` as a property list or a map of values                                            | `Update` carries the three, with `delete` normalized into whole-property and per-value removals |
| Delete and undelete take `action` and `url`, form or JSON                                                                            | two operations sharing one shape                                                                |
| The token may come in `Authorization: Bearer` or as `access_token` in a form body                                                    | the parser returns the token it found, so the app verifies one string whichever way it came     |
| Create answers `201 Created` or `202 Accepted` with `Location`                                                                       | response builders for each                                                                      |
| Update answers `200`, `201` with `Location` when the URL changed, or `204`                                                           | a builder taking the optional new URL                                                           |
| Errors are JSON `{ error, error_description }`: `invalid_request` 400, `unauthorized` 401, `forbidden` 403, `insufficient_scope` 403 | one builder over a closed set of codes                                                          |
| `q=config` lists `media-endpoint`, `syndicate-to`, supported queries and post types                                                  | a typed config written with wire names                                                          |
| `q=source&url=…&properties[]=…` returns the item, or only the named properties                                                       | a builder that projects an mf2 item                                                             |
| The media endpoint takes one multipart part named `file` and answers `201` with `Location`                                           | a separate parser for that one request                                                          |
| Scopes: `create`, `update`, `delete`, `media` (`undelete` and `draft` are common extensions)                                         | each operation names the scope it needs                                                         |

### The token: what r3-auth issues and what IndieAuth needs

The Micropub endpoint is an OAuth 2.0 resource server. `@sdxc/auth`'s `ResourceServer`
verifies a JWT access token against the issuer's JWKS locally and falls back to RFC 7662
introspection for opaque tokens, which is the right shape for the blog. The gap is on the
issuing side. Micropub clients obtain tokens through IndieAuth, an OAuth 2.0 profile in
which the user is a URL and so is the client:

| IndieAuth requires                                                                                 | r3-auth today                                                                                                     |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `client_id` is a URL; the server fetches it for the client's name, logo and redirect URIs          | `client_id` must be a UUID of a client an admin created (`app/http/validators/authorize.ts`)                      |
| Public clients, PKCE with `S256` required                                                          | Every client has a secret and one exact redirect URI; PKCE is optional and `plain` is accepted                    |
| Scopes `create`, `update`, `delete`, `media`, `profile`                                            | `SCOPES_SUPPORTED` is `openid email profile offline_access`; other scopes are dropped with a log line             |
| The token response and introspection carry `me`, the user's profile URL (`https://sergiodxa.com/`) | Tokens carry `sub`, an internal subject id; introspection returns neither `me` nor `scope`                        |
| Metadata at the URL the profile page's `rel="indieauth-metadata"` names, with an `https` `issuer`  | Discovery at `/.well-known/openid-configuration` with the scheme-less issuer `auth.sergiodxa.com`, frozen         |
| The `iss` authorization-response parameter equals the metadata `issuer`                            | `iss` is sent as `https://auth.sergiodxa.com`, which differs from the discovery `issuer` by design                |
| The token is usable at the user's Micropub endpoint                                                | Authorization-code tokens set `aud` to the client id; RFC 8707 `resource` is honored on `client_credentials` only |

None of this is Micropub's concern, and none of it can be fixed in the blog. It is
IndieAuth support in r3-auth, and it is a separate follow-up ADR. The follow-up would
cover: URL client identifiers with client metadata fetched under the same bounds as
ADR-094, public clients with mandatory `S256`, the Micropub scopes, a per-user profile URL
returned as `me` from the token and introspection endpoints, an IndieAuth metadata document
whose `issuer` matches the `iss` parameter already sent, and `aud` set to the resource the
token is for. This ADR does not write it.

## Decision

Add `@sdxc/micropub`: parse and validate Micropub requests into typed operations and
queries, and build the responses the spec defines. The blog maps operations onto its posts,
verifies tokens with `@sdxc/auth`'s `ResourceServer` against r3-auth, and stores media in a
new R2 bucket.

### Package name

| Name                         | Trade-off                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| **`@sdxc/micropub`**         | The spec's name; leaves room for a client subpath later without a rename                                |
| `@sdxc/micropub-server`      | Precise today, but a client (`q=config`, create) would need a second package for the same wire format   |
| `@sdxc/indieweb` (umbrella)  | Bundles mf2, Webmention and Micropub; rejected in ADR-093 because each change would republish all three |
| Part of `@sdxc/microformats` | Micropub's JSON is mf2, but form decoding, commands, scopes and HTTP responses are protocol, not format |

`@sdxc/micropub` wins because it names the protocol, the server side is what exists today,
and the same wire types serve a client when one is needed.

### Scope

The package includes:

- Decoding form-encoded, multipart and JSON requests into `Create`, `Update`, `Delete` and
  `Undelete` operations, and `GET` requests into queries
- Extracting the access token from either place the spec allows
- The scope each operation requires
- Response builders for creates, updates, deletes, errors and the three standard queries
- Parsing a media endpoint upload and answering it

What stays out:

- Token verification lives in `@sdxc/auth` (`ResourceServer`)
- The mf2 item shape and its schema live in `@sdxc/microformats` (ADR-093)
- Post Type Discovery lives in `@sdxc/microformats/vocabulary`
- Mapping operations onto posts, slugs and URLs lives in the blog
- Storing uploads lives in the app (R2 for the blog)
- Syndication to other services lives in the app, advertised through `q=syndicate-to`
- Issuing tokens, and IndieAuth itself, lives in r3-auth, per the follow-up ADR

### Exports

#### `"."` — requests, operations and responses

```ts
import type { MF2 } from "@sdxc/microformats";
import type { Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

export namespace Micropub {
	export type Properties = Record<string, MF2.PropertyValue[]>;

	export interface Commands {
		slug: string | null;
		syndicateTo: string[];
		/** `post-status`, which is a property on the wire and a command in effect. */
		status: "published" | "draft" | null;
		/** Every other `mp-*` name, kept for the app to honor or ignore. */
		other: Record<string, unknown[]>;
	}

	export interface Create {
		action: "create";
		type: string[];
		properties: Properties;
		commands: Commands;
		/** Files from a multipart create, by property name (`photo`, `video`, `audio`). */
		files: Record<string, File[]>;
	}

	export interface Update {
		action: "update";
		url: string;
		replace: Properties;
		add: Properties;
		/** Properties removed entirely. */
		deleteProperties: string[];
		/** Individual values removed from a property. */
		deleteValues: Properties;
	}

	export interface Delete {
		action: "delete";
		url: string;
	}

	export interface Undelete {
		action: "undelete";
		url: string;
	}

	export type Operation = Create | Update | Delete | Undelete;

	export type Query =
		| { q: "config" }
		| { q: "syndicate-to" }
		| { q: "source"; url: string; properties: string[] }
		/** A query the spec leaves to extensions (`category`, `contact`), passed through. */
		| { q: string; params: URLSearchParams };

	export interface Parsed<Body> {
		body: Body;
		/** From `Authorization: Bearer` or the form's `access_token`; `null` when neither was sent. */
		accessToken: string | null;
	}

	export type Scope = "create" | "update" | "delete" | "undelete" | "media" | "draft";

	export interface SyndicationTarget {
		uid: string;
		name: string;
	}

	export interface Config {
		mediaEndpoint?: string;
		syndicateTo?: SyndicationTarget[];
		/** Queries this server answers besides `config`. */
		q?: string[];
		postTypes?: { type: string; name: string }[];
	}

	export type ErrorCode = "invalid_request" | "unauthorized" | "forbidden" | "insufficient_scope";

	export interface ParseOptions {
		/** The body `formData()` middleware already read, for form and multipart requests. */
		formData?: FormData;
		/** @default 1_048_576 */
		maxJsonBytes?: number;
	}
}

/** Signals a request the spec answers with `invalid_request`, carrying the data-schema issues. */
export class MicropubRequestError extends Error {
	override name = "MicropubRequestError";
	readonly issues: readonly StandardSchemaV1.Issue[];
}

/** Decodes a POST into an operation; a GET is a query, parsed by `parseQuery`. */
export function parseOperation(
	request: Request,
	options?: Micropub.ParseOptions,
): Promise<Result<Micropub.Parsed<Micropub.Operation>, MicropubRequestError>>;

export function parseQuery(
	request: Request,
): Result<Micropub.Parsed<Micropub.Query>, MicropubRequestError>;

/** The scope an operation needs; a create with `post-status: draft` needs `draft` or `create`. */
export function requiredScopes(operation: Micropub.Operation): Micropub.Scope[];

export function created(location: string | URL): Response;
export function accepted(location: string | URL): Response;
/** `204`, or `201` with `Location` when the update moved the post. */
export function updated(location?: string | URL): Response;
export function deleted(): Response;
/** JSON error body; `unauthorized` and `insufficient_scope` also carry `WWW-Authenticate: Bearer`. */
export function error(code: Micropub.ErrorCode, description?: string): Response;

/** Writes the config with wire names (`media-endpoint`, `syndicate-to`, `post-types`). */
export function config(config: Micropub.Config): Response;
export function syndicateTo(targets: Micropub.SyndicationTarget[]): Response;
/** The item, or `{ properties }` holding only the requested names, as `q=source` defines. */
export function source(item: MF2.Item, properties?: string[]): Response;
```

Decoding goes through `remix/data-schema`: the JSON create is validated with
`ITEM_SCHEMA` from `@sdxc/microformats`, update and delete bodies with this package's
schemas, and form bodies are first reshaped (`h` into `type`, `name[]` into arrays, `mp-*`
into commands) and then validated by the same schemas, so every path yields the same
operation for the same post. A JSON body that is not an object, an update over a form body
and an update naming no change are `invalid_request`.

`parseOperation` reads the form from `options.formData` because in the blog the
`formData()` middleware has consumed the stream before the controller runs. Without it, the
parser reads the body itself, which is what a router without that middleware needs.

#### `"./media"` — the media endpoint

```ts
export namespace Media {
	export interface Options {
		formData: FormData;
		/** @default 26_214_400 */
		maxBytes?: number;
		/** Media types accepted, matched on the essence; `image/*` style wildcards allowed. */
		accept: string[];
	}
}

/** The single `file` part the spec requires, checked for size and type. */
export function parseUpload(
	request: Request,
	options: Media.Options,
): Result<Micropub.Parsed<File>, MicropubRequestError>;

/** `201 Created` with the file's public URL in `Location`. */
export function uploaded(location: string | URL): Response;
```

Size limits are enforced twice on purpose: the blog's `formData()` middleware caps the
multipart parse with `maxFileSize`, which stops a large upload before it is buffered, and
`parseUpload` checks the file it is handed, which holds for a router configured without
that cap.

### Authentication in the blog

The blog verifies the token with `ResourceServer`, configured against r3-auth:

```ts
import { ResourceServer } from "@sdxc/auth/resource-server";

import { issuer } from "~/app/auth/issuer";

/** Verifies Micropub bearer tokens against the issuer the CMS login already trusts. */
export function micropubResource(): ResourceServer {
	return new ResourceServer(issuer(), {
		audience: "https://sergiodxa.com/micropub",
		introspection: r3AuthIntrospector,
	});
}
```

- **JWTs are verified locally.** r3-auth issues ES256 JWT access tokens (RFC 9068), so
  verification reads the cached JWKS, the one the blog's OIDC login already caches in KV,
  and makes no call per request. Introspection is configured for opaque tokens and stays
  unused while r3-auth issues JWTs.
- **The subject must be the blog's admin.** `token.subject` is matched against
  `users.subject_id` and the row's `role` must be `admin`, the same rule `requireAdmin`
  applies to the CMS, so Micropub grants nobody a write the CMS would not.
- **Scopes gate each operation.** `requiredScopes(operation)` is compared with
  `token.has(scope)`; a missing scope answers `insufficient_scope`.
- **Revocation lags by the token lifetime.** Local verification cannot see a revocation, so
  a revoked token works until it expires, one hour at r3-auth. Introspecting every write
  would close that window at the cost of a round trip, and r3-auth's introspection omits
  `scope`, so it could not authorize today. The follow-up ADR adds `scope` and `me` to
  introspection, and the blog can then choose.
- **`me` is checked when present.** Once r3-auth returns `me`, the blog requires it to equal
  `https://sergiodxa.com/`. `AccessToken` has no `me` accessor today; the follow-up adds
  one to `@sdxc/auth`.

`authorize(ctx, token)` in the usage below is the blog's function that runs these steps
and returns the admin user with the verified token, or the error code to answer with.

The Micropub endpoint answers 401 with `WWW-Authenticate: Bearer`, and adds the
`resource_metadata` parameter once the protected resource metadata of ADR-084 is served.

Until r3-auth supports IndieAuth, no off-the-shelf Micropub client can obtain a token for
the blog. The endpoint is still built, tested with tokens minted in tests from a local
signing key, and exercised in production by the blog's own tooling (a token issued to a
registered r3-auth client with the Micropub scopes once r3-auth accepts them). The order of
work reflects that dependency.

### Usage

```ts
import { created, deleted, error, parseOperation, requiredScopes, updated } from "@sdxc/micropub";

/** Creates, updates and deletes posts for a token whose subject is the blog's admin. */
export default createAction(routes.micropub.write, async (ctx) => {
	let parsed = await parseOperation(ctx.request, { formData: ctx.formData });
	if (isFailure(parsed)) return error("invalid_request", parsed.error.message);

	let grant = await authorize(ctx, parsed.data.accessToken);
	if (isFailure(grant)) return error(grant.error.code, grant.error.message);

	let operation = parsed.data.body;
	if (!requiredScopes(operation).some((scope) => grant.data.has(scope))) {
		return error("insufficient_scope");
	}

	switch (operation.action) {
		case "create": {
			let post = await MicropubPosts.create(ctx.db, grant.data.user, operation);
			if (isFailure(post)) return error("invalid_request", post.error.message);
			await dispatcher.enqueue(jobs.webmentions.send, { postId: post.data.id });
			return created(post.data.url);
		}
		case "update": {
			let post = await MicropubPosts.update(ctx.db, operation);
			return isFailure(post) ? error("invalid_request", post.error.message) : updated();
		}
		case "delete":
		case "undelete": {
			await MicropubPosts[operation.action](ctx.db, operation.url);
			return deleted();
		}
	}
});
```

```ts
import { config, error, parseQuery, source, syndicateTo } from "@sdxc/micropub";

/** Answers the three standard queries for the admin's token; `source` reads the post back as mf2. */
export default createAction(routes.micropub.query, async (ctx) => {
	let parsed = parseQuery(ctx.request);
	if (isFailure(parsed)) return error("invalid_request", parsed.error.message);

	let grant = await authorize(ctx, parsed.data.accessToken);
	if (isFailure(grant)) return error(grant.error.code, grant.error.message);

	let query = parsed.data.body;
	if (query.q === "config") {
		return config({
			mediaEndpoint: MEDIA_ENDPOINT,
			syndicateTo: [],
			q: ["source", "syndicate-to"],
		});
	}
	if (query.q === "syndicate-to") return syndicateTo([]);
	if (query.q === "source") {
		let item = await MicropubPosts.toItem(ctx.db, query.url);
		return item ? source(item, query.properties) : error("invalid_request", "No such post");
	}
	return error("invalid_request", `Unsupported query ${query.q}`);
});
```

#### Mapping onto the blog's posts

`MicropubPosts` in the blog is where the protocol meets the content model, using
`postType` from `@sdxc/microformats/vocabulary`:

| Micropub create                                                      | Blog post                                                                                                                  |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `h-entry` with `name` and `content` (article)                        | `article`: `title`, `content`, `slug` from `mp-slug` or the name                                                           |
| `h-entry` with `bookmark-of`                                         | `like` (the blog's bookmark type): `title` from `name`, `url`                                                              |
| `h-entry` with neither (note), `like-of`, `repost-of`, `in-reply-to` | `invalid_request` until the blog adds a note type                                                                          |
| `published`                                                          | `published_at`, so a future date schedules the post                                                                        |
| `post-status: draft`                                                 | `invalid_request` until the blog has drafts                                                                                |
| `summary`                                                            | `excerpt`                                                                                                                  |
| `category`                                                           | ignored on articles, which carry no tags; kept on types that do                                                            |
| `content` as text                                                    | stored as Markdown, since that is what Micropub editors send                                                               |
| `content` as `{ html }`                                              | stored as an HTML block in the Markdown, pending a check that `@sdxc/markdown` renders raw HTML blocks; rejected otherwise |
| `photo` URL or uploaded file                                         | uploaded files go to R2 through the media handler; the URL is appended to the content as an image                          |

Tutorials and glossary entries stay CMS-only: their shapes (tag lists, a term and its
definition) have no mf2 counterpart a client would send. Update maps `replace`, `add` and
`delete` onto the meta rows the table names. Delete sets the `deleted_at` tombstone ADR-094
introduces, which makes `undelete` a column reset, and both enqueue the Webmention send so
receivers see the 410. `q=source` builds the item back from the same table in reverse.

#### Media

A new R2 binding, `MEDIA`, holds uploads under a content-hash key. `POST /micropub/media`
parses with `parseUpload`, writes the object and answers `uploaded(url)`, where the URL is
served by a blog route streaming from R2 with an immutable cache header. Accepted types are
images (JPEG, PNG, WebP, GIF, AVIF) up to 25 MB; the list lives in the blog.

#### Discovery

The blog advertises the endpoint on its home page and every post, in `<head>` and as
`Link` headers: `rel="micropub"` pointing at `/micropub`, and, once the follow-up lands,
`rel="indieauth-metadata"` pointing at r3-auth's IndieAuth metadata document, with
`rel="authorization_endpoint"` and `rel="token_endpoint"` for clients that predate
metadata discovery.

#### Files that change in `apps/blog`

| File                                                     | Change                                                                       |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `routes/web.ts`, `bootstrap/app.tsx`                     | `GET`/`POST /micropub`, `POST /micropub/media`, `GET /media/:key`            |
| `app/http/controllers/micropub.ts` (new)                 | the write and query actions                                                  |
| `app/http/controllers/micropub-media.ts` (new)           | upload and serve media                                                       |
| `app/auth/resource-server.ts` (new)                      | `ResourceServer` against r3-auth, sharing the issuer in `app/auth/issuer.ts` |
| `app/services/micropub-posts.ts` (new)                   | operations onto `ArticlePost`/`LikePost`, and posts back into mf2 items      |
| `wrangler.jsonc`                                         | `MEDIA` R2 binding                                                           |
| `bootstrap/app.tsx`                                      | `formData({ maxFileSize })` so uploads are capped before buffering           |
| `resources/layouts/document.tsx`, `controllers/post.tsx` | `rel="micropub"` in `<head>` and the `Link` header                           |

### Multi-tenant notes for `apps/blog-saas`

- Each blog has its own endpoint on its own host, and the token's `aud` names that host's
  endpoint, so a token for one tenant is rejected by every other.
- Tokens come from the tenant's configured OIDC provider, which blog-saas already holds per
  tenant; the IndieAuth requirements above then apply to auth-saas and
  `@sdxc/oidc-provider`, which today also lacks URL client identifiers and `iss` on the
  authorization response.
- Authorization is enforced inside the tenant's Durable Object, the boundary that receives
  the write, against that tenant's users and roles.
- Media goes to a shared bucket under a tenant prefix, served from the tenant's host.
- Post types there are runtime-defined (`post-types` in blog-engine), so `q=config` lists
  the tenant's own types and the mapping reads from them.

## Consequences

### Positive

- **Any Micropub client can publish** - once tokens are available, editors and apps that
  speak Micropub write to the blog without a line of blog-specific code
- **One decoder for three encodings** - form, multipart and JSON produce the same typed
  operation, validated through data-schema
- **The blog gains its first bearer-token surface on existing code** - `ResourceServer`
  has had no consumer, and Micropub exercises it against the deployed issuer
- **Round-trip editing** - `q=source` returns the post in the same shape a create accepts,
  built from the microformats package the page markup uses

### Negative

- **Blocked on IndieAuth for real clients** - until r3-auth grows URL client identifiers,
  public clients, custom scopes and `me`, the endpoint serves only tokens the blog's own
  tooling obtains
- **Revocation lags up to an hour** - local JWT verification cannot see a revoked token
- **Partial type coverage** - notes, likes, reposts, replies and drafts are rejected until
  the blog's content model has somewhere to put them
- **HTML content is uncertain** - storing `{ html }` depends on the Markdown renderer
  passing raw HTML blocks through, which has to be checked before it is accepted

### Neutral

- **A media bucket** - one R2 binding and one serving route, independent of the
  `BACKUPS` bucket
- **No syndication targets yet** - `q=syndicate-to` answers an empty list, which clients
  handle; a POSSE target (Bridgy Publish, for example) is an app addition later

## Implementation Plan

### Phase 1: Build the package

**Priority:** High
**Estimated Effort:** 1.5 days

1. Write the tests first from the spec's examples and the micropub.rocks server test list:
   form create with arrays, multipart with photos, JSON create with nested and HTML values,
   `mp-*` commands, every update form, delete and undelete in both encodings, token in body
   and header, invalid bodies, and each response builder
2. Implement decoding, `requiredScopes`, the builders and `./media`
3. Write the README and add the root README row

### Phase 2: Endpoint in the blog

**Priority:** Medium
**Estimated Effort:** 1.5 days

1. Add the `ResourceServer`, the admin-subject rule and the scope checks, tested with tokens
   signed by a test key
2. Add `MicropubPosts` with the mapping table, including `toItem` for `q=source`
3. Add the `MEDIA` binding, the media endpoint and the media route
4. Advertise `rel="micropub"`; build and deploy (no migration beyond ADR-094's tombstone)

### Phase 3: IndieAuth (separate ADR)

**Priority:** Medium
**Estimated Effort:** Decided by that ADR

1. Write the r3-auth IndieAuth ADR covering the gap table above, then implement it
2. Advertise `rel="indieauth-metadata"` on the blog and check `me` on every token
3. Verify against micropub.rocks and a real client (Quill, iA Writer)

### Phase 4: Publish

**Priority:** Low
**Estimated Effort:** 30 minutes

1. Make `@sdxc/microformats` public first, then this package

## Alternatives Considered

### 1. `@sdxc/indieweb`, one package for microformats, Webmention and Micropub

**Rejected because**: of the reasons in ADR-093. A Micropub server needs none of
Webmention's fetching or discovery, and a Webmention fix would republish this package under
ADR-007's per-package release notes.

### 2. Make the blog its own IndieAuth server

The blog would issue its own tokens, as many IndieWeb sites do, and skip r3-auth.

**Rejected because**: blog ADR-002 centralizes authentication in the auth server, and a
second token issuer in the blog means a second place to hold signing keys, consent screens
and revocation. IndieAuth belongs with the rest of OAuth, in r3-auth.

### 3. Personal access tokens minted by the blog's CMS

A CMS page would mint a long-lived bearer token to paste into a client.

**Rejected because**: most Micropub clients only speak IndieAuth and offer no field for a
pasted token, and the blog would take on token storage, hashing and revocation that r3-auth
already does. It solves a short interim at a permanent cost.

### 4. Validate tokens only through introspection

**Rejected because**: r3-auth's introspection omits `scope`, so it cannot authorize a
Micropub write today, and it adds a network call per request where local verification of
an ES256 JWT is already available. It stays configured for opaque tokens.

### 5. A Micropub-specific admin API instead of the standard

**Rejected because**: the value of Micropub is the clients that already exist. A private
API would reach only tools written for it.

## References

- [Micropub - W3C Recommendation](https://www.w3.org/TR/micropub/)
- [micropub.rocks - conformance tests](https://micropub.rocks/)
- [IndieAuth](https://indieauth.spec.indieweb.org/)
- [RFC 7662 - OAuth 2.0 Token Introspection](https://www.rfc-editor.org/rfc/rfc7662)
- [RFC 8707 - Resource Indicators for OAuth 2.0](https://www.rfc-editor.org/rfc/rfc8707)
- [RFC 9068 - JWT Profile for OAuth 2.0 Access Tokens](https://www.rfc-editor.org/rfc/rfc9068)
- [ADR-084: OAuth Protected Resource Metadata](./ADR-084-oauth-protected-resource-metadata.md)
- [ADR-093: Microformats2 Package](./ADR-093-microformats-package.md)
- [ADR-094: Webmention Package](./ADR-094-webmention-package.md)
- [Blog ADR-002: Centralized Auth](./blog/ADR-002-centralized-auth.md)
