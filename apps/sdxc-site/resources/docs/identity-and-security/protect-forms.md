---
title: Protect forms from bots and abuse
description: Layer a honeypot, a CAPTCHA, a per-address budget, spam scoring and address and password checks on a public sign-up form.
section:
    title: Identity & security
    order: 6
order: 4
lastUpdated: 2026-10-19
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
`index` renders the form, `action` accepts it. The honeypot
goes on both, because the page that renders the form has to issue the fields the submission is
checked against. The budget, the challenge and the spam score go on the action alone.

```typescript {% title="app/initializers/router.ts" %}
import type { Captcha } from "@sdxc/captcha";

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
		middleware: [formData(), getClientIP(), userAgent()],
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
```

The order is the cost order. The honeypot is an HMAC check over two form fields. The budget is
one KV read and write. The challenge is a call to the provider. The spam score runs local rules
over the free-text field. Only a submission that passes all four is parsed, has its domain
looked up in DNS and has its password checked against a breach corpus. The guards are
`lazy()`'s second argument, so a refused submission never loads the controller. `guard` is the
CAPTCHA provider, passed in so a test can hand in its own. Beside `formData()`, `getClientIP()`
and `userAgent()` publish `ctx.ip` and `ctx.userAgent`, which the spam score sends to its
checks. Each module this file imports is built in the sections below.

<note>
Keep `formData()` in the router's global middleware, ahead of every guard: the honeypot, the
challenge, the spam score and the handler all read the submission it parsed.
</note>

## Set a trap no person fills

`HoneypotFields` renders a signed token as a hidden input and a trap field that sits off-screen,
`inert` and hidden from assistive technology. A person never sees the trap; a bot filling every
input fills it. The token records when the form was rendered and which trap it carried, so a bot
can neither pick the field nor backdate the form.

```tsx {% title="app/http/controllers/sign-up/render.tsx" %}
import type { RequestContext } from "remix/router";

import { TurnstileWidget } from "@sdxc/captcha/turnstile/ui";
import { HoneypotFields } from "@sdxc/honeypot/ui";
import { unwrap } from "@sdxc/result";
import { env } from "cloudflare:workers";
import { createAction } from "remix/router";

import { SignUpPage } from "~/resources/views/sign-up";
import routes from "~/routes/web";

export async function renderSignUp(ctx: RequestContext, error?: string) {
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

Issuing fails only when the honeypot has no secret, a misconfiguration worth crashing on, which
is where `unwrap` belongs.

<note>
Issue once per render, so a re-rendered form carries a fresh token, and mount the honeypot on
the page route as well as the action: the page issues the fields the submission is checked
against.
</note>

A refusal teaches a bot to adapt, so a filled trap is answered like a success. Anything else —
a missing or expired token, from a person whose page predates a secret rotation — continues to
the handler with the failure published, which asks them to send the form again:

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

An anonymous form has one thing to key a budget on: the connecting address. `getClientIP` parses
the `CF-Connecting-IP` header Cloudflare attaches, and answers `null` when something else served
the request or the header is not an address, so every unidentified request shares one bucket
rather than going unlimited. An IPv6 client controls a whole `/64`, so `addressKey` keys on the
network the address sits in: the full address for IPv4, its `/64` for IPv6, and the shared
`"unknown"` bucket for `null`.

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

A denied request is answered with a `429` carrying `RateLimit`, `RateLimit-Policy` and
`Retry-After` before the handler runs; pass `onLimit` to render your own page instead. `prefix`
keeps the sign-up budget apart from any other limiter over the same namespace.

<note>
Callers behind one egress address, such as an office or a carrier-grade NAT, share a budget,
which is the cost of keying on an address at all. Set the limit for the busiest shared address
you expect to serve.
</note>

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

The Worker calls `createWebRouter()`, which defaults to `productionCaptcha()`, and a test
calls `createWebRouter(testCaptcha())`. `MemoryCaptcha` passes every non-empty token unless told otherwise, `failNext` queues one
refusal, and `last` records the token and address it was asked about, so a test drives both
branches without reaching Cloudflare. Its field is `captcha-response`, so a test posts that
instead of Turnstile's. Every failure carries a `code` that separates what the visitor can fix
(`rejected`, `expired`) from what the provider broke (`unavailable`); an `onFailure` that answers
`null` for `unavailable` keeps sign-ups open through a provider outage.

<warning>
An `onFailure` that lets `unavailable` through opens the form to every bot for as long as the
provider is down. Choose it only while the honeypot, the budget and the spam score stay in
front of the handler.
</warning>

## Score what was written

`scored`, the `spam(filter, options)` guard in the router, scores the submission before the
handler runs. Each entry in `fields` names a form field: `content` the free-text field, `email`
the one describing who sent it. The middleware reads their values from the parsed form and adds
`ctx.ip`, `ctx.userAgent` and the time the honeypot token signed, which the timing rule
scores: a form sent within three seconds of rendering is a signal. A spam verdict goes to
`onSpam`, here answered like a success so a bot learns nothing, and every other verdict reaches
the handler as `ctx.spamAssessment`. Without `onSpam`, spam is refused with a `422`.

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
existing account. `suggestDomain` from `@sdxc/email-address/typo` offers "did you mean
gmail.com?" for a mistyped provider.

## Check the password

With the address known, the handler checks the password against NIST's rules — at least 15
characters, not a common password, not built from the email, not in a breach.
[`@sdxc/validate`](/api/validate) reads the parsed form into `SIGN_UP` first.

```typescript {% title="app/http/controllers/sign-up/action.ts" %}
import type { RequestContext } from "remix/router";

