---
title: Accept Privacy Pass tokens instead of a CAPTCHA
description: Challenge clients with WWW-Authenticate PrivateToken, redeem the tokens an issuer signed for them, and show a CAPTCHA only to clients that hold none.
section:
    title: Identity & security
    order: 6
order: 17
lastUpdated: 2026-10-25
outcomes:
    - "How to challenge a client for a Privacy Pass token and redeem the one it sends back"
    - "Where to keep issued challenges and spent tokens so a token is spent once"
    - "When to gate a route on tokens alone and when to fall back to a CAPTCHA widget"
---

A CAPTCHA asks every visitor to prove they are a person, every time. Many already have: the
device they browse on attested them to an issuer, which handed them tokens that say "someone I
trust" and nothing else. Privacy Pass lets your origin ask for one of those tokens with a
`401` and a `WWW-Authenticate: PrivateToken` challenge; the client fetches a token from the
issuer and retries with it in `Authorization`. Your app learns that the issuer vouched for the
client, the issuer never learns which site the token was spent at, and nobody solves a puzzle.

This guide gates a search page that scrapers hammer. A client holding tokens sees the results
straight away; any other client gets the same `401` with a CAPTCHA form in its body, and an API
route answers to tokens alone. [`@sdxc/privacy-pass`](/api/privacy-pass) writes the challenge,
reads the issuer's keys and redeems tokens, answering a [`@sdxc/result`](/api/result) for every
call. [`@sdxc/captcha`](/api/captcha) carries the token check into its `captcha()` middleware and
serves the widget for everyone else.

```bash
npm add @sdxc/captcha @sdxc/lazy-route @sdxc/privacy-pass @sdxc/result remix
```

## Keep spent tokens in shared storage

Each token answers one challenge once, so the origin remembers the challenges it issued until
they expire, and the nonces of tokens already spent. `RedemptionStore` is those three calls;
back it with KV, so every isolate of the Worker reads the same state:

```typescript {% title="app/models/redemptions.ts" %}
import type { RedemptionStore } from "@sdxc/privacy-pass";

const MIN_KV_TTL = 60;

export class KVRedemptionStore implements RedemptionStore {
	#kv: KVNamespace;

	constructor(kv: KVNamespace) {
		this.#kv = kv;
	}

	async saveChallenge(digest: string, ttl: number): Promise<void> {
		await this.#kv.put(`challenge:${digest}`, "1", {
			expirationTtl: Math.max(ttl, MIN_KV_TTL),
		});
	}

	async takeChallenge(digest: string): Promise<boolean> {
		let found = (await this.#kv.get(`challenge:${digest}`)) !== null;
		if (found) await this.#kv.delete(`challenge:${digest}`);
		return found;
	}

	async spendNonce(nonce: string, ttl: number): Promise<boolean> {
		if ((await this.#kv.get(`nonce:${nonce}`)) !== null) return false;
		await this.#kv.put(`nonce:${nonce}`, "1", {
			expirationTtl: Math.max(ttl, MIN_KV_TTL),
		});
		return true;
	}
}
```

KV takes an `expirationTtl` of 60 seconds or more, so a shorter `ttl` is raised to that floor;
the origin refuses an expired challenge on its own `max-age` regardless.

> [!WARNING]
> KV is eventually consistent, so two requests racing with one valid token can both pass; a
> forged token still fails at the signature. Back the store with a Durable Object, whose storage
> serializes the read and the write, where a double spend costs you something.

## Configure the origin

One `PrivacyPass` serves one issuer: the challenges it writes name that issuer, and it reads the
issuer's keys from `https://<issuer>/.well-known/private-token-issuer-directory` on first use,
keeping them for the directory's `Cache-Control: max-age`. Build it once in an initializer, so
every request shares the cached keys:

```typescript {% title="app/initializers/privacy-pass.ts" %}
import { PrivacyPassCaptcha } from "@sdxc/captcha/privacy-pass";
import { PrivacyPass } from "@sdxc/privacy-pass";
import { env } from "cloudflare:workers";

import { KVRedemptionStore } from "~/app/models/redemptions";

export const privacyPass = new PrivacyPass({
	issuer: "demo-pat.issuer.cloudflare.com",
	originInfo: ["search.example.com"],
	store: new KVRedemptionStore(env.PRIVACY_PASS),
	maxAge: "5 minutes",
});

export const tokenCaptcha = new PrivacyPassCaptcha(privacyPass);
```

`PRIVACY_PASS` is a KV namespace binding. `originInfo` lists the origins a token may be spent
at, so a token minted for this challenge is worthless elsewhere. Pick the issuer your
visitors' clients already talk to. Each challenge carries random bytes saved for `maxAge`, so
a token answers one challenge once.

## Gate an API route on tokens alone

A route that no person fills in, such as a JSON search endpoint, takes tokens and nothing else.
`PrivacyPassCaptcha` is a `Captcha` provider, so `captcha()` from `@sdxc/captcha/middleware`
reads the `PrivateToken` credentials from `Authorization`, redeems them, and answers a missing
or refused token with a `401` carrying a fresh challenge:

