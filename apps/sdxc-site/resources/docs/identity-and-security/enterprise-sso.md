---
title: Enterprise sign-on with SAML and SCIM
description: Let a customer's directory sign its people in over SAML 2.0 and provision their users over SCIM 2.0.
section:
    title: Identity & security
    order: 6
order: 10
lastUpdated: 2026-10-25
outcomes:
    - "How to let a customer's directory sign people in over SAML 2.0"
    - "How to verify an assertion and remember it for as long as it is valid"
    - "How to provision and deprovision users over SCIM 2.0"
---

The first large customer asks two questions: can our people sign in through our own identity
provider, and will your app know when someone leaves? The first is SAML, where their directory
posts a signed assertion to your app. The second is SCIM, where their directory calls your API
to create, update and deactivate the people it manages.

[`@sdxc/saml`](/api/saml) is the service provider half of SAML 2.0: it builds the
authentication request, verifies the signed response, and reads and writes the metadata the
two sides exchange. [`@sdxc/scim`](/api/scim) is the standard's half of a SCIM 2.0 endpoint:
resources, filters and PATCH. Routing, storage and authentication
stay in your app.

```bash
npm add @sdxc/crypto @sdxc/duration @sdxc/http @sdxc/lazy-route @sdxc/result @sdxc/saml \
	@sdxc/scim @sdxc/uuid remix
```

## Declare the routes

Every customer gets its own connection, named by a slug, and each connection is a separate
service provider with its own entity id, so its URLs carry the slug. SCIM lives under
`/scim/v2`, where clients expect it.

```typescript {% title="routes/web.ts" %}
import { get, patch, post, route } from "remix/routes";

export default route({
	home: get("/"),
	sso: {
		metadata: get("/sso/:slug/metadata"),
		start: get("/sso/:slug"),
		acs: post("/sso/:slug/acs"),
	},
	scim: {
		users: {
			list: get("/scim/v2/Users"),
			create: post("/scim/v2/Users"),
			patch: patch("/scim/v2/Users/:id"),
		},
	},
});
```

Derive the absolute identifiers from the route table, so the URL your metadata publishes and
the URL an assertion is checked against are one value:

```typescript {% title="app/services/sso/service-provider.ts" %}
import routes from "~/routes/web";

export function serviceProvider(url: URL, slug: string) {
	return {
		entityId: new URL(routes.sso.metadata.href({ slug }), url).href,
		acs: new URL(routes.sso.acs.href({ slug }), url).href,
	};
}
```

## Exchange metadata with the provider

The customer's administrator hands you their identity provider's metadata. `parseIdPMetadata`
reads the entity id, the sign-on endpoints and the signing certificates out of it:

```typescript {% title="app/services/sso/provider-metadata.ts" %}
import { isFailure, success } from "@sdxc/result";
import * as SAML from "@sdxc/saml";

const REDIRECT = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect";

export async function readProviderMetadata(xml: string) {
	let metadata = await SAML.parseIdPMetadata(xml);
	if (isFailure(metadata)) return metadata;

	let endpoint = metadata.data.singleSignOn.find((it) => it.binding === REDIRECT);
	return success({
		entityId: metadata.data.entityId,
		ssoUrl: endpoint?.location ?? null,
		certificates: metadata.data.signing.map((certificate) => ({
			fingerprint: certificate.fingerprint,
			notAfter: certificate.notAfter,
			pem: certificate.toPem(),
		})),
	});
}
```

Store every certificate, keyed by `fingerprint`. A response verifies when it matches any
certificate you pass, so keeping the old and new ones side by side makes a provider's rotation
a non-event.

In the other direction, serve your entity id, ACS URL and certificate as a document:

```typescript {% title="app/http/controllers/sso/metadata.ts" %}
import { text, xml } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import * as SAML from "@sdxc/saml";
import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { serviceProvider } from "~/app/services/sso/service-provider";
import routes from "~/routes/web";

export default createAction(routes.sso.metadata, async (ctx) => {
	let { slug } = s.parse(s.object({ slug: s.string() }), ctx.params);
	let certificate = await SAML.Certificate.parse(env.SAML_SP_CERTIFICATE);
	if (isFailure(certificate)) return text("Not configured", { status: 503 });

	let sp = serviceProvider(ctx.url, slug);
	let document = SAML.buildServiceProviderMetadata({
		entityId: sp.entityId,
		assertionConsumerService: sp.acs,
		certificate: certificate.data,
		nameIdFormat: null,
		wantAssertionsSigned: true,
		authnRequestsSigned: true,
		validUntil: null,
	});
	if (isFailure(document)) return text("Not configured", { status: 503 });

	return xml(document.data);
});
```

