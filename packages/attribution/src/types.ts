/**
 * The shapes a touch is made of: the campaign parameters, the click identifier, the referrer and
 * the channel they add up to. Every field is camelCase; the `utm_*` wire names appear only where
 * a touch is read from or written back to a query string.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** One arrival: where a visitor landed and what the request said about how they got there. */
export interface Touch {
	/** When the visit happened, as epoch milliseconds. */
	at: number;
	/** The pathname of the page they landed on, without its query string, capped at 256 characters. */
	landingPath: string;
	utm: Utm | null;
	click: Click | null;
	referrer: Referrer | null;
	channel: Channel;
}

/** The campaign parameters a link carried, each normalized to a slug of at most 64 characters. */
export interface Utm {
	source?: string;
	medium?: string;
	campaign?: string;
	term?: string;
	content?: string;
	id?: string;
	sourcePlatform?: string;
	creativeFormat?: string;
	marketingTactic?: string;
}

/**
 * The ad network a click identifier names. `value` is present only under `clickIds: "keep"`,
 * since the identifier joins this visit to a profile the network holds.
 */
export interface Click {
	param: string;
	network: string;
	paid: boolean;
	value?: string;
}

/** The kind of site a referrer is, which the channel rules read. */
export type ReferrerKind = "search" | "social" | "email" | "other";

/** The site a visitor followed a link from, reduced to its hostname without `www.`. */
export interface Referrer {
	host: string;
	kind: ReferrerKind;
}

/** The acquisition channel a touch is credited to, derived from its utm, click and referrer. */
export type Channel =
	| "direct"
	| "organic-search"
	| "paid-search"
	| "organic-social"
	| "paid-social"
	| "email"
	| "display"
	| "affiliate"
	| "referral"
	| "other";

/**
 * A touch as flat campaign fields: the five classic `utm_*` values, the referring hostname and
 * the absolute landing URL, each present only when the touch carried it.
 */
export interface Campaign {
	source?: string;
	medium?: string;
	campaign?: string;
	term?: string;
	content?: string;
	/** The referring site's hostname. */
	referrer?: string;
	/** The absolute URL of the page the visitor landed on, without its query string. */
	landingPage?: string;
}

/** What the current request knows about how this visitor arrived. */
export interface Attribution {
	/** This request's own touch, `null` when the request is not a page navigation. */
	current: Touch | null;
	/** The earliest touch within the window. */
	first: Touch | null;
	/** The most recent touch that carried a campaign, a click identifier or an external referrer. */
	last: Touch | null;
}
