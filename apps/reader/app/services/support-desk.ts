/**
 * The support desk: decides whether a support form submission is let through, judges it
 * for spam, and mails it to the inbox a person answers, with the sender as reply-to. The
 * inbox never reaches a page, so it is only ever written to by this form.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Transport } from "@sdxc/mail";
import type { Result } from "@sdxc/result";
import type { SpamFilter } from "@sdxc/spam";

import { Mailer } from "@sdxc/mail";
import { CloudflareAdapter } from "@sdxc/rate-limit";
import { failure, isFailure, success } from "@sdxc/result";
import { createSpamFilter, DEFAULT_RULES } from "@sdxc/spam";

import type { SupportInput } from "~/app/http/validators/support";

import emails from "~/app/emails";
import { mail } from "~/app/initializers/mail";
import { SUPPORT_INBOX } from "~/config/support";

/**
 * Submissions one network may send a minute. Kept equal by hand to the
 * `SUPPORT_RATE_LIMITER` binding's `simple.limit` in `wrangler.jsonc`.
 */
export const SUPPORT_RATE_LIMIT = 5;

/** The spam rules a support message is judged by, which need no network of their own. */
export function createSupportSpamFilter(): SpamFilter {
	return createSpamFilter({ checks: DEFAULT_RULES });
}

/** What is known about who sent a submission, beyond what they typed. */
export interface SupportSender {
	ip?: string;
	userAgent?: string;
	/** When the form was drawn, which a submission sent too fast for a person betrays. */
	renderedAt?: Date;
	/** Whether the sender was signed in, which tells support where to look. */
	signedIn: boolean;
}

/** Why a submission that passed every check was not mailed. */
export class SupportDeliveryError extends Error {
	override name = "SupportDeliveryError";

	constructor(
		public reason: "unconfigured" | "rejected",
		options?: ErrorOptions,
	) {
		super(`Support request not delivered: ${reason}`, options);
	}
}

export interface SupportDeskOptions {
	/** How mail leaves; absent on a deployment with no email binding, which refuses every send. */
	transport: Transport | undefined;
	/** The address mail is sent from, which the email binding is allowed to use. */
	from: string | undefined;
	/** The burst limit per network; absent, every submission is admitted. */
	limiter: RateLimit | undefined;
	spamFilter: SpamFilter;
}

/** The one support desk a request uses, published on the context by its middleware. */
export class SupportDesk {
	#mailer: Mailer | undefined;
	#adapter: CloudflareAdapter | undefined;
	#spamFilter: SpamFilter;

	constructor(options: SupportDeskOptions) {
		let { from, limiter, spamFilter, transport } = options;
		this.#spamFilter = spamFilter;
		this.#mailer =
			transport && from
				? new Mailer({ transport, from: { email: from, name: "Reader Support" }, mail })
				: undefined;
		this.#adapter = limiter
			? new CloudflareAdapter(limiter, { limit: SUPPORT_RATE_LIMIT, window: "1 minute" })
			: undefined;
	}

	/**
	 * Whether a network may send another submission now. A limiter that fails to answer
	 * admits, so an outage of the limit never locks a person out of support.
	 */
	async admit(network: string): Promise<boolean> {
		if (!this.#adapter) return true;
		let decision = await this.#adapter.consume(`support:${network}`);
		if (isFailure(decision)) return true;
		return decision.data.allowed;
	}

	/** Judges a submission's message and sender for spam. */
	assess(input: SupportInput, sender: SupportSender): Promise<SpamFilter.Assessment> {
		return this.#spamFilter.check({
			content: input.message,
			format: "text",
			author: {
				name: input.name || undefined,
				email: input.email,
				ip: sender.ip,
				userAgent: sender.userAgent,
			},
			renderedAt: sender.renderedAt,
		});
	}

	/** Mails a submission to the support inbox, replying to its sender. */
	async deliver(
		input: SupportInput,
		sender: SupportSender,
	): Promise<Result<void, SupportDeliveryError>> {
		if (!this.#mailer) return failure(new SupportDeliveryError("unconfigured"));

		let sent = await this.#mailer.send(emails.support, {
			to: SUPPORT_INBOX,
			props: {
				name: input.name,
				email: input.email,
				topic: input.topic,
				page: input.page,
				message: input.message,
				signedIn: sender.signedIn,
			},
		});
		if (isFailure(sent))
			return failure(new SupportDeliveryError("rejected", { cause: sent.error }));
		return success(undefined);
	}
}
