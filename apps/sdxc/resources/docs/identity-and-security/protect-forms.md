---
title: Protect forms from bots and abuse
description: Layer a honeypot, a CAPTCHA, a per-address budget, spam scoring and address and password checks on a public sign-up form.
section:
    title: Identity & security
    order: 5
order: 4
lastUpdated: 2026-09-29
---

A form anyone can reach will be found by bots within days. No single check stops all of them,
and every check costs something — a network call, a moment of a person's attention — so this
guide stacks cheap checks in front of expensive ones on a sign-up form. Each layer refuses what
it can, and what reaches your handler has already survived the rest.

[`@sdxc/honeypot`](/api/honeypot) traps form-filling bots, [`@sdxc/rate-limit`](/api/rate-limit)
keyed by [`@sdxc/get-client-ip`](/api/get-client-ip) caps each address, [`@sdxc/captcha`](/api/captcha)
asks for a challenge, and inside the handler [`@sdxc/email-address`](/api/email-address),
[`@sdxc/password-policy`](/api/password-policy) and [`@sdxc/spam`](/api/spam) judge what was
submitted.

```bash
npm add @sdxc/honeypot @sdxc/captcha @sdxc/rate-limit @sdxc/get-client-ip \
	@sdxc/spam @sdxc/email-address @sdxc/password-policy @sdxc/validate \
	@sdxc/result @sdxc/http @sdxc/crypto
```

## Mount the guards on the route

The route is `signUp: form("/sign-up")` in `routes/web.ts`, beside a `checkYourEmail` page:
`index` renders the form, `action` accepts it. The honeypot
goes on both, because the page that renders the form has to issue the fields the submission is
checked against. The budget and the challenge go on the action alone.

```typescript {% title="bootstrap/sign-up.ts" %}
import type { Captcha } from "@sdxc/captcha";
import type { Router } from "remix/router";

import { captcha } from "@sdxc/captcha/middleware";
import { Honeypot } from "@sdxc/honeypot";
import { honeypot } from "@sdxc/honeypot/middleware";
import { env } from "cloudflare:workers";

import { action } from "~/app/http/controllers/sign-up/action";
import { answerTrappedBots } from "~/app/http/controllers/sign-up/bots";
import { index } from "~/app/http/controllers/sign-up/render";
import { callerBudget } from "~/app/http/middleware/rate-limit";
import routes from "~/routes/web";

const TRAP = new Honeypot({ secret: env.HONEYPOT_SECRET });

export function mountSignUp(router: Router, guard: Captcha): void {
	router.map(routes.signUp, {
		middleware: [honeypot(TRAP, { onFailure: answerTrappedBots })],
		actions: {
			index,
			action: {
				middleware: [callerBudget("sign-up", 5), captcha(guard)],
				handler: action,
			},
		},
	});
}
```

The order is the cost order. The honeypot is an HMAC check over two form fields. The budget is
one KV read and write. The challenge is a call to the provider. Only a submission that passes
all three is parsed, has its domain looked up in DNS and has its password checked against a
breach corpus. `guard` is the CAPTCHA provider, passed in so a test can hand in its own. The
router is the one your app already builds, with Remix's `formData()` in its global middleware:
the honeypot, the challenge and the handler all read the submission it parsed. Each module this
file imports is built in the sections below.

## A trap no person fills

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
is where `unwrap` belongs. Issue once per render, so a re-rendered form carries a fresh token.

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

## A budget per address

An anonymous form has one thing to key a budget on: the connecting address. `getClientIP` parses
the `CF-Connecting-IP` header Cloudflare attaches, and answers `null` when something else served
the request or the header is not an address, so every unidentified request shares one bucket
rather than going unlimited. An IPv6 client controls a whole `/64`, so the key is the network
the address sits in: the full address for IPv4, its `/64` for IPv6.

