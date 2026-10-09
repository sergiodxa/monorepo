---
title: Enterprise sign-on with SAML and SCIM
description: Let a customer's directory sign its people in over SAML 2.0 and provision their users and groups over SCIM 2.0.
section:
    title: Identity & security
    order: 5
order: 10
lastUpdated: 2026-10-08
---

The first large customer asks two questions: can our people sign in through our own identity
provider, and will your app know when someone leaves? The first is SAML, where their directory
posts a signed assertion to your app. The second is SCIM, where their directory calls your API
to create, update and deactivate the people and groups it manages.

[`@sdxc/saml`](/api/saml) is the service provider half of SAML 2.0: it builds the
authentication request, verifies the signed response, and reads and writes the metadata the
two sides exchange. [`@sdxc/scim`](/api/scim) is the standard's half of a SCIM 2.0 endpoint:
resources, filters, PATCH and the discovery documents. Routing, storage and authentication
stay in your app, and this guide wires both into a Remix v3 router.

```bash
npm add @sdxc/saml @sdxc/scim @sdxc/result @sdxc/duration @sdxc/crypto \
	@sdxc/http @sdxc/uuid remix
```

## The routes

Every customer gets its own connection, named by a slug. Each connection is a separate
service provider to the customer's directory, with its own entity id, so its URLs carry the
slug. SCIM lives under `/scim/v2`, where the RFC's clients expect it.

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
		discovery: {
			config: get("/scim/v2/ServiceProviderConfig"),
			resourceTypes: get("/scim/v2/ResourceTypes"),
			schemas: get("/scim/v2/Schemas"),
		},
		users: {
			list: get("/scim/v2/Users"),
			create: post("/scim/v2/Users"),
			patch: patch("/scim/v2/Users/:id"),
		},
		groups: { create: post("/scim/v2/Groups") },
	},
});
```

Derive the absolute identifiers from the route table, so the URL your metadata publishes and
the URL an assertion is checked against are one value:

```typescript {% title="app/sso/service-provider.ts" %}
import routes from "~/routes/web";

export function serviceProvider(url: URL, slug: string) {
	return {
		entityId: new URL(routes.sso.metadata.href({ slug }), url).href,
		acs: new URL(routes.sso.acs.href({ slug }), url).href,
	};
}
```

## Configure a connection from the provider's metadata

An administrator on the customer's side hands you their identity provider's metadata, a URL
or an XML file. `parseIdPMetadata` reads the entity id, the sign-on endpoints and the signing
certificates out of it, each certificate already parsed:

```typescript {% title="app/sso/provider-metadata.ts" %}
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

Store every certificate, keyed by `fingerprint`. Providers rotate on their own schedule, and a
response verifies when it matches any certificate you pass, so keeping the old and new ones
side by side makes a rotation a non-event. `notAfter` is what a scheduled job reads to warn an
administrator before an expiry stops sign-ins.

## Publish your own metadata

The other direction: the customer's administrator needs your entity id, your ACS URL and your
certificate. Serve them as a document rather than asking anyone to copy four fields.

```typescript {% title="app/http/controllers/sso/metadata.ts" %}
import { text, xml } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import * as SAML from "@sdxc/saml";
import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { serviceProvider } from "~/app/sso/service-provider";
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

None of the options has a default, so `nameIdFormat: null` (let the provider choose) and
`validUntil: null` are decisions written down. Generate the certificate once, from an RSA key
pair you keep as a secret, with `SAML.Certificate.selfSigned({ keys, commonName, notBefore,
notAfter })` and `toPem()`.

## Start a sign-in

The request id waits in KV while the browser visits the identity provider:

```mermaid {% alt="SAML sign-in: the app signs an AuthnRequest, stores its id in the SSO namespace under the RelayState and redirects to the identity provider, which posts the SAMLResponse back to the ACS route; the app reads and deletes the pending request, verifies the response, starts a session and redirects home" %}
sequenceDiagram
    participant B as Browser
    participant A as App
    participant K as SSO namespace
    participant I as Identity provider
    B->>A: GET /sso/:slug
    Note over A: createAuthnRequest signs the request
    A->>K: Put the request id under RelayState
    A-->>B: Redirect to the provider
    B->>I: Signed AuthnRequest
    I-->>B: Form with SAMLResponse and RelayState
    B->>A: POST /sso/:slug/acs
    Note over B,A: Cross-site, so the Lax cookie stays behind
    A->>K: findPending reads the RelayState
    A->>K: Delete the pending request
    Note over A: verifyResponse checks InResponseTo,<br>signature, audience and replay
    Note over A: startSession
    A-->>B: 303 to home