Generate the certificate once, from an RSA key pair you keep as a secret, with
`SAML.Certificate.selfSigned({ keys, commonName, notBefore, notAfter })` and `toPem()`.

## Start a sign-in

The login form finds the connection for the work email's domain and sends the browser to
`routes.sso.start`. `createAuthnRequest` builds the request and signs it with your private key:

```typescript {% title="app/http/controllers/sso/start.ts" %}
import { redirect, text } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import * as SAML from "@sdxc/saml";
import { generateUUID } from "@sdxc/uuid/v4";
import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { Connections } from "~/app/models/connections";
import { signingKey } from "~/app/services/sso/keys";
import { serviceProvider } from "~/app/services/sso/service-provider";
import routes from "~/routes/web";

export default createAction(routes.sso.start, async (ctx) => {
	let { slug } = s.parse(s.object({ slug: s.string() }), ctx.params);
	let connection = await Connections.find(ctx.db, slug);
	if (connection === null) return text("Unknown connection", { status: 404 });

	let sp = serviceProvider(ctx.url, slug);
	let relayState = generateUUID();
	let request = await SAML.createAuthnRequest({
		binding: "redirect",
		destination: connection.ssoUrl,
		issuer: sp.entityId,
		assertionConsumerService: sp.acs,
		nameIdFormat: null,
		forceAuthn: false,
		relayState,
		signingKey: await signingKey(),
		now: new Date(),
	});
	if (isFailure(request) || request.data.url === null) {
		return text("Sign-in unavailable", { status: 503 });
	}

	let pending = { requestId: request.data.id, slug };
	await env.SSO.put(relayState, JSON.stringify(pending), { expirationTtl: 600 });
	return redirect(request.data.url);
});
```

The response must answer with `request.data.id`, which binds the assertion to the browser that
asked for it. It waits in KV under the `RelayState` because the response arrives as a
cross-site `POST` that carries no `SameSite=Lax` session cookie, while the `RelayState` comes
back beside it. `signingKey` imports your PKCS #8 private key with `crypto.subtle.importKey`
for `RSASSA-PKCS1-v1_5` with SHA-256.

## Verify the assertion

The assertion consumer service is where a stranger's XML decides who is signed in, so it all
goes through one call. `verifyResponse` refuses a document type declaration, requires exactly
one signature covering the assertion it returns, and checks `Destination`, `Audience`,
`Recipient`, the validity window, `InResponseTo` and the replay store. Every option is
required, so a forgotten audience does not compile.

```tsx {% title="app/http/controllers/sso/acs.tsx" %}
import { Base64 } from "@sdxc/crypto";
import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import * as SAML from "@sdxc/saml";
import { env } from "cloudflare:workers";
import { createAction } from "remix/router";

import { startSession } from "~/app/services/auth/session";
import { Users } from "~/app/models/users";
import { findPending } from "~/app/services/sso/pending";
import { replayStore } from "~/app/models/replay-store";
import { serviceProvider } from "~/app/services/sso/service-provider";
import { LoginPage } from "~/resources/views/login";
import routes from "~/routes/web";

export default createAction(routes.sso.acs, async (ctx) => {
	let refuse = () =>
		ctx.render(<LoginPage error="Sign-in failed." />, { status: 403 });
	let pending = await findPending(ctx);
	if (pending === null) return refuse();
	await env.SSO.delete(pending.relayState);

	let xml = Base64.decode(pending.samlResponse);
	if (isFailure(xml)) return refuse();

	let sp = serviceProvider(ctx.url, pending.connection.slug);
	let verified = await SAML.verifyResponse(new TextDecoder().decode(xml.data), {
		certificates: pending.connection.certificates,
		audience: sp.entityId,
		destination: sp.acs,
		recipient: sp.acs,
		inResponseTo: pending.requestId,
		decryptionKey: null,
		replay: replayStore(ctx.db, pending.connection.id),
		clock: { now: new Date(), skew: "60 seconds" },
	});
	if (isFailure(verified)) {
		ctx.log.warn("sso.rejected", { kind: verified.error.name });
		return refuse();
	}

	let user = await Users.upsertFromSso(ctx.db, {
		connectionId: pending.connection.id,
		subject: verified.data.nameId?.value ?? null,
		email: verified.data.attribute("email"),
	});
	await startSession(ctx, user.id);
	return redirect(routes.home.href(), { status: redirect.Status.SeeOther });
});
```