```typescript {% title="app/initializers/router.ts" %}
import { captcha } from "@sdxc/captcha/middleware";
import { lazy } from "@sdxc/lazy-route";
import { createRouter } from "remix/router";

import { searchChallenge } from "~/app/http/middleware/private-token";
import { productionCaptcha } from "~/app/initializers/captcha";
import { tokenCaptcha } from "~/app/initializers/privacy-pass";
import routes from "~/routes/web";

export function createWebRouter(widget = productionCaptcha()) {
	let router = createRouter();

	router.map(
		routes.api.search,
		lazy(
			() => import("~/app/http/controllers/api/search"),
			[captcha(tokenCaptcha)],
		),
	);
	router.map(
		routes.search.index,
		lazy(
			() => import("~/app/http/controllers/search").then((it) => it.index),
			[searchChallenge],
		),
	);
	router.map(
		routes.search.action,
		lazy(
			() => import("~/app/http/controllers/search").then((it) => it.action),
			[captcha(widget)],
		),
	);

	return router;
}
```

A client holding tokens answers the `401` by retrying with one, and the retry reaches the
controller. `productionCaptcha()` is the Turnstile provider from
[Protect forms from bots and abuse](/docs/identity-and-security/protect-forms), passed in so a
test hands in its own. When the issuer's keys cannot be read to write a challenge, the refusal
is a plain `403`.

## Show the CAPTCHA to everyone else

A page a person loads needs an answer for clients without tokens too. Redeem the token first;
when that fails, render the CAPTCHA form and send it with the challenge, so one response serves
both kinds of client:

```typescript {% title="app/http/middleware/private-token.ts" %}
import type { Middleware } from "remix/router";

import { isFailure } from "@sdxc/result";

import { renderSearchForm } from "~/app/http/controllers/search";
import { privacyPass } from "~/app/initializers/privacy-pass";

export const searchChallenge: Middleware = async (ctx, next) => {
	let redeemed = await privacyPass.redeem(ctx.request.headers.get("Authorization"));
	if (!isFailure(redeemed)) return next();

	let page = await renderSearchForm(ctx);
	let challenge = await privacyPass.challenge();
	if (isFailure(challenge)) return page;

	let headers = new Headers(page.headers);
	headers.set("WWW-Authenticate", challenge.data);
	return new Response(page.body, { status: 401, headers });
};
```

`redeem` checks the issuer's signature before it touches the store, so a forged token consumes
no challenge. `renderSearchForm` is your own controller function rendering the query box with
the `TurnstileWidget`, posting to `routes.search.action`, which `captcha(widget)` guards. An
issuer outage leaves `challenge` failing, and the middleware then serves the form alone, so
the page keeps working with the widget as its only check.

## Test the gate

Build the router with `testCaptcha()` and answer the issuer directory with MSW.
`@sdxc/privacy-pass/testing` stands in for the issuer: `createTestIssuer()` makes a key,
`issuerDirectoryResponse` serves it, and `answerChallenge` writes the `Authorization` a client
holding tokens retries with. With the directory down, no challenge can be written, which drives
both fallbacks:

```typescript {% title="app/http/controllers/search.test.ts" %}
import {
	answerChallenge,
	createTestIssuer,
	issuerDirectoryResponse,
} from "@sdxc/privacy-pass/testing";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";

import { testCaptcha } from "~/app/initializers/captcha";
import { createWebRouter } from "~/app/initializers/router";
import routes from "~/routes/web";

const DIRECTORY =
	"https://demo-pat.issuer.cloudflare.com/.well-known/private-token-issuer-directory";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function visit(path: string, authorization?: string) {
	let headers = authorization ? { Authorization: authorization } : undefined;
	return createWebRouter(testCaptcha()).fetch(
		new Request(new URL(path, "https://search.example.com"), { headers }),
	);
}

test("the page serves the CAPTCHA form while the issuer is down", async () => {
	server.use(http.get(DIRECTORY, () => HttpResponse.text("down", { status: 503 })));

	let response = await visit(routes.search.index.href());

	expect(response.status).toBe(200);
	expect(response.headers.has("WWW-Authenticate")).toBe(false);
});

test("the API refuses a request without a token", async () => {
	server.use(http.get(DIRECTORY, () => HttpResponse.text("down", { status: 503 })));

	let response = await visit(routes.api.search.href());

	expect(response.status).toBe(403);
});

test("a client holding a token reaches the results", async () => {
	let issuer = await createTestIssuer();
	server.use(http.get(DIRECTORY, () => issuerDirectoryResponse(issuer)));

	let challenged = await visit(routes.search.index.href());
	let header = challenged.headers.get("WWW-Authenticate") ?? "";
	let response = await visit(
		routes.search.index.href(),
		await answerChallenge(issuer, header),
	);

	expect(challenged.status).toBe(401);
	expect(response.status).toBe(200);
});
```

> [!NOTE]
> `privacyPass` reads the directory once and keeps the keys for its `max-age`, so the test that
> serves a working issuer runs last, after the ones that need it down.

Add `PRIVACY_PASS` to `app/test/cloudflare-workers.ts` beside the other KV namespaces, so the
initializer finds its binding.

## Where to go next

- [Protect forms from bots and abuse](/docs/identity-and-security/protect-forms) — the
  honeypot, budget and widget that stay in front of the form.
- [Fetch URLs a stranger chose](/docs/identity-and-security/fetch-untrusted-urls) — the checks
  every issuer directory fetch runs through.
- [`@sdxc/privacy-pass`](/api/privacy-pass) — every error code, the issuer directory and the
  wire-format helpers.