```

The login form asks for the work email, finds the connection for its domain, and sends the
browser to `routes.sso.start`. `createAuthnRequest` builds the request and signs it with your
private key:

```typescript {% title="app/http/controllers/sso/start.ts" %}
import { redirect, text } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import * as SAML from "@sdxc/saml";
import { generateUUID } from "@sdxc/uuid";
import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { Connections } from "~/app/repositories/connections";
import { signingKey } from "~/app/sso/keys";
import { serviceProvider } from "~/app/sso/service-provider";
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

Remember `request.data.id`: the response has to answer with it, and passing it back as
`inResponseTo` binds the assertion to the browser that asked for it. It is stored under the
`RelayState` rather than in the session, because the response arrives as a cross-site `POST`
and a `SameSite=Lax` session cookie is not sent with it. The `RelayState` comes back in the
form beside the response. `signingKey` imports your PKCS #8 private key with
`crypto.subtle.importKey` for `RSASSA-PKCS1-v1_5` with SHA-256.

## Verify the assertion

The assertion consumer service is the one route where a stranger's XML decides who is signed
in, so everything about it goes through one call. `verifyResponse` refuses a document type
declaration, requires exactly one signature, checks the signature covers the assertion it
returns, and checks `Destination`, `Audience`, `Recipient`, the validity window,
`InResponseTo` and the replay store. Every option is required, so a forgotten audience does not
compile.

```tsx {% title="app/http/controllers/sso/acs.tsx" %}
import { Base64 } from "@sdxc/crypto";
import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import * as SAML from "@sdxc/saml";
import { env } from "cloudflare:workers";
import { createAction } from "remix/router";

import { startSession } from "~/app/http/session";
import { Users } from "~/app/repositories/users";
import { findPending } from "~/app/sso/pending";
import { replayStore } from "~/app/sso/replay-store";
import { serviceProvider } from "~/app/sso/service-provider";
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

`findPending` is yours: it validates the posted `SAMLResponse` and `RelayState` fields,
reads the stored request under the `RelayState` from the `SSO` namespace, and loads the
connection with its certificates parsed by `SAML.Certificate.parse`. The handler deletes that
entry before verifying anything, so each request answers at most one response. A response with
no `RelayState` is a sign-in the provider started; refusing it, as here, is the safe default,
and `inResponseTo: null` is how you accept one once you have decided to.

The failure's `name` is safe to log: no `SAMLError` carries key material or anything the
document supplied beyond a fixed identifier. `UnsupportedFeatureError` names the setting the
customer has to change, such as SHA-1 signatures. Key the account on the `NameID` for this
connection rather than on the email, which the directory may change. For encrypted
assertions, pass your private key imported for `RSA-OAEP` as `decryptionKey`, once with
SHA-1 and once with SHA-256 in an array, since providers use both.

Two more things belong in front of this route. It receives a cross-site `POST`, so exempt it
from Remix's [`cop()`](https://github.com/remix-run/remix/tree/main/packages/cop-middleware)
protection the way you would a webhook. And canonicalizing the document is CPU work over the
whole assertion, so cap the size of the body before it gets here.

## Remember assertions for as long as they are valid

The replay store is two methods. `verifyResponse` calls `remember` only once every other check
has passed, with a TTL covering the rest of the assertion's own window, so a forged document
never fills the table and a stored row outlives exactly the period a captured one could be
replayed.

```typescript {% title="app/sso/replay-store.ts" %}
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

The connection id is part of the key because the provider chooses assertion ids, and two
providers must not collide. A D1 table is consistent where KV is eventually consistent, which
matters for a check whose whole job is to catch the second use. A store that throws surfaces as
`ReplayStoreError`: no verdict was reached, so let the person retry.

## Authenticate the directory

SCIM clients authenticate with a bearer token you issue per directory. Store only its SHA-256
hash, and look the directory up by it:

```typescript {% title="app/http/middleware/scim-auth.ts" %}
import type { Middleware } from "remix/router";

import { Hex, sha256 } from "@sdxc/crypto";
import { isFailure } from "@sdxc/result";
import { errorResponse, ScimError } from "@sdxc/scim";
import { createContextKey } from "remix/router";

import { Directories } from "~/app/repositories/directories";

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

`errorResponse` writes the SCIM error document of RFC 7644 with the
`application/scim+json` type, which is what a directory's client parses. Every failure
`@sdxc/scim` reports is a `ScimError` that `errorResponse` accepts, so all the handlers below
answer the same way.

## Describe what you serve

One set of definitions says which attributes your app models. The `/Schemas` document
advertises it, and filters, PATCH and projection evaluate against it, so what the directory is
told and what the server does cannot disagree.

```typescript {% title="app/scim/definitions.ts" %}
import type { Discovery } from "@sdxc/scim/discovery";

