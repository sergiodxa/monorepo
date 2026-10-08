/**
 * Subscribe use case. Puts a validated form's address on the newsletter with the
 * visitor's campaign attribution and IP, and records the outcome on the request's log, so
 * every page with an email field subscribes and reports the same way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Attribution } from "@sdxc/attribution";
import type { IP } from "@sdxc/ip";
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

/**
 * The campaign a new reader is credited to: the visitor's latest non-direct touch, or their
 * first when every later visit was direct, with the landing page resolved to an absolute URL.
 * A visitor with no stored touch, such as one sending Global Privacy Control, has none.
 *
 * @param attribution - The request's `ctx.attribution`.
 * @param url - The request URL the landing path is resolved against.
 * @example subscriberAttribution(ctx.attribution, ctx.url)
 */
export function subscriberAttribution(
	attribution: Pick<Attribution, "first" | "last">,
	url: URL,
): SubscriberAttribution | undefined {
	let touch = attribution.last ?? attribution.first;
	if (!touch) return undefined;
	return {
		source: touch.utm?.source,
		medium: touch.utm?.medium,
		campaign: touch.utm?.campaign,
		term: touch.utm?.term,
		content: touch.utm?.content,
		referrer: touch.referrer?.host,
		landingPage: new URL(touch.landingPath, url).href,
	};
}

/** Who is subscribing, beyond the address the form posted. */
export interface SubscribeContext {
	/** The campaign that brought the visitor, recorded only on a reader this call creates. */
	attribution?: SubscriberAttribution;
	/** The visitor's address, or `null` when `CF-Connecting-IP` is absent or malformed. */
	ip: IP | null;
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
		ip: visitor.ip,
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
