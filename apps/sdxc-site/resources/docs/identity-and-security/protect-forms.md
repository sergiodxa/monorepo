---
title: Protect forms from bots and abuse
description: Layer a honeypot, a CAPTCHA, a per-address budget, spam scoring and address and password checks on a public sign-up form.
section:
    title: Identity & security
    order: 6
order: 4
lastUpdated: 2026-10-25
outcomes:
    - "How to stack a honeypot, a CAPTCHA and a per-address budget on a form"
    - "How to score spam and check the address and password on sign-up"
    - "When cheap checks should run in front of expensive ones"
---

A form anyone can reach will be found by bots within days. No single check stops all of them,
and every check costs something — a network call, a moment of a person's attention — so this
guide stacks cheap checks in front of expensive ones on a sign-up form. Each layer refuses what
it can, and what reaches your handler has already survived the rest.

[`@sdxc/honeypot`](/api/honeypot) traps form-filling bots, [`@sdxc/rate-limit`](/api/rate-limit)
keyed by [`@sdxc/get-client-ip`](/api/get-client-ip) caps each address, [`@sdxc/captcha`](/api/captcha)
asks for a challenge, [`@sdxc/spam`](/api/spam) scores what was written, and inside the handler
[`@sdxc/email-address`](/api/email-address) and [`@sdxc/password-policy`](/api/password-policy)
judge the address and password.

```bash
npm add @sdxc/captcha @sdxc/email-address @sdxc/get-client-ip @sdxc/honeypot @sdxc/http \
	@sdxc/lazy-route @sdxc/password-policy @sdxc/rate-limit @sdxc/result @sdxc/spam \
	@sdxc/user-agent @sdxc/validate remix
```

## Mount the guards on the route

The route is `signUp: form("/sign-up")` in `routes/web.ts`, beside a `checkYourEmail` page:
`index` renders the form, `action` accepts it. The honeypot goes on both, because the page
that renders the form issues the fields the submission is checked against. The budget, the
challenge and the spam score go on the action alone.

```typescript {% title="app/initializers/router.ts" %}
import type { Captcha } from "@sdxc/captcha";
import type { RouterContext } from "remix/router";

import { captcha } from "@sdxc/captcha/middleware";
import getClientIP from "@sdxc/get-client-ip/middleware";
import { Honeypot } from "@sdxc/honeypot";
import { honeypot } from "@sdxc/honeypot/middleware";
import { lazy } from "@sdxc/lazy-route";
import { createSpamFilter, DEFAULT_RULES } from "@sdxc/spam";
import { spam } from "@sdxc/spam/middleware";
import { userAgent } from "@sdxc/user-agent/middleware";
import { env } from "cloudflare:workers";
import { formData } from "remix/middleware/form-data";
import { render } from "remix/middleware/render";
import { createRouter } from "remix/router";

import {
	answerTrappedBots,
	checkYourEmail,
} from "~/app/http/controllers/sign-up/bots";
import { callerBudget } from "~/app/http/middleware/rate-limit";
import { productionCaptcha } from "~/app/initializers/captcha";
import routes from "~/routes/web";

const TRAP = new Honeypot({ secret: env.HONEYPOT_SECRET });
const SPAM = createSpamFilter({ checks: DEFAULT_RULES });

export function createWebRouter(guard: Captcha = productionCaptcha()) {
	let router = createRouter({
		middleware: [formData(), render(), getClientIP(), userAgent()],
	});
	let trap = honeypot(TRAP, { onFailure: answerTrappedBots });
	let scored = spam(SPAM, {
		fields: { content: "about", email: "email" },
		onSpam: checkYourEmail,
	});

	router.map(
		routes.signUp.index,
		lazy(
			() =>
				import("~/app/http/controllers/sign-up/render").then(
					(it) => it.index,
				),
			[trap],
		),
	);
	router.map(
		routes.signUp.action,
		lazy(
			() =>
				import("~/app/http/controllers/sign-up/action").then(
					(it) => it.action,
				),
			[trap, callerBudget("sign-up", 5), captcha(guard), scored],
		),
	);

	return router;
}

export type AppContext = RouterContext<ReturnType<typeof createWebRouter>>;

declare module "remix/router" {
	interface RouterTypes {
		context: AppContext;
	}
}
```

