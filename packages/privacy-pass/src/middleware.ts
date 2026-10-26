/**
 * Router integration: middleware publishing one `PrivacyPass` instance as `ctx.privacyPass`,
 * and a handler that redeems the request's token or challenges for one, answering in the
 * shape a hidden `<img>` probe or a `fetch` from the page expects.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Middleware, RequestContext } from "remix/router";

import { currentLog } from "@sdxc/logger";
import { isFailure } from "@sdxc/result";
import { createContextKey } from "remix/router";

import type { PrivacyPass } from "./privacy-pass.js";

/**
 * Declared in an imported module, so a project types `ctx.privacyPass` by importing this
 * middleware.
 */
declare module "remix/router" {
	interface RequestContext {
		/** Challenges for and redeems Privacy Pass tokens on the routes behind `privacyPass()`. */
		privacyPass: PrivacyPass;
	}
}

/**
 * The published instance, for code that reads it by key rather than `ctx.privacyPass`. The type
 * is written out because an exported key needs a nameable type to reach a declaration file.
 */
export const PrivacyPassKey: { defaultValue?: PrivacyPass } = createContextKey<PrivacyPass>();

/** Every answer belongs to one client and one challenge, so nothing may store it. */
const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Publishes `instance` as `ctx.privacyPass`. Build the instance once per isolate, so the
 * issuer's keys are fetched once and reused until their `max-age` passes.
 *
 * @param instance - The origin's challenger and redeemer
 * @returns Middleware that sets `ctx.privacyPass` before the handler runs
 * @example router.get(routes.privacyPass, { middleware: [privacyPass(instance)], handler })
 */
export function privacyPass(
	instance: PrivacyPass,
): Middleware<{ key: typeof PrivacyPassKey; value: PrivacyPass; property: "privacyPass" }> {
	return (ctx, next) => {
		ctx.set(PrivacyPassKey, instance, { property: "privacyPass" });
		return next();
	};
}

/** Options for {@link redeemOrChallenge}. */
export interface RedeemOrChallengeOptions {
	/**
	 * Runs once a token redeems; the headers it returns join the `204`, as a `Set-Cookie`
	 * remembering the client was vouched for.
	 */
	onRedeem?: (
		redemption: PrivacyPass.Redemption,
		ctx: RequestContext,
	) => HeadersInit | void | Promise<HeadersInit | void>;
}

/**
 * Redeems the request's `Authorization: PrivateToken`, or challenges for one. A client without
 * tokens, or an issuer that cannot be reached, gets an answer it can ignore, so a page probing
 * with a hidden image keeps working. Each outcome is recorded on the current log as `privacyPass`.
 *
 * @param ctx - A request context behind `privacyPass()`
 * @param options - What to add to a redeemed answer
 * @returns `204` once a token redeems or the issuer is unavailable, `401` with a challenge
 * otherwise; every answer is `no-store`
 * @example router.get(routes.privacyPass, { middleware: [privacyPass(instance)], handler: (ctx) => redeemOrChallenge(ctx) })
 */
export async function redeemOrChallenge(
	ctx: RequestContext<any, any>,
	options: RedeemOrChallengeOptions = {},
): Promise<Response> {
	let instance = ctx.privacyPass;
	let authorization = ctx.request.headers.get("Authorization");
	if (authorization !== null) {
		let redeemed = await instance.redeem(authorization);
		if (!isFailure(redeemed)) {
			currentLog()?.set({ privacyPass: { outcome: "redeemed" } });
			let headers = new Headers(NO_STORE);
			let extra = await options.onRedeem?.(redeemed.data, ctx);
			if (extra) new Headers(extra).forEach((value, name) => headers.append(name, value));
			return new Response(null, { status: 204, headers });
		}
		currentLog()?.set({ privacyPass: { outcome: "refused", reason: redeemed.error.code } });
	}

	let challenge = await instance.challenge();
	if (isFailure(challenge)) {
		currentLog()?.set({ privacyPass: { outcome: "unavailable", reason: challenge.error.code } });
		return new Response(null, { status: 204, headers: NO_STORE });
	}

	return new Response(null, {
		status: 401,
		headers: { ...NO_STORE, "WWW-Authenticate": challenge.data },
	});
}
