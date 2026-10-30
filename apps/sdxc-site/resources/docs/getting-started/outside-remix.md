---
title: Use the packages outside Remix
description: Tell from a package's page or manifest whether it needs Remix, then serve a handler built from framework-free packages with Bun and from a Cloudflare Worker.
section:
    title: Packages à la carte
    order: 1.5
order: 3
lastUpdated: 2026-10-25
outcomes:
    - "How to tell from a package's page or manifest whether it needs Remix"
    - "How one `fetch` handler built from framework-free packages runs on Bun and on a Cloudflare Worker"
    - "How to test that handler with Vitest by calling it with a `Request`"
---

Most `@sdxc` packages depend on no framework: they take a `Request`, answer a `Response`, sign
through Web Crypto and return a `Result`, so they run wherever the web platform does. This guide
builds a small token service from three of them: a handler that verifies a bearer token and
publishes the public key, served with `Bun.serve` the same way a Cloudflare Worker serves it.
You end with one handler, a key script, a server and a test, and nothing in them imports Remix.

```bash
npm add @sdxc/jwt @sdxc/response @sdxc/result
```

## Tell whether a package needs Remix

A package built for Remix apps lists `remix` as a peer dependency. The install line on its
[API page](/api) names every required peer, so it reads `npm add @sdxc/markdown remix` for a
package that needs Remix and `npm add @sdxc/jwt` for one that runs anywhere;
`npm view <package> peerDependencies` prints the same from the published manifest.

A few packages, such as `@sdxc/qr`, list `remix` as an optional peer: their main entry runs
anywhere, and only a subpath such as `@sdxc/qr/ui` needs Remix installed beside it.

## Write the handler

The handler is a function from a `Request` to a `Response`, so every runtime serves the same
function. It answers `/me` with the subject of a valid bearer token and
`/.well-known/jwks.json` with the public half of the key, so another service can verify the same
tokens:

```typescript {% title="src/handler.ts" %}
import { JWK, JWT } from "@sdxc/jwt";
import { notFound, ok, unauthorized } from "@sdxc/response";
import { isFailure, wrap } from "@sdxc/result";

export const ISSUER = "https://tokens.example.com";
export const AUDIENCE = "reports-api";

export function createHandler(keys: JWK.KeyPair[]) {
	return async function handle(request: Request): Promise<Response> {
		let url = new URL(request.url);

		if (url.pathname === "/.well-known/jwks.json") {
			return Response.json(JWK.toJSON(keys));
		}

		if (url.pathname !== "/me") return notFound({ error: "Not found" });

		let header = request.headers.get("Authorization") ?? "";
		let verified = await wrap(() =>
			JWT.verify(header.replace(/^Bearer /, ""), keys, {
				issuer: ISSUER,
				audience: AUDIENCE,
				algorithms: [JWK.Algorithm.ES256],
			}),
		);

		if (isFailure(verified)) {
			return unauthorized(
				{ error: "Invalid token" },
				{ headers: { "WWW-Authenticate": 'Bearer error="invalid_token"' } },
			);
		}

		return ok({ subject: verified.data.subject });
	};
}
```

`JWT.verify` checks the signature, expiry, issuer and audience, and rejects on the first one
that fails; `wrap` turns that rejection into a failure value, so every bad token is one branch
that answers `401`. `ok` and `unauthorized` add the `ok` field a client branches on.

## Make a signing key

A script makes an ES256 key pair and prints it as one JSON string, the form the server reads
from its `SIGNING_KEY` secret:

```typescript {% title="scripts/generate-key.ts" %}
import { JWK } from "@sdxc/jwt";

let pair = await JWK.generateKeyPair(JWK.Algorithm.ES256);
process.stdout.write(`${JSON.stringify(pair)}\n`);
```

```bash
bun scripts/generate-key.ts > signing-key.json
```

> [!WARNING]
> `signing-key.json` holds the private key. Anyone who reads it can sign tokens your service
> accepts, so keep it out of the repository and hand it to each runtime as a secret.

## Serve it with Bun

`Bun.serve` takes the handler as its `fetch` option. Top-level `await` imports the key into Web
Crypto once, before the server accepts its first request, and `wrap` turns a malformed secret
into a failure:

```typescript {% title="src/server.ts" %}
import { JWK } from "@sdxc/jwt";
import { isFailure, wrap } from "@sdxc/result";

import { createHandler } from "./handler";

let pair = await wrap(() => JWK.importKeyPair(JSON.parse(Bun.env.SIGNING_KEY ?? "")));
if (isFailure(pair)) throw pair.error;

Bun.serve({ port: 3000, fetch: createHandler([pair.data]) });
```

```bash
SIGNING_KEY="$(cat signing-key.json)" bun src/server.ts
```

From a second terminal, `curl http://localhost:3000/.well-known/jwks.json` returns the
public key another service verifies your tokens with.

> [!NOTE]
> A Cloudflare Worker serves the same handler. It receives `SIGNING_KEY` on the `env` argument of
> its `fetch` method, so it imports the key there and answers with
> `createHandler([pair.data])(request)`. The packages run on the Web Crypto the Workers runtime
> provides, so the Worker needs no compatibility flag.

## Test it

The handler is a plain function, so a Vitest test builds a key pair in memory, signs tokens with
it and calls the handler with a `Request`, with no server running:

```typescript {% title="src/handler.test.ts" %}
import { JWK, JWT } from "@sdxc/jwt";
import { expect, test } from "vitest";

import { AUDIENCE, createHandler, ISSUER } from "./handler";

const KEYS = [
	await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256)),
];
const HANDLE = createHandler(KEYS);

async function me(audience: string) {
	let token = new JWT({ iss: ISSUER, aud: audience, sub: "ada", exp: "15m" });
	let signed = await token.sign(JWK.Algorithm.ES256, KEYS);
	return HANDLE(
		new Request("https://reports.example.com/me", {
			headers: { Authorization: `Bearer ${signed}` },
		}),
	);
}

test("answers with the subject of a valid token", async () => {
	let response = await me(AUDIENCE);

	expect(response.status).toBe(200);
	expect(await response.json()).toMatchObject({ ok: true, subject: "ada" });
});

test("refuses a token issued for another audience", async () => {
	let response = await me("billing");

	expect(response.status).toBe(401);
});

test("publishes the key without its private member d", async () => {
	let response = await HANDLE(
		new Request("https://reports.example.com/.well-known/jwks.json"),
	);
	let { keys } = await response.json();

	expect(keys[0]).not.toHaveProperty("d");
});
```

```bash
npm add -D vitest
npx vitest run
```

## Where to go next

- [Issue and verify JWTs](/docs/identity-and-security/json-web-tokens) — keys kept in R2, key
  rotation and verifying another issuer's tokens.
- [Add packages to an existing app](/docs/getting-started/add-to-an-existing-app) — the module
  settings a project needs, and keeping several packages on one release.
- [`Result` everywhere](/docs/conventions/result-everywhere) — the shape `wrap` produces in every
  step above.