`AppContext` is the context that chain builds, and declaring it on `RouterTypes` types every
`createAction` with it, so the handlers below read `ctx.formData` and `ctx.render`.

The order is the cost order: an HMAC check, one KV read and write, a call to the CAPTCHA
provider, then local spam rules. Only a submission that passes all four is parsed, has its
domain looked up in DNS and has its password checked against a breach corpus. The guards are
`lazy()`'s second argument, so a refused submission never loads the controller, and `guard` is
passed in so a test can hand in its own provider.

> [!NOTE]
> Keep `formData()` in the router's global middleware, ahead of every guard: the honeypot, the
> challenge, the spam score and the handler all read the submission it parsed.

## Set a trap no person fills

`HoneypotFields` renders a signed token as a hidden input and a trap field that sits off-screen,
`inert` and hidden from assistive technology. A person never sees the trap; a bot filling every
input fills it. Issue the fields once per render, so a re-rendered form carries a fresh token:

```tsx {% title="app/http/controllers/sign-up/render.tsx" %}
import { TurnstileWidget } from "@sdxc/captcha/turnstile/ui";
import { HoneypotFields } from "@sdxc/honeypot/ui";
import { unwrap } from "@sdxc/result";
import { env } from "cloudflare:workers";
import { createAction } from "remix/router";

import type { AppContext } from "~/app/initializers/router";
import { SignUpPage } from "~/resources/views/sign-up";
import routes from "~/routes/web";

export async function renderSignUp(ctx: AppContext, error?: string) {
	let fields = unwrap(await ctx.honeypot.issue());

	return ctx.render(
		<SignUpPage error={error}>
			<form method="post" action={routes.signUp.action.href()}>
				<HoneypotFields {...fields} />
				<input name="email" type="email" autocomplete="email" required />
				<input name="password" type="password" autocomplete="new-password" />
				<textarea name="about" />
				<TurnstileWidget siteKey={env.TURNSTILE_SITE_KEY} theme="auto" />
				<button type="submit">Create account</button>
			</form>
		</SignUpPage>,
		{ status: error ? 400 : 200 },
	);
}

export const index = createAction(routes.signUp.index, (ctx) => renderSignUp(ctx));
```

A refusal teaches a bot to adapt, so a filled trap is answered like a success. Anything else,
such as an expired token from a page that predates a secret rotation, continues to the handler
with the failure published, which asks the person to send the form again:

```typescript {% title="app/http/controllers/sign-up/bots.ts" %}
import type { HoneypotError } from "@sdxc/honeypot";

import { redirect } from "@sdxc/http/response";

import routes from "~/routes/web";

export function checkYourEmail(): Response {
	return redirect(routes.checkYourEmail.href(), {
		status: redirect.Status.SeeOther,
	});
}

export function answerTrappedBots(error: HoneypotError): Response | null {
	return error.code === "trap-filled" ? checkYourEmail() : null;
}
```

## Budget each address

An anonymous form has one thing to key a budget on: the connecting address. `getClientIP`
answers `null` when the address is unknown, so every unidentified request shares one bucket
rather than going unlimited, and `addressKey` keys an IPv6 client on its `/64`, the network it
controls:

```typescript {% title="app/http/middleware/rate-limit.ts" %}
import type { Middleware } from "remix/router";

import { getClientIP } from "@sdxc/get-client-ip";
import { addressKey, KVAdapter } from "@sdxc/rate-limit";
import { rateLimit } from "@sdxc/rate-limit/middleware";
import { env } from "cloudflare:workers";

export function callerBudget(prefix: string, limit: number): Middleware {
	return rateLimit({
		adapter: new KVAdapter(env.RATE_LIMITS, { limit, window: "10 minutes" }),
		prefix,
		key: (ctx) => addressKey(getClientIP(ctx.request)),
	});
}
```