import { ENTERPRISE_USER_SCHEMA, GROUP_SCHEMA, USER_SCHEMA } from "@sdxc/scim";
import {
	ENTERPRISE_USER_DEFINITION,
	GROUP_DEFINITION,
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

export const GROUP_DEFINITIONS: Discovery.Definitions = {
	[GROUP_SCHEMA]: pickAttributes(GROUP_DEFINITION, [
		"displayName",
		"members.value",
	]),
};
```

Put the core schema first: an unqualified name such as `active` resolves against the
definitions in insertion order. The three discovery documents come from the same values:

```typescript {% title="app/http/controllers/scim/discovery.ts" %}
import {
	ENTERPRISE_USER_SCHEMA,
	GROUP_SCHEMA,
	scimResponse,
	USER_SCHEMA,
} from "@sdxc/scim";
import { resourceTypes, schemas, serviceProviderConfig } from "@sdxc/scim/discovery";
import { createController } from "remix/router";

import {
	GROUP_DEFINITIONS,
	MAX_PAGE_SIZE,
	USER_DEFINITIONS,
} from "~/app/scim/definitions";
import routes from "~/routes/web";

const USER_TYPE = {
	id: "User",
	endpoint: "/Users",
	schema: USER_SCHEMA,
	extensions: [{ schema: ENTERPRISE_USER_SCHEMA, required: false }],
};
const GROUP_TYPE = { id: "Group", endpoint: "/Groups", schema: GROUP_SCHEMA };
const BEARER = {
	type: "oauthbearertoken",
	name: "Bearer",
	description: "Per directory.",
};

export default createController(routes.scim.discovery, {
	actions: {
		config: () =>
			scimResponse(
				serviceProviderConfig({
					patch: true,
					filter: { supported: true, maxResults: MAX_PAGE_SIZE },
					sort: false,
					etag: false,
					authenticationSchemes: [BEARER],
				}),
			),
		resourceTypes: () => scimResponse(resourceTypes([USER_TYPE, GROUP_TYPE])),
		schemas: () =>
			scimResponse(
				schemas([
					...Object.values(USER_DEFINITIONS),
					...Object.values(GROUP_DEFINITIONS),
				]),
			),
	},
});
```

These answer without `scimAuth`: a client reads them to negotiate before it presents a token.

## Create and list users

`readBody` accepts `application/scim+json`, plain JSON or no content type, and `parseUser`
reads the User, matching attribute names case-insensitively and typing the Enterprise User
extension. `userResource` writes the wire form back.

```typescript {% title="app/http/controllers/scim/users.ts" %}
import { isFailure } from "@sdxc/result";
import * as Scim from "@sdxc/scim";
import { createAction } from "remix/router";

import { scimAuth } from "~/app/http/middleware/scim-auth";
import { Users } from "~/app/repositories/users";
import { MAX_PAGE_SIZE, USER_DEFINITIONS } from "~/app/scim/definitions";
import { findUsers } from "~/app/scim/find-users";
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

`parseListQuery` clamps `startIndex` and `count` to the ranges the RFC allows and caps `count`
at `maxCount`. `project` applies the `attributes` and `excludedAttributes` a client asked for,
and each attribute's `returned` rule. A directory's first call is usually
`filter=userName eq "ada@example.com"`, to find out whether a person already exists. The
filter is where the two sub-packages meet:

```typescript {% title="app/scim/find-users.ts" %}
import type { Filter } from "@sdxc/scim/filter";
import type { Database } from "remix/data-table";

import { isFailure, isSuccess, success } from "@sdxc/result";
import { userResource } from "@sdxc/scim";
import { filterToWhere } from "@sdxc/scim/data-table";
import { compileFilter } from "@sdxc/scim/filter";

import { Users } from "~/app/repositories/users";
import { USER_DEFINITIONS } from "~/app/scim/definitions";

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

`compileFilter` checks the filter against the definitions and the `allow` list first, so a
path your store cannot answer is a `400 invalidFilter` rather than a silent full list. Then
`filterToWhere` tries to turn it into a `remix/data-table` predicate. It fails with
`UntranslatableFilterError` for what SQL cannot express exactly, such as a value path like
`emails[type eq "work"]` or a column you did not map, and the compiled predicate filters in
memory instead. `userName` is `caseExact: false` in the RFC, so its column folds case through
`ilike`, and `userName eq "Ada@Example.com"` finds `ada@example.com` either way.

## Patch a user

Directories change people with PATCH, and they deprovision with it too: Okta and Entra ID
usually send `active: false` rather than a `DELETE`. Apply the operations to the current wire
representation, then store the result the way a replace would:

```typescript {% title="app/http/controllers/scim/patch-user.ts" %}
import { isFailure } from "@sdxc/result";
import * as Scim from "@sdxc/scim";
import { applyPatch, parsePatch } from "@sdxc/scim/patch";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { scimAuth } from "~/app/http/middleware/scim-auth";
import { Users } from "~/app/repositories/users";
import { USER_DEFINITIONS } from "~/app/scim/definitions";
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

		let definitions = USER_DEFINITIONS;
		let patched = applyPatch(Scim.userResource(current), operations.data, {
			definitions,
		});
		if (isFailure(patched)) return Scim.errorResponse(patched.error);
		let next = Scim.parseUser(patched.data);
		if (isFailure(next)) return Scim.errorResponse(next.error);

		let saved = await Users.replace(ctx.db, ctx.directoryId, id, next.data);
		return Scim.scimResponse(Scim.userResource(saved));
	},
});
```

`applyPatch` applies every operation or none, and reports `noTarget`, `mutability` and
`invalidPath` as the RFC names them. Where an attribute is a boolean, it reads Entra ID's
`"False"` string as `false`. When `Users.replace` sees `active` turn false, end that person's
sessions there: that is the reason the customer asked for SCIM.

## Groups

Groups follow the same shape with `parseGroup` and `groupResource`. A member's `value` is the
`id` your user resource answered with, and membership changes arrive as PATCH operations on
`members`, applied with `applyPatch` against `GROUP_DEFINITIONS`.

```typescript {% title="app/http/controllers/scim/groups.ts" %}
import { isFailure } from "@sdxc/result";
import * as Scim from "@sdxc/scim";
import { createAction } from "remix/router";

