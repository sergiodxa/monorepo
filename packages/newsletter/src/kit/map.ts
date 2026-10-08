/**
 * Translation between Kit's vocabulary and ours: subscriber states, records,
 * webhook event types, and the form `referrer` attribution travels in. Kept
 * apart from the client so every mapping rule is read and tested in one place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {
	NewsletterEventPayload,
	Subscriber,
	SubscriberAttribution,
	SubscriberStatus,
} from "../types.js";

import type { KitSubscriber } from "./schemas.js";

/**
 * Our status for each Kit `state`. A state outside the table is a mapping gap,
 * which `find` reports and `list` skips.
 */
const STATES: Readonly<Record<string, SubscriberStatus>> = {
	inactive: "pending",
	active: "active",
	cancelled: "unsubscribed",
	bounced: "suppressed",
	complained: "suppressed",
};

/**
 * The `status` filter Kit's list endpoints take for each of ours. Kit splits
 * `suppressed` across two states and filters by one, so that status lists
 * every state and is narrowed on the rows.
 */
const STATUS_FILTERS: Readonly<Record<SubscriberStatus, string>> = {
	pending: "inactive",
	active: "active",
	unsubscribed: "cancelled",
	suppressed: "all",
};

/** An event name this provider maps a Kit delivery onto. */
type MappedEventType = Exclude<NewsletterEventPayload["type"], "unrecognized">;

/**
 * Our event for each Kit subscriber event. Everything absent arrives as
 * `unrecognized`, so an event type Kit adds is a no-op for an endpoint.
 */
const EVENT_TYPES: Readonly<Record<string, MappedEventType>> = {
	"subscriber.created": "subscriber.created",
	"subscriber.activated": "subscriber.confirmed",
	"subscriber.unsubscribed": "subscriber.unsubscribed",
	"subscriber.bounced": "subscriber.suppressed",
	"subscriber.complained": "subscriber.suppressed",
	"subscriber.tag_added": "subscriber.updated",
	"subscriber.tag_removed": "subscriber.updated",
	"subscriber.custom_field_value_updated": "subscriber.updated",
};

/** Every field of an attribution, in the order a dropped-field note lists them. */
const ATTRIBUTION_FIELDS: readonly (keyof SubscriberAttribution)[] = [
	"source",
	"medium",
	"campaign",
	"term",
	"content",
	"referrer",
	"landingPage",
];

/** Campaign fields and the `utm_*` parameter each is written as on the landing page. */
const UTM_PARAMETERS: readonly (readonly [keyof SubscriberAttribution, string])[] = [
	["source", "utm_source"],
	["medium", "utm_medium"],
	["campaign", "utm_campaign"],
	["term", "utm_term"],
	["content", "utm_content"],
];

/**
 * Our status for a Kit state.
 *
 * @returns The status, or `null` for a state this provider has no mapping for.
 */
export function statusOf(state: string): SubscriberStatus | null {
	return STATES[state] ?? null;
}

/** Kit's list filter for one of our statuses, `all` when the caller names none. */
export function statusFilterOf(status: SubscriberStatus | undefined): string {
	return status === undefined ? "all" : STATUS_FILTERS[status];
}

/**
 * Maps a Kit record into ours. Custom fields Kit holds no value in arrive as
 * `null` and are left out, so `metadata` lists only the keys that are set.
 *
 * @returns The subscriber, or `null` when its state has no mapping.
 */
export function toSubscriber(record: KitSubscriber): Subscriber | null {
	let status = statusOf(record.state);
	if (status === null) return null;

	let metadata: Record<string, string> = {};
	for (let [key, value] of Object.entries(record.fields ?? {})) {
		if (value !== null) metadata[key] = String(value);
	}

	return {
		id: String(record.id),
		email: record.email_address,
		status,
		providerStatus: record.state,
		metadata: Object.freeze(metadata),
		createdAt: new Date(record.created_at),
	};
}

/** Our event payload for a Kit event type. */
export function eventPayloadOf(type: string): NewsletterEventPayload {
	let mapped = EVENT_TYPES[type];
	return mapped === undefined ? { type: "unrecognized", providerType: type } : { type: mapped };
}

/** What a form add can carry of an attribution, and what it had to leave behind. */
export interface FormReferrer {
	/** The landing page with the campaign fields appended, or `null` without one. */
	referrer: string | null;
	/** Attribution fields that were set and have no place on Kit. */
	dropped: string[];
}

/**
 * Builds the `referrer` a form add records. Kit parses `utm_*` parameters out
 * of it into the subscriber's attribution, so the campaign fields ride on the
 * landing page; a parameter the page already carries is replaced by ours.
 *
 * @param attribution - The campaign data handed to `subscribe`.
 * @returns The referrer, and the fields that could not be carried.
 */
export function toFormReferrer(attribution: SubscriberAttribution | undefined): FormReferrer {
	let set = attributionFieldsOf(attribution);
	let page = attribution?.landingPage;

	if (page === undefined || !URL.canParse(page)) return { referrer: null, dropped: set };

	let url = new URL(page);
	for (let [field, parameter] of UTM_PARAMETERS) {
		let value = attribution?.[field];
		if (value !== undefined && value !== "") url.searchParams.set(parameter, value);
	}

	return { referrer: url.href, dropped: set.filter((field) => field === "referrer") };
}

/**
 * The attribution fields that hold a value, in a fixed order. Extra fields an
 * attribution package's touch carries are not ours and are left out.
 */
export function attributionFieldsOf(attribution: SubscriberAttribution | undefined): string[] {
	return ATTRIBUTION_FIELDS.filter((field) => {
		let value = attribution?.[field];
		return value !== undefined && value !== "";
	});
}
