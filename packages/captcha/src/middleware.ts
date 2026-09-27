/**
 * Router middleware that verifies the CAPTCHA token a form submitted with any `Captcha`
 * provider, publishes the outcome as `ctx.captcha`, and refuses a failed submission
 * unless the app's `onFailure` decides to answer it or let it through.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";
import type { Middleware, RequestContext } from "remix/router";

import { failure, isFailure } from "@sdxc/result";
import { createContextKey } from "remix/router";

import type { Captcha } from "./index.js";

import { CaptchaError } from "./index.js";

/** What a guarded handler reads: the provider's verification, or why it failed. */
export type CaptchaOutcome = Result<Captcha.Verification, CaptchaError>;

/**
 * Declared in an imported module, so a project types `ctx.captcha` by importing this
 * middleware.
 */
declare module "remix/router" {
	interface RequestContext {
		/**
		 * The outcome of verifying this submission's CAPTCHA token, published by
		 * `captcha(provider)` on every request it verifies. A failure reaches the handler
		 * only when `onFailure` answered `null`.
		 */
		captcha: CaptchaOutcome;
	}
}

/**
 * The request's verification outcome, for code that reads it by key rather than through
 * the installed `captcha` property. The type is written out because an exported key needs
 * a nameable type to reach a published declaration file.
 */
export const CaptchaKey: { defaultValue?: CaptchaOutcome } = createContextKey<CaptchaOutcome>();

/** Installs the outcome as `ctx.captcha` besides the key. */
const CAPTCHA_PROPERTY = { property: "captcha" } as const;

/** Content types a browser form submits, the only bodies a widget's field arrives in. */
const FORM_CONTENT_TYPES = ["application/x-www-form-urlencoded", "multipart/form-data"];

/** Options for {@link captcha}. */
export interface CaptchaMiddlewareOptions {
	/**
	 * The action the widget on this route was rendered with. A verification reporting a
	 * different action, or none, fails with `action-mismatch`.
	 */
	action?: string;
	/**
	 * The hostname the widget is served from. A verification reporting a different
	 * hostname, or none, fails with `hostname-mismatch`.
	 */
	hostname?: string;
	/**
	 * Resolves the visitor's address, passed to the provider as `remoteIp`.
	 *
	 * @default reads the `CF-Connecting-IP` header
	 */
	remoteIp?: (request: Request) => string | null | undefined;
	/**
	 * Answers a failed verification: a `Response` refuses the request with it, `null`
	 * continues to the handler with the failure published on `ctx.captcha`.
	 *
	 * @default a plain-text 403 response
	 */
	onFailure?: (
		error: CaptchaError,
		ctx: RequestContext,
	) => Response | null | Promise<Response | null>;
}

/**
 * Verifies the token in `provider.field` on every request the route receives, so install it
 * on the action that accepts the submission. The body stays readable afterwards; with
 * `formData()` installed, the parsed form is reused.
 *
 * @param provider - The CAPTCHA provider whose widget the form embeds
 * @param options - The expected action and hostname, the address resolver and the failure policy
 * @returns The middleware
 * @example router.post(routes.signUp, { middleware: [captcha(turnstile, { action: "sign-up" })], handler })
 */
export function captcha(
	provider: Captcha,
	options: CaptchaMiddlewareOptions = {},
): Middleware<{ key: typeof CaptchaKey; value: CaptchaOutcome; property: "captcha" }> {
	return async (ctx, next) => {
		let token = await readToken(ctx, provider.field);
		let remoteIp = (options.remoteIp ?? connectingIp)(ctx.request) ?? undefined;
		let outcome: CaptchaOutcome =
			token === null
				? failure(new CaptchaError("missing-token"))
				: checkExpectations(
						await provider.verify(token, remoteIp === undefined ? {} : { remoteIp }),
						options,
					);

		ctx.set(CaptchaKey, outcome, CAPTCHA_PROPERTY);
		if (!isFailure(outcome)) return next();

		let answer = await (options.onFailure ?? refuse)(outcome.error, ctx);
		return answer ?? next();
	};
}

/**
 * The submitted token, or `null` when the body is not a form or lacks the field. Reads
 * `formData()`'s parsed form when present, and otherwise a clone of the request, leaving
 * the original body for the handler.
 *
 * @param ctx - The request context
 * @param field - The provider's form field
 * @returns The token, or `null`
 */
async function readToken(ctx: RequestContext, field: string): Promise<string | null> {
	let form = ctx.has(FormData) ? ctx.get(FormData) : undefined;
	if (form === undefined) {
		let contentType = ctx.request.headers.get("Content-Type") ?? "";
		if (!FORM_CONTENT_TYPES.some((type) => contentType.includes(type))) return null;
		try {
			form = await ctx.request.clone().formData();
		} catch {
			return null;
		}
	}

	let value = form.get(field);
	return typeof value === "string" && value !== "" ? value : null;
}

/**
 * Holds a successful verification to the route's expected action and hostname, so a
 * token minted for another form or site fails even though the provider accepted it.
 *
 * @param outcome - The provider's answer
 * @param options - The expectations
 * @returns The outcome, or a mismatch failure
 */
function checkExpectations(
	outcome: CaptchaOutcome,
	options: CaptchaMiddlewareOptions,
): CaptchaOutcome {
	if (isFailure(outcome)) return outcome;
	if (options.action !== undefined && outcome.data.action !== options.action) {
		return failure(new CaptchaError("action-mismatch"));
	}
	if (options.hostname !== undefined && outcome.data.hostname !== options.hostname) {
		return failure(new CaptchaError("hostname-mismatch"));
	}
	return outcome;
}

/**
 * The address Cloudflare reports for the connecting visitor.
 *
 * @param request - The incoming request
 * @returns The `CF-Connecting-IP` header, or `null`
 */
function connectingIp(request: Request): string | null {
	return request.headers.get("CF-Connecting-IP");
}

/**
 * The default failure answer: a plain 403, since the form cannot proceed.
 *
 * @returns The refusal
 */
function refuse(): Response {
	return new Response("CAPTCHA verification failed", { status: 403 });
}
