/**
 * The models an app programs against: a subscriber in four normalized states,
 * what a subscribe and an update carry, campaign attribution, cursor pages and
 * the inbound events, so no caller reads a platform's own vocabulary.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EmailAddress } from "@sdxc/email-address";
import type { IP } from "@sdxc/ip";
import type { Result } from "@sdxc/result";

/**
 * Page size a list uses when the caller names no `limit`, which is the largest
 * page every supported platform serves in one request.
 */
export const DEFAULT_PAGE_SIZE = 100;

/**
 * Where a reader stands with the list. `pending` awaits a confirmation click,
 * `suppressed` is an address the platform refuses to mail (blocked, bounced or
 * complained), and the platform's own value travels in `providerStatus`.
 */
export type SubscriberStatus = "pending" | "active" | "unsubscribed" | "suppressed";

/** A reader on the list, as the platform holds it. */
export interface Subscriber {
	id: string;
	/** The address as the platform stores it. */
	email: string;
	status: SubscriberStatus;
	/** The platform's own state, for logs and support tickets. */
	providerStatus: string;
	metadata: Readonly<Record<string, string>>;
	createdAt: Date;
}

/**
 * Addresses one subscriber, by the platform's id or by address. An address
 * arrives parsed, so a lookup differing only in local-part case finds the
 * same reader on a platform that compares canonically.
 */
export type SubscriberRef = { id: string } | { email: EmailAddress };

/**
 * Campaign data for a new subscriber. Every field is an optional string, so a
 * touch read by an attribution package passes as it is and its extra fields
 * are ignored; values are written as handed over.
 */
export interface SubscriberAttribution {
	source?: string;
	medium?: string;
	campaign?: string;
	term?: string;
	content?: string;
	/** The page that sent the visitor: a URL, or a hostname when that is all that was kept. */
	referrer?: string;
	/** The absolute URL of the page the form was on. */
	landingPage?: string;
}

/** What a subscribe sends. Tags, metadata and attribution apply only to a reader it creates. */
export interface SubscribeInput {
	email: EmailAddress;
	tags?: readonly string[];
	metadata?: Readonly<Record<string, string>>;
	attribution?: SubscriberAttribution;
	/**
	 * The visitor's address, for platforms that screen sign-ups by IP. The result
	 * of `IP.parse` is accepted as it is; a failed parse records no address.
	 */
	ip?: IP | Result<IP, IP.Error> | null;
}

/** What a subscribe answers once the address is on the list. */
export interface SubscribeOutcome {
	subscriber: Subscriber;
	/** `false` when the address was already on the list, in any status. */
	created: boolean;
}

/** A change to a known reader; tags are added and removed by name. */
export interface UpdateSubscriberInput {
	tags?: { add?: readonly string[]; remove?: readonly string[] };
	/** Merged into the stored metadata; a `null` value removes that key. */
	metadata?: Readonly<Record<string, string | null>>;
}

/** Narrows a list; omitted fields match every subscriber. */
export interface ListSubscribersQuery {
	status?: SubscriberStatus;
	tag?: string;
	/** @default DEFAULT_PAGE_SIZE */
	limit?: number;
	/** The `cursor` of the previous page; omitted starts from the first. */
	cursor?: string;
}

/**
 * One page of a list. Only `cursor === null` ends a walk, since a platform may
 * answer a short or empty page before its last one.
 */
export interface Page<T> {
	items: T[];
	cursor: string | null;
}

/**
 * What an inbound event says happened. A type the platform sends that has no
 * arm here arrives as `unrecognized`, so a new platform event is a no-op for
 * an endpoint rather than a failure the platform disables it for.
 */
export type NewsletterEventPayload =
	| { type: "subscriber.created" }
	| { type: "subscriber.confirmed" }
	| { type: "subscriber.unsubscribed" }
	| { type: "subscriber.suppressed" }
	| { type: "subscriber.updated" }
	| { type: "subscriber.deleted" }
	| { type: "unrecognized"; providerType: string };

/** One normalized inbound event; a platform delivery may carry several. */
export type NewsletterEvent = NewsletterEventPayload & {
	/** The platform's event id: the deduplication key across redeliveries. */
	id: string;
	occurredAt: Date | null;
	subscriberId: string;
	/**
	 * The subscriber as the delivery described it, or `null` when the platform
	 * sent only its id; `subscribers.find` reads the record then.
	 */
	subscriber: Subscriber | null;
	/** The platform's payload for this event, for a field the models omit. */
	raw: unknown;
};
