/**
 * Subscribe use case. Puts a validated form's address on the newsletter with the
 * visitor's campaign attribution and IP, and records the outcome on the request's log, so
 * every page with an email field subscribes and reports the same way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {
	Newsletter,
	NewsletterError,
	SubscribeOutcome,
	SubscriberAttribution,
} from "@sdxc/newsletter";
import type { Result } from "@sdxc/result";

import { currentLog } from "@sdxc/logger";
import { isSuccess } from "@sdxc/result";

import type { SubscribeInput } from "~/app/http/validators/subscribe";

/** Who is subscribing, beyond the address the form posted. */
export interface SubscribeContext {
	/** The campaign that brought the visitor, recorded only on a reader this call creates. */
	attribution?: SubscriberAttribution;
	/** The visitor's canonical address, or `null` when `CF-Connecting-IP` is absent or malformed. */
	ipAddress: string | null;
}

/**
 * Subscribes an address. An address already on the list answers `created: false`, which
 * a caller treats as a success: every page that collects an email offers something in
 * return, and someone who subscribed last month still gets it.
 *
 * @param newsletter - The list to subscribe to.
 * @param payload - The validated form payload.
 * @param visitor - The visitor's attribution and IP.
 * @returns The outcome, or a failure whose `code` names a refusal the visitor can act on.
 */
export async function subscribe(
	newsletter: Newsletter,
	payload: SubscribeInput,
	visitor: SubscribeContext,
): Promise<Result<SubscribeOutcome, NewsletterError>> {
	let outcome = await newsletter.subscribers.subscribe({
		email: payload.email,
		attribution: visitor.attribution,
		ipAddress: visitor.ipAddress,
	});

	if (isSuccess(outcome)) {
		currentLog()?.set({
			subscribe: {
				result: outcome.data.created ? "subscribed" : "already-subscribed",
				status: outcome.data.subscriber.status,
				source: visitor.attribution?.source,
				campaign: visitor.attribution?.campaign,
				medium: visitor.attribution?.medium,
			},
		});
	}

	return outcome;
}
