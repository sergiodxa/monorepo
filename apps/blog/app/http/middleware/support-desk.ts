/**
 * Publishes the Encore support desk on the request context as `ctx.supportDesk`, built from
 * the Worker's email binding, support inbox and rate limiter. A test installs its own mail
 * transport through the same seam and asserts on what would have been delivered.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Transport } from "@sdxc/mail";
import type { Middleware } from "remix/router";

import { CloudflareTransport } from "@sdxc/mail/cloudflare";

import { SupportDesk } from "~/app/services/support-desk";

/**
 * Declared in this imported module, so the property exists wherever the middleware does.
 */
declare module "remix/router" {
	interface RequestContext {
		/** Admits and delivers Encore support requests on the routes behind `supportDesk()`. */
		supportDesk: SupportDesk;
	}
}

/**
 * Creates the middleware publishing `ctx.supportDesk`. The transport is opened once per
 * isolate, since the binding it wraps is the same for every request.
 *
 * @param env Environment bindings, read for the email binding, inbox and rate limiter.
 * @param transport Delivery to use in place of the email binding, as a test supplies.
 * @returns Middleware that sets `ctx.supportDesk` before the handler runs.
 */
export default function supportDesk(env: App.Env, transport?: Transport): Middleware {
	let resolved = transport ?? (env.EMAIL ? new CloudflareTransport(env.EMAIL) : undefined);

	return (ctx, next) => {
		ctx.supportDesk = new SupportDesk({
			transport: resolved,
			inbox: env.SUPPORT_INBOX,
			limiter: env.SUPPORT_RATE_LIMITER,
		});
		return next();
	};
}
