/**
 * Router middleware that publishes a honeypot on the request context as `ctx.honeypot`, so a
 * handler issues trap fields when it renders a form, and verifies the fields of every submission
 * before the handler runs, refusing a filled trap or a missing or forged token.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";
import type { Middleware, RequestContext } from "remix/router";

import { failure, isFailure } from "@sdxc/result";
import { createContextKey } from "remix/router";

import type { Honeypot } from "./index.js";

import { HoneypotError } from "./index.js";

/** What a guarded handler reads after a submission: when the form was rendered, or why not. */
export type HoneypotOutcome = Result<Honeypot.Verification, HoneypotError>;

/**
 * Declared in an imported module, so a project types `ctx.honeypot` and `ctx.honeypotOutcome`
 * by importing this middleware.
 */
declare module "remix/router" {
	interface RequestContext {
		/** The honeypot `honeypot(instance)` guards the route with, to issue a form's fields. */
		honeypot: Honeypot;
		/**
		 * The outcome of verifying this submission's honeypot fields, published for every method
		 * other than GET, HEAD and OPTIONS. A failure reaches the handler only when `onFailure`
		 * answered `null`.
		 */
		honeypotOutcome: HoneypotOutcome;
	}
}

/**
 * The request's honeypot, for code that reads it by key rather than through `ctx.honeypot`. The
 * type is written out because an exported key needs a nameable type to reach a declaration file.
 */
export const HoneypotKey: { defaultValue?: Honeypot } = createContextKey<Honeypot>();

/** The submission's outcome, for code that reads it by key rather than `ctx.honeypotOutcome`. */
export const HoneypotOutcomeKey: { defaultValue?: HoneypotOutcome } =
	createContextKey<HoneypotOutcome>();

/** Methods that render a form rather than submit one, which pass through unverified. */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Content types a browser form submits, the only bodies honeypot fields arrive in. */
const FORM_CONTENT_TYPES = ["application/x-www-form-urlencoded", "multipart/form-data"];

/** Options for {@link honeypot}. */
export interface HoneypotMiddlewareOptions {
	/**
	 * Answers a refused submission: a `Response` refuses the request with it, `null` continues to
	 * the handler with the failure published on `ctx.honeypotOutcome`.
	 *
	 * @default a plain-text 400 response
	 */
	onFailure?: (
		error: HoneypotError,
		ctx: RequestContext,
	) => Response | null | Promise<Response | null>;
}

/**
 * Publishes `instance` as `ctx.honeypot` on every request, and verifies the fields of every
 * submission, so one installation covers a route that renders a form and accepts it. The body
 * stays readable afterwards; with `formData()` installed, the parsed form is reused. A submitted
 * body that is not a form is `missing-token`.
 *
 * @param instance - The honeypot that issues and verifies the route's fields
 * @param options - The failure policy
 * @returns The middleware
 * @example router.map(routes.comments, { middleware: [honeypot(instance)], actions })
 */
export function honeypot(instance: Honeypot, options: HoneypotMiddlewareOptions = {}): Middleware {
	return async (ctx, next) => {
		ctx.set(HoneypotKey, instance, { property: "honeypot" });
		if (SAFE_METHODS.has(ctx.request.method)) return next();

		let form = await readForm(ctx);
		let outcome: HoneypotOutcome =
			form === null ? failure(new HoneypotError("missing-token")) : await instance.verify(form);

		ctx.set(HoneypotOutcomeKey, outcome, { property: "honeypotOutcome" });
		if (!isFailure(outcome)) return next();

		let answer = await (options.onFailure ?? refuse)(outcome.error, ctx);
		return answer ?? next();
	};
}

/**
 * The submitted form, or `null` when the body is not one. Reads `formData()`'s parsed form when
 * present, and otherwise a clone of the request, leaving the original body for the handler.
 */
async function readForm(ctx: RequestContext): Promise<FormData | null> {
	let parsed = ctx.has(FormData) ? ctx.get(FormData) : undefined;
	if (parsed !== undefined) return parsed;
	let contentType = ctx.request.headers.get("Content-Type") ?? "";
	if (!FORM_CONTENT_TYPES.some((type) => contentType.includes(type))) return null;
	try {
		return await ctx.request.clone().formData();
	} catch {
		return null;
	}
}

/** The default refusal: a plain 400, since the submission cannot proceed. */
function refuse(): Response {
	return new Response("Form submission refused", { status: 400 });
}