```typescript {% title="app/http/middleware/rate-limit.ts" %}
import type { Middleware } from "remix/router";

import { getClientIP } from "@sdxc/get-client-ip";
import { KVAdapter } from "@sdxc/rate-limit";
import { rateLimit } from "@sdxc/rate-limit/middleware";
import { env } from "cloudflare:workers";

export function callerBudget(prefix: string, limit: number): Middleware {
	return rateLimit({
		adapter: new KVAdapter(env.RATE_LIMITS, { limit, window: "10 minutes" }),
		prefix,
		key: (ctx) =>
			getClientIP(ctx.request)?.network({ v4: 32, v6: 64 }).toString() ??
			"unknown",
	});
}
```

A denied request is answered with a `429` carrying `RateLimit`, `RateLimit-Policy` and
`Retry-After` before the handler runs; pass `onLimit` to render your own page instead. `prefix`
keeps the sign-up budget apart from any other limiter over the same namespace. Callers behind
one egress address share a budget, which is the cost of keying on an address at all.

## A challenge, with a test provider

`captcha(provider)` verifies the field the provider's widget writes and refuses a failed token
with a `403`. `Captcha` is an interface, so the router takes whichever provider it is given:

```typescript {% title="app/lib/captcha.ts" %}
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

The Worker calls `mountSignUp(router, productionCaptcha())`, a test
`mountSignUp(router, testCaptcha())`. `MemoryCaptcha` passes every non-empty token unless told otherwise, `failNext` queues one
refusal, and `last` records the token and address it was asked about, so a test drives both
branches without reaching Cloudflare. Its field is `captcha-response`, so a test posts that
instead of Turnstile's. Every failure carries a `code` that separates what the visitor can fix
(`rejected`, `expired`) from what the provider broke (`unavailable`); an `onFailure` that answers
`null` for `unavailable` keeps sign-ups open through a provider outage.

## Check the address

Parse first, run the checks that need no network, then ask DNS whether the domain receives mail
at all.

```typescript {% title="app/lib/sign-up-email.ts" %}
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

## Check the password, then score the rest

With the address known, the handler checks the password against NIST's rules — at least 15
characters, not a common password, not built from the email, not in a breach — and scores the
free-text field. [`@sdxc/validate`](/api/validate) reads the parsed form into `SIGN_UP` first.

```typescript {% title="app/http/controllers/sign-up/action.ts" %}
import type { RequestContext } from "remix/router";

import { getClientIP } from "@sdxc/get-client-ip";
import { checkPassword } from "@sdxc/password-policy";
import { isFailure } from "@sdxc/result";
import { createSpamFilter, DEFAULT_RULES } from "@sdxc/spam";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";

import { checkYourEmail } from "~/app/http/controllers/sign-up/bots";
import { renderSignUp } from "~/app/http/controllers/sign-up/render";
import { passwordMessage } from "~/app/lib/password-message";
import { checkSignUpEmail } from "~/app/lib/sign-up-email";
import { createAccount } from "~/app/services/accounts";

const SIGN_UP = s.object({
	email: s.string(),
	password: s.string(),
	about: s.optional(s.string()),
});

const SPAM = createSpamFilter({ checks: DEFAULT_RULES });

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

	let assessment = await SPAM.check({
		content: form.data.about ?? "",
		author: {
			email: email.data.address,
			ip: getClientIP(ctx.request)?.toString(),
		},
		renderedAt: trap.data.renderedAt,
	});
	if (assessment.verdict === "spam") return checkYourEmail();

	let held = assessment.verdict === "unsure";
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
is told to. The root import of `@sdxc/password-policy` bundles the common-password list,
about 220 KB gzipped; import from `/length`, `/context` and `/breached` if that matters more.

`renderedAt` is the time the honeypot token signed, which the spam filter's timing rule scores:
a form sent within three seconds of rendering is a signal. A spam verdict is answered like a
success and creates nothing; an unsure one creates the account held for review.

## Where to go next

- [Validate forms and route params](/docs/building-remix-apps/forms-and-params) — the schema
  behind `SIGN_UP`.
- [Security headers and CSP](/docs/identity-and-security/security-headers) — allow the
  challenge's script and frame before enforcing a policy.
- [Add passkeys](/docs/identity-and-security/passkeys) — an account with no password to check.
- [`@sdxc/spam`](/api/spam) — reputation providers, a trainable classifier and a Workers AI
  second opinion.
