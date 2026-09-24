/**
 * The vocabulary both halves of Webmention share: the source and target pair, the
 * display-ready mention a verified source becomes, and the three ways a request, a
 * fetch or a send can fail.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Groups the shared types under a single import surface. */
export namespace Webmention {
	/** A mention is keyed by this pair: sending it again is an update of the same mention. */
	export interface Pair {
		source: URL;
		target: URL;
	}

	/** What a mention is, as Post Type Discovery reads the source entry. */
	export type Kind = "reply" | "like" | "repost" | "bookmark" | "mention";

	/** Who wrote the source, as far as its markup says; every field may be unknown. */
	export interface Author {
		name: string | null;
		url: string | null;
		photo: string | null;
	}

	/** A verified mention, ready to store and render. */
	export interface Mention {
		kind: Kind;
		/** The entry's `u-url` when it has one, `source` otherwise. */
		url: string;
		author: Author | null;
		/** Sanitized with the source as base, so `html` renders as it stands. */
		content: { html: string; text: string } | null;
		/** The entry's name when it is an article; the page's `<title>` for a mention with no entry. */
		name: string | null;
		/** `null` when the source names no instant, a date alone included. */
		published: Date | null;
	}
}

/** Why a request is answered with `400`, one reason per rule the specification states. */
export type WebmentionRequestReason =
	| "media-type"
	| "missing"
	| "invalid-url"
	| "same-url"
	| "target-not-accepted";

/**
 * A request the specification answers with `400`: a body that is not form-encoded, a
 * missing or unusable URL, a source equal to its target, or a target this receiver
 * does not take mentions for.
 */
export class WebmentionRequestError extends Error {
	override name = "WebmentionRequestError";
	readonly reason: WebmentionRequestReason;

	/**
	 * @param reason - The rule the request broke
	 * @param message - The text the `400` answers with
	 */
	constructor(reason: WebmentionRequestReason, message: string) {
		super(message);
		this.reason = reason;
	}
}

/**
 * A fetch that did not finish: a refused host, a timeout, a redirect chain too long, a
 * body too large, or a server error. `retryable` is how a job decides between retrying
 * later and acknowledging the failure.
 */
export class WebmentionFetchError extends Error {
	override name = "WebmentionFetchError";
	/** `true` for a timeout, a network failure or a 5xx or 429 answer; `false` for a refusal or a cap. */
	readonly retryable: boolean;

	/**
	 * @param message - What went wrong, naming the URL
	 * @param retryable - Whether asking again later can succeed
	 */
	constructor(message: string, retryable: boolean) {
		super(message);
		this.retryable = retryable;
	}
}

/** An endpoint that answered a send with a status outside 2xx. */
export class WebmentionSendError extends Error {
	override name = "WebmentionSendError";
	/** The endpoint's status; a 5xx or 429 is worth sending again later. */
	readonly status: number;

	/**
	 * @param message - What the endpoint answered, naming it
	 * @param status - The HTTP status it answered with
	 */
	constructor(message: string, status: number) {
		super(message);
		this.status = status;
	}
}
