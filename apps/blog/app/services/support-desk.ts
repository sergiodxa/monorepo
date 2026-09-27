/**
 * The server side of the Encore support form: the per-address budget a submission spends
 * and the delivery of an accepted request to the support inbox. The inbox and the sending
 * binding live in Worker configuration, so neither ever reaches the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Address, Transport } from "@sdxc/mail";
import type { Result } from "@sdxc/result";

import { Mailer } from "@sdxc/mail";
import { CloudflareAdapter } from "@sdxc/rate-limit";
import { failure, isFailure, success } from "@sdxc/result";

import type { SupportRequest } from "~/app/schemas/encore-support";

import { EncoreSupportEmail } from "~/app/emails/encore-support";

/**
 * Mailbox every request is sent from. The domain has to be a verified sender for the Workers
 * email binding; the visitor's own address travels as Reply-To, never as From, because a
 * From on a domain the sender does not control fails DMARC.
 */
export const SUPPORT_SENDER: Address = { email: "support@sergiodxa.com", name: "Encore Support" };

/**
 * Submissions one address may make per minute. Kept equal by hand to the
 * `SUPPORT_RATE_LIMITER` binding's `simple.limit` in `wrangler.jsonc`: a person rarely sends
 * more than one request, and a retry after a failure still fits.
 */
export const SUPPORT_RATE_LIMIT = 5;

/** Why a request could not be delivered, as a code the log records instead of the message. */
export class SupportDeliveryError extends Error {
	override name = "SupportDeliveryError";

	/**
	 * @param reason `unconfigured` when the inbox or binding is missing, `rejected` when the
	 * mail provider refused the message.
	 * @param options The provider's error, when there is one.
	 */
	constructor(
		public reason: "unconfigured" | "rejected",
		options?: ErrorOptions,
	) {
		super(`Support request not delivered: ${reason}`, options);
	}
}

/** What a support desk needs from the deployment; anything missing fails closed at delivery. */
export interface SupportDeskOptions {
	/** How mail leaves the worker; absent when the deployment declares no email binding. */
	transport: Transport | undefined;
	/** The address requests are delivered to. */
	inbox: string | undefined;
	/** The per-address budget; absent in a local run without the binding, which admits all. */
	limiter: RateLimit | undefined;
}

/**
 * Admits and delivers support requests. One instance per request, built by the
 * `supportDesk()` middleware and read by the controller as `ctx.supportDesk`.
 */
export class SupportDesk {
	#mailer: Mailer | undefined;
	#inbox: string | undefined;
	#adapter: CloudflareAdapter | undefined;

	/** @param options The deployment's transport, inbox and rate limiter. */
	constructor(options: SupportDeskOptions) {
		let { transport, inbox, limiter } = options;
		this.#mailer = transport ? new Mailer({ transport, from: SUPPORT_SENDER }) : undefined;
		this.#inbox = inbox?.trim() || undefined;
		this.#adapter = limiter
			? new CloudflareAdapter(limiter, { limit: SUPPORT_RATE_LIMIT, window: "1 minute" })
			: undefined;
	}

	/**
	 * Spends one unit of the client's budget. Every submission counts, valid or not, so a
	 * script probing the validation spends the same budget as one sending mail. A limiter that
	 * cannot answer admits the request, since the form is worth more than a perfect count.
	 *
	 * @param client The client address, or `unknown`, which then shares one budget.
	 * @returns Whether the request may proceed.
	 */
	async admit(client: string): Promise<boolean> {
		if (!this.#adapter) return true;
		let decision = await this.#adapter.consume(`encore-support:${client}`);
		if (isFailure(decision)) return true;
		return decision.data.allowed;
	}

	/**
	 * Mails the request to the support inbox and waits for the provider's answer, so the
	 * caller reports success only once the message was accepted.
	 *
	 * @param request The validated submission.
	 * @returns Success once the provider accepted the message.
	 */
	async deliver(request: SupportRequest): Promise<Result<void, SupportDeliveryError>> {
		if (!this.#mailer || !this.#inbox) return failure(new SupportDeliveryError("unconfigured"));

		let sent = await this.#mailer.send(new EncoreSupportEmail(this.#inbox, request));
		if (isFailure(sent)) {
			return failure(new SupportDeliveryError("rejected", { cause: sent.error }));
		}
		return success(undefined);
	}
}
