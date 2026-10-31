/**
 * Publishes the support desk on `ctx.supportDesk` for the support form, built over the
 * deployment's email binding and rate limiter. A test passes its own transport and spam
 * filter, so it reads what was mailed without a binding.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Transport } from "@sdxc/mail";
import type { SpamFilter } from "@sdxc/spam";
import type { Middleware } from "remix/router";

import { CloudflareTransport } from "@sdxc/mail/cloudflare";
import { env } from "cloudflare:workers";

import { createSupportSpamFilter, SupportDesk } from "~/app/services/support-desk";

declare module "remix/router" {
	interface RequestContext {
		supportDesk: SupportDesk;
	}
}

export interface SupportDeskMiddlewareOptions {
	/** Where mail goes; the deployment's email binding when omitted. */
	transport?: Transport;
	/** The address mail leaves from; the deployment's `EMAIL_FROM` when omitted. */
	from?: string;
	spamFilter?: SpamFilter;
	limiter?: RateLimit;
}

/** Creates the middleware; the support route lists it in its `lazy()` guards. */
export default function supportDesk(options: SupportDeskMiddlewareOptions = {}): Middleware {
	return (ctx, next) => {
		ctx.supportDesk = new SupportDesk({
			transport: options.transport ?? (env.EMAIL ? new CloudflareTransport(env.EMAIL) : undefined),
			from: options.from ?? env.EMAIL_FROM,
			limiter: options.limiter ?? env.SUPPORT_RATE_LIMITER,
			spamFilter: options.spamFilter ?? createSupportSpamFilter(),
		});
		return next();
	};
}
