/**
 * The rate limit classes protecting a tenant's anonymous surfaces: interactive
 * credential submissions, the mail-sending routes, the token endpoint,
 * `/authorize`, and the read-only protocol endpoints. Each is one `rateLimit`
 * registration, and every route it is mounted on shares that one registration's
 * budget — an address (or, for mail-sending, a submitted identifier) spends
 * from the same counter regardless of which of a class's routes it hit. The
 * management API's own tiered rate limiting lives in `management-rate-limit.ts`
 * instead, since it is keyed on a resolved caller rather than an address.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Adapter, RateLimiterBinding, RateLimitKVNamespace } from "@sdxc/rate-limit";
import type { Middleware, RequestContext } from "remix/router";

import { CloudflareAdapter, KVAdapter } from "@sdxc/rate-limit";
import { rateLimit } from "@sdxc/rate-limit/middleware";
import { createContextKey } from "remix/router";

import { renderRateLimitedPage } from "~/app/http/controllers/hosted/rate-limited";
import { resolveClientAuth } from "~/app/http/controllers/oauth/token";
import { clientAddressKey } from "~/app/lib/client-address";
import { foldIdentifier } from "~/database/subject-identifiers";

/** What one credential attempt spent against, so a wrong credential can spend past the request itself. */
export interface CredentialRateLimitSpend {
	/** The adapter the attempt was counted against. */
	adapter: Adapter;
	/** The namespaced key the attempt was counted against. */
	key: string;
}

export const CredentialRateLimitContext = createContextKey<CredentialRateLimitSpend>();

declare module "remix/router" {
	interface RequestContext {
		/**
		 * The adapter and namespaced key this request's own interactive-credential
		 * attempt was counted against, present on every route
		 * `interactiveCredentialRateLimit` guards.
		 */
		credentialRateLimit: CredentialRateLimitSpend;
	}
}

const CREDENTIAL_PREFIX = "credential";
const CREDENTIAL_LIMIT = 10;
const CREDENTIAL_WINDOW = "10 seconds";

/**
 * Extra budget units a wrong credential spends beyond the request itself, so
 * an address working a list of guesses runs out of budget several times
 * faster than one whose attempts mostly succeed.
 */
export const CREDENTIAL_FAILURE_SPEND = 4;

/**
 * Guards every interactive credential surface — sign-in, sign-up, the
 * password reset form, and the second-factor completion — with one shared
 * per-address budget. Closed, since an uncounted attempt here is unlimited
 * guessing rather than a refused one. Exposes the same adapter and namespaced
 * key on the context as `credentialRateLimit`, so a wrong credential can spend
 * past the request itself.
 *
 * @param limiter - The `CREDENTIAL_RATE_LIMITER` binding.
 * @returns The middleware, for a route's own `middleware` array.
 * @example
 * router.map(routes.hostedSignInSubmit, {
 * 	middleware: [interactiveCredentialRateLimit(env.CREDENTIAL_RATE_LIMITER)],
 * 	handler: signInSubmit,
 * });
 */
export function interactiveCredentialRateLimit(limiter: RateLimiterBinding): Middleware {
	let adapter = new CloudflareAdapter(limiter, {
		limit: CREDENTIAL_LIMIT,
		window: CREDENTIAL_WINDOW,
	});

	let limited = rateLimit({
		adapter,
		prefix: CREDENTIAL_PREFIX,
		key: (context) => clientAddressKey(context.request),
		failurePolicy: "closed",
		onLimit: (context) => renderRateLimitedPage(context),
	});

	return (context, next) => {
		let key = `${CREDENTIAL_PREFIX}:${clientAddressKey(context.request)}`;
		context.set(CredentialRateLimitContext, { adapter, key }, { property: "credentialRateLimit" });
		return limited(context, next);
	};
}

const MAIL_PREFIX = "mail-send";
const MAIL_LIMIT = 5;
const MAIL_WINDOW = "1 hour";

/** The form fields a mail-sending route may submit a raw identifier under. */
const MAIL_IDENTIFIER_FIELDS = ["identifier", "email"] as const;

/** Reads the first of these form fields a request actually submitted. */
function firstFormValue(formData: FormData, names: readonly string[]): string | null {
	for (let name of names) {
		let value = formData.get(name);
		if (typeof value === "string" && value.length > 0) return value;
	}
	return null;
}

/**
 * Folds a submitted identifier the way sign-up, reset and verify-resend
 * already store it, guessing email vs username from its shape since the
 * mail-sending budget has no separate field naming which one was typed.
 */
function foldedMailKey(value: string): string {
	let folded = foldIdentifier(value.includes("@") ? "email" : "username", value);
	return folded.ok ? folded.folded : value.normalize("NFKC").toLowerCase();
}

export interface MailSendingRateLimitOptions {
	/** Requests to let through uncounted, e.g. the reset form's own complete leg, which sends no mail. */
	skip?: (context: RequestContext) => boolean | Promise<boolean>;
}

