# @sdxc/captcha

Turnstile, hCaptcha and reCAPTCHA verification, with middleware and widgets.

Every provider implements one `Captcha` contract, so the middleware, the widgets and an
in-memory provider for tests work the same over any of them. A failure carries a neutral
`code` that separates what the visitor fixes (`rejected`, `expired`, `low-score`) from what the
provider broke (`unavailable`).

## Installation

```sh
npm add @sdxc/captcha
```

The middleware runs on the [`remix`](https://www.npmjs.com/package/remix) router and the widgets
render with `remix/component`; every verification answers a `Result` from
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result).

## Usage

### Verify a token

```ts
import { Turnstile } from "@sdxc/captcha/turnstile";
import { isFailure } from "@sdxc/result";

let turnstile = new Turnstile({ secretKey: TURNSTILE_SECRET_KEY });

let result = await turnstile.verify(token, { remoteIp: "203.0.113.7" });
if (isFailure(result)) return result.error.code; // "rejected", "expired", "unavailable", …
result.data.hostname; // "example.com"
```

Tokens are single-use, so verify each submission once.

### Guard a form route

```ts
import { captcha } from "@sdxc/captcha/middleware";
import { Turnstile } from "@sdxc/captcha/turnstile";
import { createRouter } from "remix/router";

let turnstile = new Turnstile({ secretKey: TURNSTILE_SECRET_KEY });
let router = createRouter();

router.post("/sign-up", {
	middleware: [captcha(turnstile, { action: "sign-up" })],
	handler: () => new Response("Welcome"),
});
```

The middleware reads `turnstile.field` from the submitted form, verifies it with the visitor's
`CF-Connecting-IP`, and answers a failure with a 403. The handler still reads the body.

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

### Switch providers

```ts
import { HCaptcha } from "@sdxc/captcha/hcaptcha";
import { captcha } from "@sdxc/captcha/middleware";
import { ReCaptcha } from "@sdxc/captcha/recaptcha";

captcha(new HCaptcha({ secretKey: HCAPTCHA_SECRET, siteKey: HCAPTCHA_SITE_KEY }));
captcha(new ReCaptcha({ secretKey: RECAPTCHA_SECRET, minScore: 0.7 }), { action: "sign_up" });
```

Pair each with its widget from `@sdxc/captcha/hcaptcha/ui` or `@sdxc/captcha/recaptcha/ui`.

## API

### `Captcha`

The interface a provider implements: `field`, the form field its widget writes, and
`verify(token, { remoteIp? })`, which answers `Result<Captcha.Verification, CaptchaError>`.
A field of the verification the provider does not report stays unset.

### `new CaptchaError(code, providerCodes?)`

The failure every provider answers: `code` to branch on, and `providerCodes` with the
provider's own codes verbatim, for logs.

### `captcha(provider, options?)` from `./middleware`

Verifies `provider.field` on every request of the route it is installed on, and publishes the
outcome as `ctx.captcha`. It reuses the form parsed by `remix`'s `formData()` middleware when
present; a missing field or a non-form body is `missing-token`.

- `action` / `hostname`: expected values; a verification reporting another one, or none, fails
  with `action-mismatch` / `hostname-mismatch`.
- `remoteIp(request)`: the visitor's address. Defaults to the `CF-Connecting-IP` header when it
  holds a valid address.
- `onFailure(error, ctx)`: answer a `Response` to refuse, or `null` to reach the handler with
  the failure on `ctx.captcha`. Defaults to a plain-text 403.

### `CaptchaKey` from `./middleware`

The context key holding the same outcome as `ctx.captcha`, for code that reads it with
`ctx.get(CaptchaKey)`.

### `new Turnstile({ secretKey, field?, timeout? })` from `./turnstile`

