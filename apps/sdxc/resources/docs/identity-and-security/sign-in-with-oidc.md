---
title: Sign in with OpenID Connect
description: An authorization-code login against any OpenID Connect provider, with a KV-backed session and a return URL that stays on your origin.
section:
    title: Identity & security
    order: 5
order: 1
lastUpdated: 2026-09-29
---

This guide adds "sign in with your provider" to a Remix v3 app on Workers: a login route that
sends the browser to the provider, a callback that verifies the ID token before believing a
single claim, and a logout that ends the session on both sides.
[`@sdxc/auth`](/api/auth) runs the protocol, [`@sdxc/jwt`](/api/jwt) names the signature
algorithms you accept, [`@sdxc/session-storage-kv`](/api/session-storage-kv) keeps the session
in Workers KV, [`@sdxc/location`](/api/location) keeps redirects on your origin, and
[`@sdxc/result`](/api/result) turns the flow's throws into values.

```bash
npm add @sdxc/auth @sdxc/jwt @sdxc/session-storage-kv @sdxc/location \
	@sdxc/result @sdxc/http @sdxc/cache
```

## Declare the routes

Login and logout are forms, so a login starts from a `POST` and no link on another site can
start one on a visitor's behalf. The callback is a `GET`, which is how the provider sends the
browser back.

```typescript {% title="routes/auth.ts" %}
import { form, get, route } from "remix/routes";

export default route({
	login: form("/login"),
	logout: form("/logout"),
	callback: get("/auth/callback"),
});
```

The rest of this guide reads it as `routes.auth` from your route table in `routes/web.ts`,
beside the `home` and `dashboard` pages a login returns to.

## Keep the login in a KV session

The flow writes `state`, the `nonce` and the PKCE verifier between the login and the callback,
then the token set it received. `@sdxc/auth` reads and writes all of it through the session
Remix's session middleware puts on the context, so the session has to exist before any auth
route runs. `KVSessionStorage` keeps its values in Workers KV while the cookie carries only the
id:

```typescript {% title="bootstrap/middleware.ts" %}
import { KVSessionStorage } from "@sdxc/session-storage-kv";
import { env } from "cloudflare:workers";
import { asyncContext } from "remix/middleware/async-context";
import { session } from "remix/middleware/session";

import { sessionCookie } from "~/app/http/cookies";
import { authenticate } from "~/app/http/middleware/auth";

const SESSIONS = new KVSessionStorage(env.SESSIONS, { ttlSeconds: "30 days" });

export const GLOBAL_MIDDLEWARE = [
	asyncContext(),
	session(sessionCookie, SESSIONS),
	authenticate,
];
```

