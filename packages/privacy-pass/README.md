# @sdxc/privacy-pass

Privacy Pass for origins: PrivateToken challenges, token redemption and Blind RSA verification.

An origin challenges a client with `WWW-Authenticate: PrivateToken`, the client fetches a token
from an issuer it trusts, and sends it back in `Authorization: PrivateToken`. The origin learns
that the issuer vouched for the client and nothing else. This package is the origin's side of
[RFC 9577](https://www.rfc-editor.org/rfc/rfc9577) for publicly verifiable tokens
([RFC 9578](https://www.rfc-editor.org/rfc/rfc9578) token type `0x0002`, Blind RSA): it writes
the challenge, reads the issuer's keys from its directory, verifies the signature with Web
Crypto, and refuses a token spent twice. Every call answers a `Result`.

## Installation

```sh
npm add @sdxc/privacy-pass
```

Results come from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), installed with
this package. The issuer directory is validated with `remix/data-schema`, so install
[`remix`](https://www.npmjs.com/package/remix) beside it.

## Usage

### Challenge and redeem

```ts
import { MemoryRedemptionStore, PrivacyPass } from "@sdxc/privacy-pass";
import { isFailure } from "@sdxc/result";

let privacyPass = new PrivacyPass({
	issuer: "demo-pat.issuer.cloudflare.com",
	originInfo: ["example.com"],
	store: new MemoryRedemptionStore(),
});

async function handle(request: Request): Promise<Response> {
	let redeemed = await privacyPass.redeem(request.headers.get("Authorization"));
	if (!isFailure(redeemed)) return new Response("Welcome");

	let challenge = await privacyPass.challenge();
	if (isFailure(challenge)) return new Response("Try again later", { status: 503 });
	return new Response("Token required", {
		status: 401,
		headers: { "WWW-Authenticate": challenge.data },
	});
}
```

The issuer's keys are fetched from
`https://demo-pat.issuer.cloudflare.com/.well-known/private-token-issuer-directory` on first use
and kept for the directory's `Cache-Control: max-age`.

### Pick a double-spend strategy

```ts
new PrivacyPass({ issuer, store, redemptionContext: "fresh", maxAge: "5 minutes" });
new PrivacyPass({ issuer, store, redemptionContext: "empty", nonceTtl: "30 days" });
```

`"fresh"` (the default) puts 32 random bytes in every challenge and saves its digest, so each
token answers one challenge once; the client must fetch a new token every time. `"empty"` sends
the same challenge to everyone, so a client may spend a token it fetched earlier, and every
spent nonce is kept for `nonceTtl` instead.

### Back the store with shared storage

```ts
import { KVRedemptionStore } from "@sdxc/privacy-pass/kv";

new PrivacyPass({ issuer, store: new KVRedemptionStore(env.CACHE, { prefix: "privacy-pass:" }) });
```

`@sdxc/privacy-pass/kv` keeps challenges and nonces in Workers KV. KV is eventually consistent,
so two requests racing with one token can both pass; a Durable Object closes that gap where it
matters.

### Serve it from a Remix router

```ts
import { privacyPass, redeemOrChallenge } from "@sdxc/privacy-pass/middleware";

router.get(routes.privacyPass, {
	middleware: [privacyPass(instance)],
	handler: (ctx) => redeemOrChallenge(ctx, { onRedeem: () => ({ "Set-Cookie": cookie }) }),
});
```

`@sdxc/privacy-pass/middleware` publishes the instance as `ctx.privacyPass`; `redeemOrChallenge`
answers `401` with a challenge, `204` plus `onRedeem`'s headers once a token redeems, or `204`
when the issuer is unavailable, always `no-store`.

### Verify a token yourself

```ts
import { importTokenKey, parseAuthorization, verifyToken } from "@sdxc/privacy-pass";

let token = parseAuthorization(request.headers.get("Authorization"));
let key = await importTokenKey(tokenKeyBytes);
if (!isFailure(token) && !isFailure(key)) await verifyToken(token.data, key.data);
```

`verifyToken` checks only the issuer's signature; the challenge digest and the nonce are yours
to match.

## API

### `new PrivacyPass(options)`

The origin's challenger and redeemer for one issuer.

- `issuer`: the issuer's server name, the challenge's `issuer_name`.
- `store`: a `RedemptionStore` for fresh challenges and spent nonces.
- `keys`: an `IssuerKeySource`; defaults to an `IssuerDirectory` for `issuer`.
- `originInfo`: the origins a token may be spent at, this one included; default `[]`, which
  accepts cross-origin tokens.
- `redemptionContext`: `"fresh"` (default) or `"empty"`.
- `maxAge`: how long a fresh challenge is accepted, sent as `max-age`; default `"5 minutes"`.
- `nonceTtl`: how long a spent nonce is kept under `"empty"`; default `"30 days"`. Keep it at
  least as long as the issuer keeps a key.

`challenge()` answers the `WWW-Authenticate` value, offering the issuer's preferred key whose
`not-before` has passed. `redeem(authorization)` answers `{ tokenType, nonce, tokenKeyId }`
(hex), checking the signature before the store, so a forged token consumes nothing.

### `PrivacyPassError`

Every failure, with a `code`: `missing-token`, `malformed-token`, `unsupported-token-type`,
`unknown-key`, `invalid-signature`, `unknown-challenge` (never issued, expired or already
answered), `double-spend`, `invalid-challenge`, `invalid-key`, and `issuer-unavailable`, the one
a client cannot fix by fetching a new token.

### `new IssuerDirectory({ issuer, timeout?, defaultMaxAge? })`

Fetches `/.well-known/private-token-issuer-directory` through
[`@sdxc/outbound`](https://www.npmjs.com/package/@sdxc/outbound), imports its Blind RSA keys in
the issuer's order and skips other token types. `keys()` serves them from memory until the
response's `max-age` (or `defaultMaxAge`, one hour) passes; concurrent calls share one fetch.
`clear()` forgets them. `timeout` defaults to 10 seconds.

### `RedemptionStore` and `new MemoryRedemptionStore()`

The double-spend state: `saveChallenge(digest, ttl)`, `takeChallenge(digest)` (true once per
saved, unexpired digest) and `spendNonce(nonce, ttl)` (true the first time). Keys are hex and
`ttl` is in seconds. The memory store keeps them in one isolate.

### `encodeTokenChallenge(challenge)` and `parseTokenChallenge(bytes)`

The TokenChallenge structure, `{ tokenType, issuerName, redemptionContext, originInfo }`. A
context that is neither empty nor 32 bytes, or a name with userinfo or a comma, fails with
`invalid-challenge`.

### `formatChallenge({ challenge, tokenKey, maxAge? })`

One `PrivateToken` challenge with padded base64url parameters. Join several with `", "`.

### `parseAuthorization(header)`, `parseToken(bytes)`, `encodeToken(token)`

Read `Authorization: PrivateToken token="…"` and the Token structure. Tokens of type `0x0001`
and `0x0002` decode; any other type is `unsupported-token-type`.
`tokenAuthenticatorInput(token)` is the signed prefix.

### `importTokenKey(tokenKey, notBefore?)` and `verifyToken(token, key)`

Import an issuer's `id-RSASSA-PSS` key as it appears in a directory or challenge, and check a
type `0x0002` token's RSASSA-PSS (SHA-384, 48-byte salt) signature against it.

### `BLIND_RSA_TOKEN_TYPE`, `VOPRF_TOKEN_TYPE`

`0x0002` and `0x0001`. VOPRF tokens need the issuer's private key to verify, so only an issuer
can redeem them.

## Pattern: Skip the CAPTCHA for clients with a token

```ts
import { MemoryRedemptionStore, PrivacyPass } from "@sdxc/privacy-pass";
import { isFailure } from "@sdxc/result";

let privacyPass = new PrivacyPass({
	issuer: "demo-pat.issuer.cloudflare.com",
	store: new MemoryRedemptionStore(),
});

async function guard(
	request: Request,
	renderCaptchaPage: () => Response,
): Promise<Response | null> {
	let redeemed = await privacyPass.redeem(request.headers.get("Authorization"));
	if (!isFailure(redeemed)) return null;

	let page = renderCaptchaPage();
	let challenge = await privacyPass.challenge();
	if (isFailure(challenge)) return page;
	let headers = new Headers(page.headers);
	headers.set("WWW-Authenticate", challenge.data);
	return new Response(page.body, { status: 401, headers });
}
```

A client that holds tokens answers the 401 by retrying with one; any other client sees the
CAPTCHA page in the same response.

## Testing

`@sdxc/privacy-pass/testing` stands in for an issuer: `createTestIssuer()` makes a key,
`issuerDirectoryResponse(issuer)` is its directory for an MSW handler, and
`answerChallenge(issuer, header)` returns the `Authorization` value a client would send,
`createTestPrivacyPass()` builds an origin trusting a fresh issuer, and
`redeemThrough(fetch, issuer, url)` replays a challenged request with a token.

```ts
import {
	answerChallenge,
	createTestIssuer,
	issuerDirectoryResponse,
} from "@sdxc/privacy-pass/testing";

let issuer = await createTestIssuer();
server.use(http.get(directory.url, () => issuerDirectoryResponse(issuer)));
let authorization = await answerChallenge(issuer, unwrap(await privacyPass.challenge()));
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
		"@sdxc/privacy-pass": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