A denied request is answered with a `429` and `Retry-After` before the handler runs. Callers
behind one egress address, such as an office, share a budget, so set the limit for the busiest
shared address you expect to serve.

## Ask for a challenge, with a test provider

`captcha(provider)` verifies the field the provider's widget writes and refuses a failed token
with a `403`. `Captcha` is an interface, so the router takes whichever provider it is given:

```typescript {% title="app/initializers/captcha.ts" %}
import type { Captcha } from "@sdxc/captcha";

import { MemoryCaptcha } from "@sdxc/captcha/memory";
import { Turnstile } from "@sdxc/captcha/turnstile";
import { env } from "cloudflare:workers";

export function productionCaptcha(): Captcha {
	return new Turnstile({ secretKey: env.TURNSTILE_SECRET_KEY });
}

export function testCaptcha(): Captcha {
	return new MemoryCaptcha().failNext("rejected");
}
```

The Worker calls `createWebRouter()`, and a test calls `createWebRouter(testCaptcha())`.
`MemoryCaptcha` passes every non-empty token posted as `captcha-response`, and `failNext`
queues one refusal. Every failure carries a `code` that separates what the visitor can fix
(`rejected`, `expired`) from what the provider broke (`unavailable`); an `onFailure` that
answers `null` for `unavailable` keeps sign-ups open through a provider outage.

> [!WARNING]
> An `onFailure` that lets `unavailable` through opens the form to every bot for as long as the
> provider is down. Choose it only while the honeypot, the budget and the spam score stay in
> front of the handler.

## Score what was written

`scored`, the `spam(filter, options)` guard in the router, scores the free-text `content` field
and the sender's `email`, together with the address, the user agent and how fast the form came
back after rendering. A spam verdict goes to `onSpam`, here answered like a success so a bot
learns nothing, and every other verdict reaches the handler as `ctx.spamAssessment`.

## Check the address

Parse first, run the checks that need no network, then ask DNS whether the domain receives mail
at all.

```typescript {% title="app/services/sign-up-email.ts" %}
import { parseEmailAddress } from "@sdxc/email-address";
import { checkDisposable } from "@sdxc/email-address/disposable";
import { checkMailServer } from "@sdxc/email-address/mail-server";
import { failure, isFailure, success } from "@sdxc/result";

export async function checkSignUpEmail(input: string) {
	let parsed = parseEmailAddress(input);
	if (isFailure(parsed)) return failure(new Error("That is not an email address."));

	let disposable = checkDisposable(parsed.data);
	if (isFailure(disposable))
		return failure(new Error("Use an address you will keep."));

	let servers = await checkMailServer(parsed.data.domain, { timeoutMs: 2000 });
	if (isFailure(servers) && servers.error.reason !== "lookup-failed") {
		return failure(new Error("That domain does not receive email."));
	}

	return success(parsed.data);
}
```

`lookup-failed` means the resolver did not answer, so it fails open: a DNS outage never blocks a
sign-up, and the confirmation email is the real test. Store `address` for sending and put the
unique index on `canonical`, so a second sign-up with different capitalization finds the
existing account.

## Check the password

With the address known, the handler checks the password against NIST's rules: at least 15
characters, not a common password, not built from the email, not in a breach.
[`@sdxc/validate`](/api/validate) reads the parsed form into `SIGN_UP` first.

