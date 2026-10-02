# @sdxc/captcha

Provider-neutral CAPTCHA verification: one `Captcha` contract with Turnstile, hCaptcha and
reCAPTCHA implementations, router middleware, widgets and an in-memory provider for tests.
Every failure carries a neutral `code` that separates what the visitor fixes (`rejected`,
`expired`, `low-score`) from what the provider broke (`unavailable`).

## Installation

```bash
npm add @sdxc/captcha
```

The middleware runs on the [`remix`](https://www.npmjs.com/package/remix) router and the widgets
render with `remix/component`; every verification returns an
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) value. Both install alongside this
package.

## Usage

### Guard a form route

```tsx
import { captcha } from "@sdxc/captcha/middleware";
import { Turnstile } from "@sdxc/captcha/turnstile";
import { createRouter } from "remix/router";

let turnstile = new Turnstile({ secretKey: TURNSTILE_SECRET_KEY });
let router = createRouter();

router.post("/sign-up", {
	middleware: [captcha(turnstile, { action: "sign-up" })],
	handler() {
		// Reached only once the token verified; a failure was answered with a 403.
		return new Response("Welcome");
	},
});
```

### Render the widget

```tsx
import type { Handle } from "remix/component";

import { TurnstileWidget } from "@sdxc/captcha/turnstile/ui";

function SignUpForm(handle: Handle<{ siteKey: string }>) {
	return () => (
		<form method="post" action="/sign-up">
			<input name="email" type="email" />
			<TurnstileWidget siteKey={handle.props.siteKey} action="sign-up" theme="auto" />
			<button type="submit">Sign up</button>
		</form>
	);
}
```

### Verify without the middleware

```ts
import { Turnstile } from "@sdxc/captcha/turnstile";
import { isFailure } from "@sdxc/result";

let turnstile = new Turnstile({ secretKey: TURNSTILE_SECRET_KEY });
let result = await turnstile.verify(token, { remoteIp: "203.0.113.7" });
if (isFailure(result)) return result.error.code; // "rejected", "expired", "unavailable", …
result.data.hostname; // "example.com"
```

### Switch providers

```ts
import { HCaptcha } from "@sdxc/captcha/hcaptcha";
import { captcha } from "@sdxc/captcha/middleware";
import { ReCaptcha } from "@sdxc/captcha/recaptcha";

captcha(new HCaptcha({ secretKey: HCAPTCHA_SECRET, siteKey: HCAPTCHA_SITE_KEY }));
captcha(new ReCaptcha({ secretKey: RECAPTCHA_SECRET, minScore: 0.7 }), { action: "sign_up" });
```

## API

### `@sdxc/captcha`

- `Captcha` — the interface a provider implements: `field`, the form field its widget writes,
  and `verify(token, { remoteIp? })`, which resolves to
  `Result<Captcha.Verification, CaptchaError>`. Single-use providers consume the token, so call
  it once per submission.
- `Captcha.Verification` — what the provider confirmed: `hostname?`, `action?`, `score?` (`0`
  bot to `1` human) and `challengedAt?`. A field the provider does not report stays unset.
- `Captcha.ErrorCode` — one of `missing-token`, `rejected`, `expired`, `low-score`,
  `unavailable`, `action-mismatch` or `hostname-mismatch`.
- `CaptchaError` — the failure every provider returns: `code` to branch on, and `providerCodes`
  with the provider's own codes verbatim for logs.

### `@sdxc/captcha/middleware`

`captcha(provider, options?)` verifies `provider.field` on every request of the route it is
installed on, so install it on the action that accepts the submission. It reads the form parsed
by `remix`'s `formData()` middleware when present, and otherwise a clone of the request, leaving
the body readable for the handler. A missing field or a non-form body is `missing-token`.

- `action` / `hostname` — expected values; a verification reporting another one, or none, fails
  with `action-mismatch` / `hostname-mismatch`.
- `remoteIp(request)` — resolves the visitor's address; defaults to the `CF-Connecting-IP`
  header.
- `onFailure(error, ctx)` — return a `Response` to refuse, or `null` to continue with the failure
  published. Defaults to a plain-text 403.

