---
title: Sign in with OpenID Connect
description: An authorization-code login against any OpenID Connect provider, with a KV-backed session and a return URL that stays on your origin.
section:
    title: Identity & security
    order: 6
order: 1
lastUpdated: 2026-10-25
outcomes:
    - "How to run an authorization-code login with `@sdxc/auth` against any OpenID Connect provider"
    - "How to keep the login in a KV session and verify the ID token in the callback"
    - "How to sign out on both sides and keep the return URL on your origin"
---

This guide adds "sign in with your provider" to a Remix v3 app on Workers: a login route that
sends the browser to the provider, a callback that verifies the ID token before believing a
single claim, and a logout that ends the session on both sides.
[`@sdxc/auth`](/api/auth) runs the protocol and
[`@sdxc/session-storage-kv`](/api/session-storage-kv) keeps the session in Workers KV.

```bash
npm add @sdxc/auth @sdxc/cache @sdxc/http @sdxc/jwt @sdxc/location @sdxc/result \
	@sdxc/session-storage-kv remix
```

## Declare the routes

Login and logout are forms, so no link on another site can start one on a visitor's behalf.
The callback is a `GET`, which is how the provider sends the browser back.

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

The flow keeps `state`, the `nonce`, the PKCE verifier and then the token set in the session
Remix's session middleware puts on the context, so the session has to exist before any auth
route runs. `KVSessionStorage` keeps the values in KV while the cookie carries only the id:

```typescript {% title="app/initializers/router.ts" %}
import { KVSessionStorage } from "@sdxc/session-storage-kv";
import { env } from "cloudflare:workers";
import { asyncContext } from "remix/middleware/async-context";
import { session } from "remix/middleware/session";
import { createRouter } from "remix/router";

import { authenticate } from "~/app/http/middleware/auth";
import { sessionCookie } from "~/app/initializers/cookies";

const SESSIONS = new KVSessionStorage(env.SESSIONS, { ttlSeconds: "30 days" });

export function createWebRouter() {
	let router = createRouter({
		middleware: [asyncContext(), session(sessionCookie, SESSIONS), authenticate],
	});
	// router.map(…) for each route
	return router;
}
```

`sessionCookie` is your app's signed session cookie, made with `createCookie` from
`remix/cookie`. `authenticate` is defined at the end of this guide.

> [!NOTE]
> Give the session cookie `sameSite: "Lax"`. The callback is a top-level navigation from the
> provider's origin, which a `Strict` cookie stays off, so every callback would find no
> transaction.

## Describe the provider

An `Issuer` holds the provider's discovery document and its signing keys. `Issuer.for` shares
one instance per isolate, and the `cache` shares the documents across isolates so a cold start
reads KV instead of the provider.

```typescript {% title="app/initializers/issuer.ts" %}
import { Issuer } from "@sdxc/auth/issuer";
import { WorkerKVCache } from "@sdxc/cache/worker-kv";
import { env } from "cloudflare:workers";

export function issuer(): Issuer {
	return Issuer.for("https://auth.example.com", {
		cache: () => new WorkerKVCache(env.CACHE),
	});
}
```

## Build the relying party

The relying party is your app as the provider's client. It is built per request because the
callback URL is derived from the origin the request arrived on.

```typescript {% title="app/initializers/relying-party.ts" %}
import { RelyingParty } from "@sdxc/auth/relying-party";
import { JWK } from "@sdxc/jwt";
import { env } from "cloudflare:workers";

import { issuer } from "~/app/initializers/issuer";
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

`algorithms` pins what an ID token may be signed with, so a token signed any other way is
refused even if a matching key turns up. `fallbackReturnTo` is where a login lands when it
names no destination, or names one on another origin.

## Start the login

The login controller renders the page on `GET` and hands off to the provider on `POST`.
`contextOf(ctx)` pairs the request with the session, the shape every browser-flow method takes.

```tsx {% title="app/http/controllers/auth/login.tsx" %}
import { contextOf } from "@sdxc/auth/remix/context";
import { createController } from "remix/router";

import { relyingParty } from "~/app/initializers/relying-party";
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

`authorize` mints `state`, the `nonce` and the PKCE verifier, stores them in the session, and
answers the `303` to the provider. It holds the `next` parameter to your origin before storing
it.

## Finish it in the callback

`callback` spends the transaction, exchanges the code, verifies the ID token's signature,
issuer, audience, expiry and nonce, rotates the session id and writes the token set. Every way
it can refuse is a thrown `AuthError`, which `wrap` turns into a `Result`.