```typescript {% title="app/http/controllers/sign-up/action.ts" %}
import { checkPassword } from "@sdxc/password-policy";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { checkYourEmail } from "~/app/http/controllers/sign-up/bots";
import { renderSignUp } from "~/app/http/controllers/sign-up/render";
import { passwordMessage } from "~/app/services/password-message";
import { checkSignUpEmail } from "~/app/services/sign-up-email";
import { createAccount } from "~/app/services/accounts";
import routes from "~/routes/web";

const SIGN_UP = s.object({
	email: s.string(),
	password: s.string(),
	about: s.optional(s.string()),
});

export const action = createAction(routes.signUp.action, async (ctx) => {
	let trap = ctx.honeypotOutcome;
	let form = await validate(ctx.formData, SIGN_UP);
	if (isFailure(trap) || isFailure(form))
		return renderSignUp(ctx, "Send it again.");

	let email = await checkSignUpEmail(form.data.email);
	if (isFailure(email)) return renderSignUp(ctx, email.error.message);

	let accepted = await checkPassword(form.data.password, {
		identifiers: [email.data.address],
		breached: { userAgent: "acme-sign-up", timeout: 2000 },
	});
	let issue = isFailure(accepted) ? accepted.error.issue : null;
	if (issue && issue.reason !== "breach-check-unavailable") {
		return renderSignUp(ctx, passwordMessage(issue));
	}

	let held = ctx.spamAssessment.verdict === "unsure";
	await createAccount(ctx, email.data, form.data.password, held);
	return checkYourEmail();
});
```

The breach lookup sends Have I Been Pwned only the first five characters of the password's
SHA-1, and it runs after every local rule has passed, so `breach-check-unavailable` fails open
on an otherwise acceptable password. `passwordMessage` and `createAccount` are your own: the
first turns an issue into copy, and the second hashes the password with `password.hash` from
[`@sdxc/crypto`](/api/crypto) and holds the account for review on an unsure spam verdict.

> [!NOTE]
> The root import of `@sdxc/password-policy` bundles the common-password list, about 220 KB
> gzipped. Import from `/length`, `/context` and `/breached` when the Worker's size matters more
> than that check.

## Test the guards

Build the router with `testCaptcha()` and post to it as a browser would. The test signs a real
honeypot token from the same secret the router reads, and the budget runs on the `RATE_LIMITS`
mock, which you add to `app/test/cloudflare-workers.ts` as `createKVNamespace()`:

```typescript {% title="app/http/controllers/sign-up/action.test.ts" %}
import { Honeypot } from "@sdxc/honeypot";
import { unwrap } from "@sdxc/result";
import { env } from "cloudflare:workers";
import { expect, test } from "vitest";

import { testCaptcha } from "~/app/initializers/captcha";
import { createWebRouter } from "~/app/initializers/router";
import routes from "~/routes/web";

async function signUp(trap = "") {
	let { token, tokenField, trapField } = unwrap(
		await new Honeypot({ secret: env.HONEYPOT_SECRET }).issue(),
	);
	return createWebRouter(testCaptcha()).fetch(
		new Request(new URL(routes.signUp.action.href(), "https://example.com"), {
			method: "POST",
			body: new URLSearchParams({
				email: "ada@example.com",
				"captcha-response": "token",
				[tokenField]: token,
				[trapField]: trap,
			}),
		}),
	);
}

test("answers a filled trap like a success", async () => {
	let response = await signUp("https://spam.example.com");

	expect(response.status).toBe(303);
	expect(response.headers.get("Location")).toBe(routes.checkYourEmail.href());
});

test("refuses a submission whose challenge fails", async () => {
	let response = await signUp();

	expect(response.status).toBe(403);
});
```

`testCaptcha()` queues one `rejected` answer, so the second test reaches the challenge and is
refused there, and the controller never loads.

## Where to go next

- [Security headers and CSP](/docs/identity-and-security/security-headers) — allow the
  challenge's script and frame before enforcing a policy.
- [Accept Privacy Pass tokens instead of a CAPTCHA](/docs/identity-and-security/privacy-pass) —
  a challenge with no widget for clients that hold tokens.
- [`@sdxc/spam`](/api/spam) — reputation providers, a trainable classifier and a Workers AI
  second opinion.