/**
 * Guards every mail-sending surface — the password reset request, sign-up's
 * own verification send, and the verification resend — with one shared
 * budget keyed on the identifier a request actually submitted, or its
 * connecting address when it names none. Closed, since an uncounted attempt
 * here is unlimited mail rather than a refused one.
 *
 * `KVAdapter` carries this class's hour-long window, since a rate limiter
 * binding only ever declares a 10- or 60-second period; every other class's
 * window fits that period and sits over `CloudflareAdapter` instead.
 *
 * @param kv - The `MAIL_RATE_LIMIT_KV` namespace.
 * @param options - A `skip` predicate for a route whose own leg sends no mail.
 * @returns The middleware, for a route's own `middleware` array.
 * @example
 * router.map(routes.hostedResetSubmit, {
 * 	middleware: [
 * 		interactiveCredentialRateLimit(env.CREDENTIAL_RATE_LIMITER),
 * 		mailSendingRateLimit(env.MAIL_RATE_LIMIT_KV, {
 * 			skip: (context) => context.url.searchParams.get("ticket") !== null,
 * 		}),
 * 	],
 * 	handler: resetSubmit,
 * });
 */
export function mailSendingRateLimit(
	kv: RateLimitKVNamespace,
	options: MailSendingRateLimitOptions = {},
): Middleware {
	let adapter = new KVAdapter(kv, { limit: MAIL_LIMIT, window: MAIL_WINDOW });

	return rateLimit({
		adapter,
		prefix: MAIL_PREFIX,
		key: (context) => {
			let identifier = firstFormValue(context.formData, MAIL_IDENTIFIER_FIELDS);
			return identifier ? foldedMailKey(identifier) : clientAddressKey(context.request);
		},
		skip: options.skip,
		failurePolicy: "closed",
		onLimit: (context) => renderRateLimitedPage(context),
	});
}

const TOKEN_PREFIX = "token";
const TOKEN_LIMIT = 60;
const TOKEN_WINDOW = "10 seconds";

/**
 * Guards `/oauth/token` with a per-client budget when a request authenticates
 * one, falling back to its connecting address otherwise. Open, so a limiter
 * outage never stops every tenant's clients from exchanging tokens at once.
 *
 * @param limiter - The `TOKEN_RATE_LIMITER` binding.
 * @returns The middleware, for the token route's own `middleware` array.
 * @example
 * router.map(routes.token, { middleware: [tokenRateLimit(env.TOKEN_RATE_LIMITER)], handler: token });
 */
export function tokenRateLimit(limiter: RateLimiterBinding): Middleware {
	let adapter = new CloudflareAdapter(limiter, { limit: TOKEN_LIMIT, window: TOKEN_WINDOW });

	return rateLimit({
		adapter,
		prefix: TOKEN_PREFIX,
		key: (context) => {
			let resolved = resolveClientAuth(context.request, context.formData);
			return resolved.ok ? resolved.auth.clientId : clientAddressKey(context.request);
		},
		failurePolicy: "open",
	});
}

const AUTHORIZATION_PREFIX = "authorization";
const AUTHORIZATION_LIMIT = 30;
const AUTHORIZATION_WINDOW = "10 seconds";

/**
 * Guards `/authorize` with a per-address budget. Open, so a limiter outage
 * never stops an authorization request already underway.
 *
 * @param limiter - The `AUTHORIZATION_RATE_LIMITER` binding.
 * @returns The middleware, for the authorize route's own `middleware` array.
 * @example
 * router.map(routes.authorize, {
 * 	middleware: [authorizationRateLimit(env.AUTHORIZATION_RATE_LIMITER)],
 * 	handler: authorize,
 * });
 */
export function authorizationRateLimit(limiter: RateLimiterBinding): Middleware {
	let adapter = new CloudflareAdapter(limiter, {
		limit: AUTHORIZATION_LIMIT,
		window: AUTHORIZATION_WINDOW,
	});

	return rateLimit({
		adapter,
		prefix: AUTHORIZATION_PREFIX,
		key: (context) => clientAddressKey(context.request),
		failurePolicy: "open",
	});
}

const PROTOCOL_PREFIX = "protocol";
const PROTOCOL_LIMIT = 120;
const PROTOCOL_WINDOW = "10 seconds";

/**
 * Guards the read-only protocol endpoints — discovery, JWKS, and `/userinfo`
 * — with one shared per-address budget. Open, so a limiter outage never stops
 * a relying party resolving a tenant's metadata or a subject's claims.
 *
 * @param limiter - The `PROTOCOL_RATE_LIMITER` binding.
 * @returns The middleware, for each protected route's own `middleware` array.
 * @example
 * router.map(routes.userinfoGet, {
 * 	middleware: [protocolRateLimit(env.PROTOCOL_RATE_LIMITER)],
 * 	handler: userinfoGet,
 * });
 */
export function protocolRateLimit(limiter: RateLimiterBinding): Middleware {
	let adapter = new CloudflareAdapter(limiter, { limit: PROTOCOL_LIMIT, window: PROTOCOL_WINDOW });

	return rateLimit({
		adapter,
		prefix: PROTOCOL_PREFIX,
		key: (context) => clientAddressKey(context.request),
		failurePolicy: "open",
	});
}