The outcome is published as `ctx.captcha` (`CaptchaOutcome`, a
`Result<Captcha.Verification, CaptchaError>`) and under the `CaptchaKey` context key.

### `@sdxc/captcha/turnstile`

`new Turnstile({ secretKey, field?, timeout? })` verifies against Cloudflare's
[`siteverify`](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
`field` defaults to `cf-turnstile-response`; `timeout` to 10 seconds. It reports hostname,
action and solve time.

### `@sdxc/captcha/turnstile/ui`

`<TurnstileWidget siteKey />` renders the `.cf-turnstile` container and Cloudflare's loader.
Optional props: `action`, `cData`, `theme` (`auto` | `light` | `dark`), `size` (`normal` |
`flexible` | `compact`), `appearance` (`always` | `execute` | `interaction-only`), `language`,
`field` (match `Turnstile`'s) and `nonce` for the loader script.

### `@sdxc/captcha/hcaptcha`

`new HCaptcha({ secretKey, siteKey?, maxRiskScore?, field?, timeout? })` verifies against
[hCaptcha's `siteverify`](https://docs.hcaptcha.com/).
`siteKey` makes hCaptcha refuse a token solved for another site. hCaptcha Enterprise scores
risk (`1` is a threat), so the verification reports `1 - risk` as `score`, and `maxRiskScore`,
in hCaptcha's own terms, fails a riskier token with `low-score`. `field` defaults to
`h-captcha-response`.

### `@sdxc/captcha/hcaptcha/ui`

`<HCaptchaWidget siteKey />` renders the `.h-captcha` container and hCaptcha's loader. Optional
props: `theme` (`light` | `dark`), `size` (`normal` | `compact`), `tabIndex`, `language` and
`nonce`.

### `@sdxc/captcha/recaptcha`

`new ReCaptcha({ secretKey, minScore?, field?, timeout? })` verifies v2 and v3 tokens against
[Google's `siteverify`](https://developers.google.com/recaptcha/docs/verify). A v3 answer
reports its `score` and `action`; a score under `minScore` (default `0.5`) fails with
`low-score`. A v2 answer carries no score and passes on `success` alone. Hold a v3 token to
the form's action with the middleware's `action` option. `field` defaults to
`g-recaptcha-response`.

### `@sdxc/captcha/recaptcha/ui`

`<ReCaptchaWidget siteKey />` renders the v2 checkbox: the `.g-recaptcha` container and Google's
loader. Optional props: `theme` (`light` | `dark`), `size` (`normal` | `compact`), `tabIndex`,
`language` and `nonce`. A v3 key has no widget; the page calls `grecaptcha.execute()` and writes
the token into a `g-recaptcha-response` field itself.

### `@sdxc/captcha/memory`

`new MemoryCaptcha({ field?, verification?, unknownTokens? })` is a scriptable provider for
tests. A call is answered by the next queued outcome, then by the token's own rule, then by the
default: every non-empty token passes with `verification`, or is `rejected` under
`unknownTokens: "reject"`.

- `passNext(verification?)` / `failNext(code, providerCodes?)` — queue the next answer.
- `accept(token, verification?)` / `reject(token, code, providerCodes?)` — answer one token the
  same way every time.
- `calls` / `last` — every recorded `{ token, remoteIp? }`.
- `reset()` — forget calls, queued answers and rules.

An empty token is `missing-token` and never consumes a queued answer. `field` defaults to
`captcha-response`.

## Pattern: Fail open when the provider is down

A sign-in keeps working through a provider outage while still refusing a bad token.

```ts
import { captcha } from "@sdxc/captcha/middleware";
import { Turnstile } from "@sdxc/captcha/turnstile";
import { createRouter } from "remix/router";

let turnstile = new Turnstile({ secretKey: TURNSTILE_SECRET_KEY });
let router = createRouter();

router.post("/sign-in", {
	middleware: [
		captcha(turnstile, {
			onFailure: (error) =>
				error.code === "unavailable"
					? null
					: new Response("Solve the challenge again", { status: 400 }),
		}),
	],
	handler(ctx) {
		// ctx.captcha is a failure with code "unavailable" when the provider was down.
		return signIn(ctx);
	},
});
```

## Pattern: Escalate a low reCAPTCHA v3 score

v3 runs invisibly; a `low-score` answer is the moment to show a v2 checkbox instead of
refusing outright.

```ts
import { captcha } from "@sdxc/captcha/middleware";
import { ReCaptcha } from "@sdxc/captcha/recaptcha";
import { createRouter } from "remix/router";

let recaptcha = new ReCaptcha({ secretKey: RECAPTCHA_V3_SECRET, minScore: 0.5 });
let router = createRouter();

router.post("/comment", {
	middleware: [
		captcha(recaptcha, {
			action: "comment",
			onFailure: (error) =>
				error.code === "low-score" ? null : new Response(null, { status: 403 }),
		}),
	],
	handler(ctx) {
		if (ctx.captcha.status === "failure") return renderWithCheckbox(ctx);
		return saveComment(ctx);
	},
});
```

## Pattern: Testing a guarded route

`MemoryCaptcha` stands in for the real provider, so a test chooses the outcome and asserts on
what was verified.

```ts
import { MemoryCaptcha } from "@sdxc/captcha/memory";
import { captcha } from "@sdxc/captcha/middleware";
import { createRouter } from "remix/router";
import { expect, test } from "vitest";

test("refuses a sign-up the provider rejected", async () => {
	let provider = new MemoryCaptcha().failNext("rejected");
	let router = createRouter();
	router.post("/sign-up", { middleware: [captcha(provider)], handler: () => new Response("ok") });

	let response = await router.fetch("https://example.com/sign-up", {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			"CF-Connecting-IP": "203.0.113.7",
		},
		body: "captcha-response=token",
	});

	expect(response.status).toBe(403);
	expect(provider.last).toEqual({ token: "token", remoteIp: "203.0.113.7" });
});
```

## Pattern: Implementing `Captcha` for another provider

An implementation owns three things: the widget's field name, the call (or local check) that
verifies a token, and the mapping of the provider's answer onto `Captcha.Verification` and
`Captcha.ErrorCode`. Report only what the provider confirms, map token problems to `rejected`
or `expired`, and map everything the visitor cannot fix — a bad key, a provider error, a
network failure — to `unavailable`.

```ts
import type { Captcha } from "@sdxc/captcha";
import type { Result } from "@sdxc/result";

import { CaptchaError } from "@sdxc/captcha";
import { failure, success } from "@sdxc/result";

/** Friendly Captcha v2, verified with an API key header. */
class FriendlyCaptcha implements Captcha {
	readonly field = "frc-captcha-response";

	constructor(private apiKey: string) {}

	async verify(token: string): Promise<Result<Captcha.Verification, CaptchaError>> {
		if (token === "") return failure(new CaptchaError("missing-token"));
		let response: Response;
		try {
			response = await fetch("https://global.frcapi.com/api/v2/captcha/siteverify", {
				method: "POST",
				headers: { "X-API-Key": this.apiKey, "Content-Type": "application/json" },
				body: JSON.stringify({ response: token }),
			});
		} catch {
			return failure(new CaptchaError("unavailable"));
		}
		if (!response.ok) return failure(new CaptchaError("unavailable", [`http-${response.status}`]));
		let answer = await response.json(); // validate the shape before trusting it
		if (answer.success) return success({ challengedAt: new Date(answer.data.challenge.timestamp) });
		let code = answer.error.error_code;
		if (code === "response_timeout" || code === "response_duplicate") {
			return failure(new CaptchaError("expired", [code]));
		}
		return failure(new CaptchaError("rejected", [code]));
	}
}
```

A provider verified locally fits the same contract: an [ALTCHA](https://altcha.org) proof of
work is checked with an HMAC key and no network call, so its implementation reads the `altcha`
field, ignores `remoteIp`, and reports no hostname, action or score — which is why the
middleware treats an expected `action` it cannot confirm as `action-mismatch`.

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
		"@sdxc/captcha": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