import { scimAuth } from "~/app/http/middleware/scim-auth";
import { Groups } from "~/app/repositories/groups";
import routes from "~/routes/web";

export const create = createAction(routes.scim.groups.create, {
	middleware: [scimAuth],
	async handler(ctx) {
		let body = await Scim.readBody(ctx.request);
		if (isFailure(body)) return Scim.errorResponse(body.error);
		let group = Scim.parseGroup(body.data);
		if (isFailure(group)) return Scim.errorResponse(group.error);

		let saved = await Groups.create(ctx.db, ctx.directoryId, group.data);
		return Scim.scimResponse(Scim.groupResource(saved), { status: 201 });
	},
});
```

## Mount it

Map the routes in the composition root from
[Wire the router](/docs/building-remix-apps/wire-the-router), next to the rest of your app:

```typescript {% title="bootstrap/enterprise.ts" %}
import type { createRouter } from "remix/router";

import discovery from "~/app/http/controllers/scim/discovery";
import * as groups from "~/app/http/controllers/scim/groups";
import patchUser from "~/app/http/controllers/scim/patch-user";
import * as users from "~/app/http/controllers/scim/users";
import acs from "~/app/http/controllers/sso/acs";
import metadata from "~/app/http/controllers/sso/metadata";
import start from "~/app/http/controllers/sso/start";
import routes from "~/routes/web";

export function mapEnterprise(router: ReturnType<typeof createRouter>) {
	router.map(routes.sso.metadata, metadata);
	router.map(routes.sso.start, start);
	router.map(routes.sso.acs, acs);
	router.map(routes.scim.discovery, discovery);
	router.map(routes.scim.users.list, users.list);
	router.map(routes.scim.users.create, users.create);
	router.map(routes.scim.users.patch, patchUser);
	router.map(routes.scim.groups.create, groups.create);
}
```

Reading, replacing and deleting a user or a group are the same calls in a different order:
`parseUser` or `parseGroup` for a `PUT`, and a `204` for a `DELETE`. Directories retry
eagerly, so give the SCIM routes a rate limit of their own, keyed on the token's hash.

## Where to go next

- [Sign in with OpenID Connect](/docs/identity-and-security/sign-in-with-oidc) — the other
  protocol enterprise directories speak, and the session a sign-in lands in.
- [Validate forms and route params](/docs/building-remix-apps/forms-and-params) — reading
  the posted `SAMLResponse` and `RelayState` fields in `findPending`.
- [Query D1 and Durable Object SQL](/docs/data-and-background-work/databases) — the
  database behind the replay store and the `Users` repository.
- [`@sdxc/saml`](/api/saml) and [`@sdxc/scim`](/api/scim) — every error class, and the
  filter, PATCH and discovery reference.
