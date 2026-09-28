/**
 * Router middleware that verifies a form's honeypot fields before the handler runs, publishes the
 * outcome as `ctx.honeypot`, and refuses a filled trap or a missing or forged token unless the
 * app's `onFailure` decides to answer it or let it through.
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

/** What a guarded handler reads: when the form was rendered, or why it was refused. */
export type HoneypotOutcome = Result<Honeypot.Verification, HoneypotError>;

/**
 * Declared in an imported module, so a project types `ctx.honeypot` by importing this
 * middleware.
 */
declare module "remix/router" {
	interface RequestContext {
		/**
		 * The outcome of verifying this submission's honeypot fields, published by
		 * `honeypot(instance)`. A failure reaches the handler only when `onFailure` answered `null`.
		 */
		honeypot: HoneypotOutcome;
	}
}

/**
 * The request's honeypot outcome, for code that reads it by key rather than through the
 * installed `honeypot` property. The type is written out because an exported key needs a
 * nameable type to reach a published declaration file.
 */
export const HoneypotKey: { defaultValue?: HoneypotOutcome } = createContextKey<HoneypotOutcome>();

/** Installs the outcome as `ctx.honeypot` besides the key. */
const HONEYPOT_PROPERTY = { property: "honeypot" } as const;

/** Content types a browser form submits, the only bodies honeypot fields arrive in. */
const FORM_CONTENT_TYPES = ["application/x-www-form-urlencoded", "multipart/form-data"];

/** Options for {@link honeypot}. */
export interface HoneypotMiddlewareOptions {
	/**
	 * Answers a refused submission: a `Response` refuses the request with it, `null` continues to
	 * the handler with the failure published on `ctx.honeypot`.
	 *
	 * @default a plain-text 400 response
	 */
	onFailure?: (
		error: HoneypotError,
		ctx: RequestContext,
	) => Response | null | Promise<Response | null>;
}

/**
 * Verifies the honeypot fields on every request the route receives, so install it on the action
 * that accepts the form. The body stays readable afterwards; with `formData()` installed, the
 * parsed form is reused. A body that is not a form is `missing-token`.
 *
 * @param instance - The honeypot that issued the form's fields
 * @param options - The failure policy
 * @returns The middleware
 * @example router.post(routes.comments, { middleware: [honeypot(instance)], handler })
 */
export function honeypot(
	instance: Honeypot,
	options: HoneypotMiddlewareOptions = {},
): Middleware<{ key: typeof HoneypotKey; value: HoneypotOutcome; property: "honeypot" }> {
	return async (ctx, next) => {
		let form = await readForm(ctx);
		let outcome: HoneypotOutcome =
			form === null ? failure(new HoneypotError("missing-token")) : await instance.verify(form);

		ctx.set(HoneypotKey, outcome, HONEYPOT_PROPERTY);
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