```tsx {% title="app/http/controllers/auth/callback.tsx" %}
import { AuthError } from "@sdxc/auth/auth-error";
import { contextOf } from "@sdxc/auth/remix/context";
import { redirect } from "@sdxc/http/response";
import { Location } from "@sdxc/location";
import { isFailure, wrap } from "@sdxc/result";
import { createAction } from "remix/router";

import { relyingParty } from "~/app/initializers/relying-party";
import { Users } from "~/app/models/users";
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

> [!WARNING]
> Key the account on `grant.subject`, never on email or username. Those are mutable at the
> provider, so someone who takes over an address there would sign in to the account it used to
> name; the subject is the one claim OpenID Connect promises stays with the person.

Passing `grant.returnTo` through `Location.safe` again at the redirect keeps it on your origin
in the one line that writes the `Location` header. `AuthError.code` names the step that failed,
such as `state_mismatch`, so the log says which while the visitor reads one message.

## Sign out on both sides

The provider has a session of its own and would sign the person straight back in.
`endSession` hands the browser to the provider's logout endpoint to end it too.

```tsx {% title="app/http/controllers/auth/logout.tsx" %}
import { contextOf } from "@sdxc/auth/remix/context";
import { redirect } from "@sdxc/http/response";
import { isFailure, wrap } from "@sdxc/result";
import { createController } from "remix/router";
import { Session } from "remix/session";

import { relyingParty } from "~/app/initializers/relying-party";
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

`redirect: false` makes `endSession` answer the provider's URL. The local session is destroyed
whatever the provider answers, so a provider without a logout endpoint still signs the person
out here.

## Know who is signed in

`sessionScheme` renews tokens that have lapsed, then asks your `verify` who the session belongs
to; answering `null` treats the request as signed out.

```typescript {% title="app/http/middleware/auth.ts" %}
import type { Middleware } from "remix/router";

import { sessionScheme } from "@sdxc/auth/remix/schemes";
import { auth } from "remix/middleware/auth";

import { relyingParty } from "~/app/initializers/relying-party";
import { Users } from "~/app/models/users";

export const authenticate: Middleware = (ctx, next) => {
	let scheme = sessionScheme(relyingParty(ctx.url), {
		verify: (session) => Users.findBySubject(ctx.db, session.idToken.subject),
	});

	return auth({ schemes: [scheme] })(ctx, next);
};
```

Protecting routes with the account it resolves is Remix's
[auth middleware](https://github.com/remix-run/remix/tree/main/packages/auth-middleware).

## Test the login

Starting a login needs the provider's discovery document, so answer it with MSW. A callback
nobody started is refused before the provider is asked:

```typescript {% title="app/http/controllers/auth/login.test.ts" %}
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";
import routes from "~/routes/web";

let server = setupServer(
	http.get("https://auth.example.com/.well-known/openid-configuration", () =>
		HttpResponse.json({
			issuer: "https://auth.example.com",
			authorization_endpoint: "https://auth.example.com/authorize",
			token_endpoint: "https://auth.example.com/token",
			jwks_uri: "https://auth.example.com/jwks",
		}),
	),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test("sends the browser to the provider with PKCE", async () => {
	let response = await createWebRouter().fetch(
		new Request(new URL(routes.auth.login.action.href(), "https://example.com"), {
			method: "POST",
		}),
	);

	expect(response.status).toBe(303);
	let location = new URL(response.headers.get("Location") ?? "");
	expect(location.origin + location.pathname).toBe(
		"https://auth.example.com/authorize",
	);
	expect(location.searchParams.get("code_challenge_method")).toBe("S256");
});

test("refuses a callback this browser never started", async () => {
	let response = await createWebRouter().fetch(
		new URL(
			`${routes.auth.callback.href()}?code=abc&state=xyz`,
			"https://example.com",
		),
	);

	expect(await response.text()).toContain("Sign-in failed");
});
```

The router reads `SESSIONS` and `CACHE`, so declare both as `createKVNamespace()` in
`app/test/cloudflare-workers.ts`, beside `CLIENT_ID` and `CLIENT_SECRET`.

## Where to go next

- [Add passkeys](/docs/identity-and-security/passkeys) — a second way in that needs no provider.
- [Security headers and CSP](/docs/identity-and-security/security-headers) — allow the
  provider in `form-action` before you enforce a policy.
- [`@sdxc/auth`](/api/auth) — step-up authentication, service clients and bearer tokens.