`sessionCookie` is your app's signed session cookie, made with `createCookie` from
`remix/cookie`; see Remix's
[session middleware](https://github.com/remix-run/remix/tree/main/packages/session-middleware)
for its options. Give it `sameSite: "Lax"`: the callback is a top-level navigation from the
provider's origin, and a `Strict` cookie would not ride along with it, so every callback would
find no transaction. `authenticate` is defined at the end of this guide.

## Describe the provider

An `Issuer` holds the provider's discovery document and its signing keys. `Issuer.for` hands
the same instance to every caller in the isolate, so the documents are fetched once, and a
`cache` shares them across isolates so a cold start reads KV instead of the provider.

```typescript {% title="app/auth/issuer.ts" %}
import { Issuer } from "@sdxc/auth/issuer";
import { WorkerKVCache } from "@sdxc/cache/worker-kv";
import { env } from "cloudflare:workers";

export function issuer(): Issuer {
	return Issuer.for("https://auth.example.com", {
		cache: () => new WorkerKVCache(env.CACHE),
	});
}
```

The cache is written as a factory because it is resolved on every read, so an instance that
outlives a request never holds a binding that belonged to it.

## Build the relying party

The relying party is your app as the provider's client. It is built per request because the
callback URL is derived from the origin the request arrived on, so a preview deploy and
production each present the URL they are registered under.

```typescript {% title="app/auth/relying-party.ts" %}
import { RelyingParty } from "@sdxc/auth/relying-party";
import { JWK } from "@sdxc/jwt";
import { env } from "cloudflare:workers";

import { issuer } from "~/app/auth/issuer";
import routes from "~/routes/web";

export function relyingParty(url: URL): RelyingParty {
	return new RelyingParty(issuer(), {
		clientId: env.CLIENT_ID,
		clientSecret: env.CLIENT_SECRET,
		redirectUri: new URL(routes.auth.callback.href(), url),
		clientAuth: "client_secret_basic",
		algorithms: [JWK.Algorithm.ES256],
		fallbackReturnTo: routes.dashboard.href(),
	});
}
```

`algorithms` pins what an ID token may be signed with. Left out, it accepts whatever the key
set supports; naming the one algorithm your provider uses means a token signed any other way
is refused even if a matching key turns up. `fallbackReturnTo` is where a login lands when it
names no destination, or names one on another origin. The default mapped profile carries
`name`, `email`, `emailVerified`, `username` and `picture`; pass `mapProfile` to shape it into
your own account fields.

## Start the login

The login controller renders the page on `GET` and hands off to the provider on `POST`.
`contextOf(ctx)` pairs the request with the session the middleware stored, which is the shape
every browser-flow method takes.

```tsx {% title="app/http/controllers/auth/login.tsx" %}
import { contextOf } from "@sdxc/auth/remix/context";
import { createController } from "remix/router";

import { relyingParty } from "~/app/auth/relying-party";
import { LoginPage } from "~/resources/views/login";
import routes from "~/routes/web";

export default createController(routes.auth.login, {
	actions: {
		index(ctx) {
			return ctx.render(<LoginPage />);
		},

		action(ctx) {
			return relyingParty(ctx.url).authorize(contextOf(ctx), {
				returnTo: ctx.url.searchParams.get("next"),
			});
		},
	},
});
```

`authorize` mints `state`, the `nonce` and the PKCE verifier, writes them to the session as one
transaction, and answers the `303` to the provider. The `next` parameter arrives from the
browser, so `authorize` resolves it through `Location.safe` before storing it: anything naming
another origin becomes `fallbackReturnTo`.

## Finish it in the callback

`callback` spends the transaction, exchanges the code, verifies the ID token's signature,
issuer, audience, expiry and nonce, rotates the session id and writes the token set. Every way
it can refuse is a thrown `AuthError`, so `wrap` turns the call into a `Result` and the handler
keeps one shape.

```tsx {% title="app/http/controllers/auth/callback.tsx" %}
import { AuthError } from "@sdxc/auth/auth-error";
import { contextOf } from "@sdxc/auth/remix/context";
import { redirect } from "@sdxc/http/response";
import { Location } from "@sdxc/location";
import { isFailure, wrap } from "@sdxc/result";
import { createAction } from "remix/router";

import { relyingParty } from "~/app/auth/relying-party";
import { Users } from "~/app/repositories/users";
import { LoginPage } from "~/resources/views/login";
import routes from "~/routes/web";

export default createAction(routes.auth.callback, async (ctx) => {
	let result = await wrap(() => relyingParty(ctx.url).callback(contextOf(ctx)));

	if (isFailure(result)) {
		let code = result.error instanceof AuthError ? result.error.code : null;
		ctx.log.warn("auth.callback_failed", { code });
		return ctx.render(<LoginPage error="Sign-in failed. Please try again." />);
	}

	let grant = result.data;
	await Users.upsertFromLogin(ctx.db, grant.subject, grant.profile);

	let returnTo = Location.safe(grant.returnTo, {
		fallback: routes.dashboard.href(),
	});
	return redirect(returnTo, { status: redirect.Status.SeeOther });
});
```

Key the account on `grant.subject`. Email and username are mutable at the provider; the subject
is the one claim OpenID Connect promises stays with the person. The session needs nothing more
from you: `callback` already wrote the token set, and `sessionScheme` resolves the account from
it at the end of this guide. `grant.returnTo` was already
held to your origin when the login stored it, and passing it through `Location.safe` again at
the redirect keeps that guarantee in the one line that writes the `Location` header.

`AuthError.code` separates the causes — `missing_transaction` for a callback nobody started
from this browser, `state_mismatch`, `nonce_mismatch`, `authorization_failed` when the provider
itself refused — so the log says which step failed while the visitor reads one message.

## Sign out on both sides

Destroying your own session signs the person out of your app, but the provider still has a
session of its own and would sign them straight back in. `endSession` hands the browser to the
provider's logout endpoint with the `id_token_hint` that names that session.

```tsx {% title="app/http/controllers/auth/logout.tsx" %}
import { contextOf } from "@sdxc/auth/remix/context";
import { redirect } from "@sdxc/http/response";
import { isFailure, wrap } from "@sdxc/result";
import { createController } from "remix/router";
import { Session } from "remix/session";

import { relyingParty } from "~/app/auth/relying-party";
import { LogoutPage } from "~/resources/views/logout";
import routes from "~/routes/web";

export default createController(routes.auth.logout, {
	actions: {
		index(ctx) {
			return ctx.render(<LogoutPage />);
		},

		async action(ctx) {
			let ended = await wrap(() =>
				relyingParty(ctx.url).endSession(contextOf(ctx), {
					returnTo: routes.home.href(),
					redirect: false,
				}),
			);

			ctx.get(Session)?.destroy();

			let target = isFailure(ended) ? routes.home.href() : ended.data;
			return redirect(target, { status: redirect.Status.SeeOther });
		},
	},
});
```

`redirect: false` makes `endSession` answer the provider's URL instead of a response, so you
write the redirect yourself. The local session is destroyed whatever the provider answers, so
a provider without a logout endpoint still signs the person out here.

## Know who is signed in

`sessionScheme` is the scheme `remix/middleware/auth` resolves a signed-in request through. It
renews tokens that have lapsed, then asks your `verify` who the session belongs to; answering
`null` treats the request as signed out.

```typescript {% title="app/http/middleware/auth.ts" %}
import type { Middleware } from "remix/router";

import { sessionScheme } from "@sdxc/auth/remix/schemes";
import { auth } from "remix/middleware/auth";

import { relyingParty } from "~/app/auth/relying-party";
import { Users } from "~/app/repositories/users";

export const authenticate: Middleware = (ctx, next) => {
	let scheme = sessionScheme(relyingParty(ctx.url), {
		verify: (session) => Users.findBySubject(ctx.db, session.idToken.subject),
	});

	return auth({ schemes: [scheme] })(ctx, next);
};
```

It is built per request because the relying party is. Protecting routes with the account it
resolves is Remix's
[auth middleware](https://github.com/remix-run/remix/tree/main/packages/auth-middleware).

## Where to go next

- [Add passkeys](/docs/identity-and-security/passkeys) — a second way in that needs no provider.
- [Security headers and CSP](/docs/identity-and-security/security-headers) — allow the
  provider in `form-action` before you enforce a policy.
- [Wire the router](/docs/building-remix-apps/wire-the-router) — publishing `ctx.db` and
  `ctx.log`, which these handlers read.
- [`@sdxc/auth`](/api/auth) — step-up authentication, service clients and bearer tokens.