`findPending` is yours: it validates the posted `SAMLResponse` and `RelayState`, reads the
stored request from the `SSO` namespace, and loads the connection with its certificates parsed
by `SAML.Certificate.parse`. The failure's `name` is safe to log; it carries no key material.

> [!WARNING]
> Delete the pending entry before verifying anything, as the handler does, so each request
> answers at most one response. Key the account on the `NameID` for this connection and keep the
> email as a field: a directory may change an email, and an account keyed on it changes hands
> with the address.

> [!NOTE]
> This route receives a cross-site `POST`, so exempt it from Remix's
> [`cop()`](https://github.com/remix-run/remix/tree/main/packages/cop-middleware) protection the
> way you would a webhook. Canonicalizing is CPU work over the whole assertion, so cap the size
> of the body before it gets here.

## Remember assertions for as long as they are valid

The replay store is two methods. `verifyResponse` calls `remember` only after every other
check passes, with a TTL covering the rest of the assertion's window, so a forged document
never fills the table and a row lives exactly as long as a captured assertion could be
replayed.

```typescript {% title="app/models/replay-store.ts" %}
import type { ReplayStore } from "@sdxc/saml";
import type { Database } from "remix/data-table";

import { toMs } from "@sdxc/duration";
import { column as c, table } from "remix/data-table";

export const assertionIds = table({
	name: "saml_assertion_ids",
	primaryKey: ["id"],
	columns: { id: c.text(), expires_at: c.integer() },
});

export function replayStore(db: Database, connectionId: string): ReplayStore {
	return {
		async seen(id) {
			return (
				(await db.find(assertionIds, { id: `${connectionId}:${id}` })) !==
				null
			);
		},
		async remember(id, ttl) {
			let row = {
				id: `${connectionId}:${id}`,
				expires_at: Date.now() + toMs(ttl),
			};
			await db.create(assertionIds, row);
		},
	};
}
```

The provider chooses assertion ids, so the connection id in the key keeps each provider's ids
apart.

> [!WARNING]
> Keep the replay store in D1. KV is eventually consistent, so a second use of a captured
> assertion can reach a location that has yet to see the first, and pass.

## Authenticate the directory

SCIM clients authenticate with a bearer token you issue per directory. Store only its SHA-256
hash, and look the directory up by it:

```typescript {% title="app/http/middleware/scim-auth.ts" %}
import type { Middleware } from "remix/router";

import { Hex, sha256 } from "@sdxc/crypto";
import { isFailure } from "@sdxc/result";
import { errorResponse, ScimError } from "@sdxc/scim";
import { createContextKey } from "remix/router";

import { Directories } from "~/app/models/directories";

export const DirectoryId = createContextKey<string>();

declare module "remix/router" {
	interface RequestContext {
		directoryId: string;
	}
}

export const scimAuth: Middleware = async (ctx, next) => {
	let header = ctx.request.headers.get("Authorization") ?? "";
	let token = header.startsWith("Bearer ") ? header.slice(7) : "";
	let digest = await sha256(token);
	let directory = isFailure(digest)
		? null
		: await Directories.findByTokenHash(ctx.db, Hex.encode(digest.data));
	if (token === "" || directory === null) {
		return errorResponse(new ScimError(401, "The token matches no directory."));
	}

	ctx.set(DirectoryId, directory.id, { property: "directoryId" });
	return next();
};
```

> [!WARNING]
> Store the hash and show the token once, when you issue it. A stored token is a working
> credential for anyone who reads the table, and a hash is worth nothing to them.

`errorResponse` writes the RFC 7644 error document with the `application/scim+json` type, and
every failure `@sdxc/scim` reports is a `ScimError` it accepts.

## Define the attributes you model

One set of definitions says which attributes your app models, and filters, PATCH and
projection evaluate against it:

```typescript {% title="app/services/scim/definitions.ts" %}
import type { Discovery } from "@sdxc/scim/discovery";

import { ENTERPRISE_USER_SCHEMA, USER_SCHEMA } from "@sdxc/scim";
import {
	ENTERPRISE_USER_DEFINITION,
	pickAttributes,
	USER_DEFINITION,
} from "@sdxc/scim/discovery";

export const MAX_PAGE_SIZE = 200;

export const USER_DEFINITIONS: Discovery.Definitions = {
	[USER_SCHEMA]: pickAttributes(USER_DEFINITION, [
		"userName",
		"name.givenName",
		"name.familyName",
		"active",
		"emails.value",
		"emails.primary",
	]),
	[ENTERPRISE_USER_SCHEMA]: pickAttributes(ENTERPRISE_USER_DEFINITION, [
		"department",
	]),
};
```

Put the core schema first: an unqualified name such as `active` resolves against the
definitions in insertion order. The same values build the `/ServiceProviderConfig`,
`/ResourceTypes` and `/Schemas` documents from `@sdxc/scim/discovery`, when a directory asks
for them.

## Create and list users

`readBody` accepts `application/scim+json`, plain JSON or no content type, `parseUser` reads the
User, and `userResource` writes the wire form back.

```typescript {% title="app/http/controllers/scim/users.ts" %}
import { isFailure } from "@sdxc/result";
import * as Scim from "@sdxc/scim";
import { createAction } from "remix/router";

import { scimAuth } from "~/app/http/middleware/scim-auth";
import { Users } from "~/app/models/users";
import { MAX_PAGE_SIZE, USER_DEFINITIONS } from "~/app/services/scim/definitions";
import { findUsers } from "~/app/services/scim/find-users";
import routes from "~/routes/web";

export const create = createAction(routes.scim.users.create, {
	middleware: [scimAuth],
	async handler(ctx) {
		let body = await Scim.readBody(ctx.request);
		if (isFailure(body)) return Scim.errorResponse(body.error);
		let user = Scim.parseUser(body.data);
		if (isFailure(user)) return Scim.errorResponse(user.error);

		let saved = await Users.provision(ctx.db, ctx.directoryId, user.data);
		return Scim.scimResponse(Scim.userResource(saved), { status: 201 });
	},
});

export const list = createAction(routes.scim.users.list, {
	middleware: [scimAuth],
	async handler(ctx) {
		let options = { maxCount: MAX_PAGE_SIZE, attributes: USER_DEFINITIONS };
		let query = Scim.parseListQuery(ctx.url, options);
		if (isFailure(query)) return Scim.errorResponse(query.error);

		let found = await findUsers(ctx.db, ctx.directoryId, query.data.filter);
		if (isFailure(found)) return Scim.errorResponse(found.error);

		let { startIndex, count } = query.data;
		let page = found.data.slice(startIndex - 1, startIndex - 1 + count);
		return Scim.listResponse(
			{ resources: page, totalResults: found.data.length, startIndex },
			(resource) => Scim.project(resource, query.data, USER_DEFINITIONS),
		);
	},
});
```

A directory's first call is usually `filter=userName eq "ada@example.com"`, to find out
whether a person already exists:

```typescript {% title="app/services/scim/find-users.ts" %}
import type { Filter } from "@sdxc/scim/filter";
import type { Database } from "remix/data-table";

import { isFailure, isSuccess, success } from "@sdxc/result";
import { userResource } from "@sdxc/scim";
import { filterToWhere } from "@sdxc/scim/data-table";
import { compileFilter } from "@sdxc/scim/filter";

import { Users } from "~/app/models/users";
import { USER_DEFINITIONS } from "~/app/services/scim/definitions";

const ALLOW = ["userName", "externalId", "emails.value"];
const COLUMNS = { userName: { column: "user_name", caseExact: false } };

export async function findUsers(
	db: Database,
	directoryId: string,
	filter: Filter.Expression | null,
) {
	let matches = filter
		? compileFilter(filter, { definitions: USER_DEFINITIONS, allow: ALLOW })
		: null;
	if (matches && isFailure(matches)) return matches;

	let where = filter ? filterToWhere(filter, COLUMNS) : null;
	let pushed = where && isSuccess(where) ? where.data : null;
	let rows = await Users.list(db, directoryId, pushed);

	let resources = rows.map((user) => userResource(user));
	if (matches && pushed === null) resources = resources.filter(matches.data);
	return success(resources);
}
```

`compileFilter` checks the filter against the definitions and the `allow` list, so a path your
store cannot answer is a `400 invalidFilter`. `filterToWhere` then pushes it into SQL when it
can, and the compiled predicate filters in memory when it cannot, such as for
`emails[type eq "work"]`.

## Patch a user

Directories change people with PATCH, and Okta and Entra ID usually deprovision with it too,
sending `active: false`. Apply the operations to the current wire representation, then store
the result:

```typescript {% title="app/http/controllers/scim/patch-user.ts" %}
import { isFailure } from "@sdxc/result";
import * as Scim from "@sdxc/scim";
import { applyPatch, parsePatch } from "@sdxc/scim/patch";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { scimAuth } from "~/app/http/middleware/scim-auth";
import { Users } from "~/app/models/users";
import { USER_DEFINITIONS } from "~/app/services/scim/definitions";
import routes from "~/routes/web";

export default createAction(routes.scim.users.patch, {
	middleware: [scimAuth],
	async handler(ctx) {
		let { id } = s.parse(s.object({ id: s.string() }), ctx.params);
		let current = await Users.find(ctx.db, ctx.directoryId, id);
		if (current === null)
			return Scim.errorResponse(new Scim.ScimError(404, "No such user."));

		let body = await Scim.readBody(ctx.request);
		if (isFailure(body)) return Scim.errorResponse(body.error);
		let operations = parsePatch(body.data);
		if (isFailure(operations)) return Scim.errorResponse(operations.error);

		let patched = applyPatch(Scim.userResource(current), operations.data, {
			definitions: USER_DEFINITIONS,
		});
		if (isFailure(patched)) return Scim.errorResponse(patched.error);
		let next = Scim.parseUser(patched.data);
		if (isFailure(next)) return Scim.errorResponse(next.error);

		let saved = await Users.replace(ctx.db, ctx.directoryId, id, next.data);
		return Scim.scimResponse(Scim.userResource(saved));
	},
});
```

`applyPatch` applies every operation or none. When `Users.replace` sees `active` turn false,
end that person's sessions there: that is the reason the customer asked for SCIM. Groups
follow the same shape with `parseGroup` and `groupResource`.

## Mount it

Map the routes in your router initializer from
[Wire the router](/docs/building-remix-apps/wire-the-router). Each controller loads through
`lazy()`, so a sign-in never loads the SCIM handlers:

```typescript {% title="app/initializers/router.ts" %}
import { lazy } from "@sdxc/lazy-route";
import { createRouter } from "remix/router";

import routes from "~/routes/web";

export function createWebRouter() {
	let router = createRouter({
		middleware: [
			// your global middleware
		],
	});

	router.map(
		routes.sso.metadata,
		lazy(() => import("~/app/http/controllers/sso/metadata")),
	);
	router.map(
		routes.sso.start,
		lazy(() => import("~/app/http/controllers/sso/start")),
	);
	router.map(
		routes.sso.acs,
		lazy(() => import("~/app/http/controllers/sso/acs")),
	);
	router.map(
		routes.scim.users.list,
		lazy(() => import("~/app/http/controllers/scim/users").then((it) => it.list)),
	);
	router.map(
		routes.scim.users.create,
		lazy(() =>
			import("~/app/http/controllers/scim/users").then((it) => it.create),
		),
	);
	router.map(
		routes.scim.users.patch,
		lazy(() => import("~/app/http/controllers/scim/patch-user")),
	);

	return router;
}
```

## Test the SCIM endpoint

Fetch the router: a SCIM route answers a token that matches no directory with the RFC's error
document:

```typescript {% title="app/http/controllers/scim/users.test.ts" %}
import { beforeAll, expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";
import { migrate } from "~/app/test/database";
import routes from "~/routes/web";

beforeAll(migrate);

function scim(href: string, headers?: HeadersInit) {
	return createWebRouter().fetch(
		new Request(new URL(href, "https://example.com"), { headers }),
	);
}

test("a token that matches no directory is refused", async () => {
	let response = await scim(routes.scim.users.list.href(), {
		Authorization: "Bearer not-a-token",
	});

	expect(response.status).toBe(401);
	expect(await response.json()).toMatchObject({ status: "401" });
});
```

`migrate` is the helper from [Test Workers apps](/docs/operations-and-testing/testing) that
applies your migrations to the in-memory database the test environment binds.

## Where to go next

- [Sign in with OpenID Connect](/docs/identity-and-security/sign-in-with-oidc) — the other
  protocol enterprise directories speak, and the session a sign-in lands in.
- [Query D1 and Durable Object SQL](/docs/data-and-background-work/databases) — the
  database behind the replay store and the `Users` model.
- [`@sdxc/scim`](/api/scim) — groups, discovery documents, every error class, and the filter
  and PATCH reference.