import { checkPassword } from "@sdxc/password-policy";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";

import { checkYourEmail } from "~/app/http/controllers/sign-up/bots";
import { renderSignUp } from "~/app/http/controllers/sign-up/render";
import { passwordMessage } from "~/app/services/password-message";
import { checkSignUpEmail } from "~/app/services/sign-up-email";
import { createAccount } from "~/app/services/accounts";

const SIGN_UP = s.object({
	email: s.string(),
	password: s.string(),
	about: s.optional(s.string()),
});

export async function action(ctx: RequestContext): Promise<Response> {
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
}
```

The breach lookup sends Have I Been Pwned only the first five characters of the password's
SHA-1, and it runs after every local rule has passed, so `breach-check-unavailable` always means
an otherwise acceptable password — here it fails open. `issue` carries the values a message
needs (`minLength`, the matched `fragment`), so `passwordMessage` is your own function turning an
issue into copy. `createAccount` is your own service: hash the password exactly as submitted with
`password.hash` from [`@sdxc/crypto`](/api/crypto) there, and hold the account for review when it
is told to. An unsure spam verdict creates the account held for review.

<note>
The root import of `@sdxc/password-policy` bundles the common-password list, about 220 KB
gzipped. Import from `/length`, `/context` and `/breached` when the Worker's size matters more
than that check.
</note>

## Guard a newsletter sign-up

A newsletter box is the same kind of form with one field, and bots fill it to send confirmation
emails to addresses that never asked, which spends your list's sending reputation. The
guards mount the same way on its route, inside the same `createWebRouter`:

```typescript {% title="app/initializers/router.ts" %}
router.map(
	routes.subscribe.index,
	lazy(
		() => import("~/app/http/controllers/subscribe").then((it) => it.index),
		[trap],
	),
);
router.map(
	routes.subscribe.action,
	lazy(
		() => import("~/app/http/controllers/subscribe").then((it) => it.action),
		[trap, callerBudget("subscribe", 5), captcha(guard)],
	),
);
```

The form renders `HoneypotFields` and the challenge widget beside its email input, as the sign-up
form does. Inside the action, `checkSignUpEmail` runs before the address reaches the list,
because a disposable inbox or a domain with no mail server can never confirm. The subscribe call
itself is in [Run a newsletter list](/docs/data-and-background-work/newsletter). It answers an
address already on the list like a new one, so the trapped bot, the returning reader and the new
reader all land on the same page.

## Test the guards

Build the router with `testCaptcha()` and post to it as a browser would. The honeypot issues
the fields from the same secret the router reads, so the test signs a real token, and the
budget runs on the `RATE_LIMITS` mock, which you add to `app/test/cloudflare-workers.ts` as
`createKVNamespace()`:

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
- [Run a newsletter list](/docs/data-and-background-work/newsletter) — the subscribe action
  behind the guards above.
- [`@sdxc/spam`](/api/spam) — reputation providers, a trainable classifier and a Workers AI
  second opinion.