Verifies with Cloudflare's
[`siteverify`](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
and reports hostname, action and solve time. `field` defaults to `cf-turnstile-response`,
`timeout` to 10 seconds.

### `new HCaptcha({ secretKey, siteKey?, maxRiskScore?, field?, timeout? })` from `./hcaptcha`

Verifies with [hCaptcha's `siteverify`](https://docs.hcaptcha.com/). `siteKey` refuses a token
solved for another site. On Enterprise plans the verification's `score` is `1 - risk`, and a
risk above `maxRiskScore` (hCaptcha's own scale, `1` is a threat) fails with `low-score`.
`field` defaults to `h-captcha-response`.

### `new ReCaptcha({ secretKey, minScore?, field?, timeout? })` from `./recaptcha`

Verifies v2 and v3 tokens with
[Google's `siteverify`](https://developers.google.com/recaptcha/docs/verify). A v3 score under
`minScore` (default `0.5`) fails with `low-score`; a v2 answer has no score and passes on
success alone. `field` defaults to `g-recaptcha-response`.

### `new MemoryCaptcha({ field?, verification?, unknownTokens? })` from `./memory`

A scriptable provider for tests. A call takes the next queued outcome, then the token's own
rule, then the default: pass with `verification`, or `rejected` under
`unknownTokens: "reject"`. An empty token is `missing-token` and leaves the queue alone.
`field` defaults to `captcha-response`.

- `passNext(verification?)` / `failNext(code, providerCodes?)`: queue the next answer.
- `accept(token, verification?)` / `reject(token, code, providerCodes?)`: answer one token the
  same way every time.
- `calls` / `last`: every recorded `{ token, remoteIp? }`.
- `reset()`: forget calls, queued answers and rules.

### Widgets

Each renders the provider's container followed by its loader script; `nonce` sets the script's
CSP nonce.

- `<TurnstileWidget siteKey />` from `./turnstile/ui`: `action`, `cData`, `theme` (`auto` |
  `light` | `dark`), `size` (`normal` | `flexible` | `compact`), `appearance` (`always` |
  `execute` | `interaction-only`), `language`, `field` (match the server's) and `nonce`.
- `<HCaptchaWidget siteKey />` from `./hcaptcha/ui`: `theme` (`light` | `dark`), `size`
  (`normal` | `compact`), `tabIndex`, `language` and `nonce`.
- `<ReCaptchaWidget siteKey />` from `./recaptcha/ui`: the v2 checkbox, with the same props as
  `HCaptchaWidget`. A v3 page calls `grecaptcha.execute()` and writes the token into a
  `g-recaptcha-response` field itself.

### Types

- `Captcha.Verification`: `hostname?`, `action?`, `score?` (`0` bot to `1` human) and
  `challengedAt?`.
- `Captcha.VerifyOptions`: `{ remoteIp? }`.
- `Captcha.ErrorCode`: `missing-token`, `rejected`, `expired`, `low-score`, `unavailable`,
  `action-mismatch` or `hostname-mismatch`.
- `CaptchaOutcome`: `Result<Captcha.Verification, CaptchaError>`, the type of `ctx.captcha`.
- `CaptchaMiddlewareOptions`, `Turnstile.Options`, `HCaptcha.Options`, `ReCaptcha.Options`,
  `MemoryCaptcha.Options` and `MemoryCaptcha.Call`: the option and record shapes above.
- `TurnstileWidget.Props`, `HCaptchaWidget.Props`, `ReCaptchaWidget.Props`: the widget props.

## Pattern: Fail open when the provider is down

A sign-in keeps working through a provider outage while still refusing a bad token.

```ts
import { captcha } from "@sdxc/captcha/middleware";
import { Turnstile } from "@sdxc/captcha/turnstile";
import { isFailure } from "@sdxc/result";
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
		let unverified = isFailure(ctx.captcha); // true only when the provider was unavailable
		return signIn(ctx, { unverified });
	},
});
```

## Pattern: Escalate a low reCAPTCHA v3 score

v3 runs invisibly; a `low-score` answer is the moment to show the v2 checkbox instead of
refusing outright.

```tsx
import type { Handle } from "remix/component";

import { captcha } from "@sdxc/captcha/middleware";
import { ReCaptcha } from "@sdxc/captcha/recaptcha";
import { ReCaptchaWidget } from "@sdxc/captcha/recaptcha/ui";
import { isFailure } from "@sdxc/result";
import { createRouter } from "remix/router";

let invisible = new ReCaptcha({ secretKey: RECAPTCHA_V3_SECRET, minScore: 0.5 });
let checkbox = new ReCaptcha({ secretKey: RECAPTCHA_V2_SECRET });
let router = createRouter();

router.post("/comment", {
	middleware: [
		captcha(invisible, {
			action: "comment",
			onFailure: (error) =>
				error.code === "low-score" ? null : new Response(null, { status: 403 }),
		}),
	],
	handler(ctx) {
		if (isFailure(ctx.captcha)) return renderPage(<CheckboxForm siteKey={RECAPTCHA_V2_SITE_KEY} />);
		return saveComment(ctx);
	},
});

router.post("/comment/checked", {
	middleware: [captcha(checkbox)],
	handler: (ctx) => saveComment(ctx),
});

function CheckboxForm(handle: Handle<{ siteKey: string }>) {
	return () => (
		<form method="post" action="/comment/checked">
			<textarea name="body" />
			<ReCaptchaWidget siteKey={handle.props.siteKey} />
			<button type="submit">Post</button>
		</form>
	);
}
```

v2 and v3 keys are separate, so the checkbox posts to a route verified with the v2 secret; a v2
answer has no score and passes on success alone.

## Pattern: Hold a token to its form and site

A token solved on one form or domain fails on another, and the visitor's address comes from
the header your proxy sets.

```ts
import { captcha } from "@sdxc/captcha/middleware";
import { Turnstile } from "@sdxc/captcha/turnstile";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";

let turnstile = new Turnstile({ secretKey: TURNSTILE_SECRET_KEY, timeout: 5_000 });
let router = createRouter({ middleware: [formData()] });

router.post("/contact", {
	middleware: [
		captcha(turnstile, {
			action: "contact",
			hostname: "www.example.com",
			remoteIp: (request) => request.headers.get("X-Real-IP"),
		}),
	],
	handler(ctx) {
		return sendMessage(ctx.get(FormData));
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

test("accepts only the known token", async () => {
	let provider = new MemoryCaptcha({ unknownTokens: "reject" }).accept("good", { action: "x" });

	expect(await provider.verify("good")).toEqual({ status: "success", data: { action: "x" } });
	expect((await provider.verify("bad")).status).toBe("failure");
	provider.reset();
});
```

## Pattern: Implementing `Captcha` for another provider

An implementation names its widget's field, verifies a token, and maps the answer onto
`Captcha.Verification` and `Captcha.ErrorCode`: token problems are `rejected` or `expired`, and
anything the visitor cannot fix (a bad key, a provider error, a network failure) is
`unavailable`.

```ts
import type { Captcha } from "@sdxc/captcha";
import type { Result } from "@sdxc/result";

import { CaptchaError } from "@sdxc/captcha";
import { failure, success } from "@sdxc/result";

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
		let answer = await response.json();
		if (answer.success) return success({ challengedAt: new Date(answer.data.challenge.timestamp) });
		let code = answer.error.error_code;
		if (code === "response_timeout" || code === "response_duplicate") {
			return failure(new CaptchaError("expired", [code]));
		}
		return failure(new CaptchaError("rejected", [code]));
	}
}
```

A provider that reports no action fails the middleware's `action` option with
`action-mismatch`, so leave `action` unset for it.

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
