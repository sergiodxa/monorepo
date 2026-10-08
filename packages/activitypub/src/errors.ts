/**
 * The failures this package answers inside a `Result`: a base with a code and a retry
 * verdict that a job consumer acts on, the parse failure every `parse*` returns, and the
 * fetch failure discovery and the remote resolver return, and the failure a queued
 * federation message ends with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Every failure of this package. `code` is stable for a caller to branch on, and
 * `retryable` tells a job consumer whether asking again later can change the outcome.
 *
 * @template Code - The codes a subclass can carry.
 */
export class ActivityPubError<Code extends string = string> extends Error {
	override name = "ActivityPubError";
	/** Machine-readable cause, stable across releases of a subclass. */
	readonly code: Code;
	/** Whether a later attempt can succeed, so a job retries it rather than acknowledging. */
	readonly retryable: boolean;

	/**
	 * @param code - Why the operation failed.
	 * @param message - The explanation a log shows.
	 * @param options - Whether a retry can help, and the underlying error.
	 */
	constructor(code: Code, message: string, options: ActivityPubError.Options = {}) {
		super(message, options.cause === undefined ? undefined : { cause: options.cause });
		this.code = code;
		this.retryable = options.retryable ?? false;
	}
}

export namespace ActivityPubError {
	/** How a failure is classified beyond its code. */
	export interface Options {
		/** @default false */
		retryable?: boolean;
		cause?: unknown;
	}
}

/**
 * A document that is not the ActivityStreams shape asked for. Every issue found is
 * listed with a JSON Pointer into the received document, and `message` summarizes the
 * first; a resent copy of the same document fails the same way, so it never retries.
 */
export class ActivityPubParseError extends ActivityPubError<"invalid-document"> {
	override name = "ActivityPubParseError";
	/** What was being read: `activity`, `actor`, `object` or `collection`. */
	readonly kind: ActivityPubParseError.Kind;
	readonly issues: ActivityPubParseError.Issue[];

	/**
	 * @param kind - What was being read.
	 * @param issues - Every problem found, at least one.
	 */
	constructor(kind: ActivityPubParseError.Kind, issues: ActivityPubParseError.Issue[]) {
		let first = issues[0];
		let where = first === undefined || first.at === "" ? "" : ` at ${first.at}`;
		let more = issues.length > 1 ? ` (and ${issues.length - 1} more)` : "";
		super(
			"invalid-document",
			`Invalid ${kind}${where}: ${first?.message ?? "the document is invalid."}${more}`,
		);
		this.kind = kind;
		this.issues = issues;
	}
}

export namespace ActivityPubParseError {
	/** The document reader that failed. */
	export type Kind = "activity" | "actor" | "object" | "collection";

	/** One place a document breaks the shape asked for. */
	export interface Issue {
		/** A JSON Pointer into the received document; `""` for the document as a whole. */
		at: string;
		message: string;
	}
}

/**
 * Why a remote ActivityPub or WebFinger document could not be used. `gone` means the
 * server answered `410` or a `Tombstone`, so a caller forgets the resource; `timeout`,
 * `network` and a `5xx` or `429` under `http` are the outcomes a retry can change.
 */
export type ActivityPubFetchErrorCode =
	| "gone"
	| "not-found"
	| "unauthorized"
	| "refused-url"
	| "too-large"
	| "timeout"
	| "network"
	| "invalid-document"
	| "id-mismatch"
	| "http";

/** Codes a later attempt can clear regardless of status: the deadline and the transport. */
const RETRYABLE_FETCH_CODES = new Set<ActivityPubFetchErrorCode>(["timeout", "network"]);

/**
 * A remote document that could not be fetched or trusted. `url` is the document that
 * failed, and `status` the HTTP status when a response arrived at all.
 */
export class ActivityPubFetchError extends ActivityPubError<ActivityPubFetchErrorCode> {
	override name = "ActivityPubFetchError";
	readonly url: string;
	/** The response status, or `null` when the request was refused, timed out or never connected. */
	readonly status: number | null;

	/**
	 * `retryable` defaults from the code and status: `timeout` and `network` always, and
	 * `http` for a `5xx` or `429`; every other outcome repeats on a retry.
	 *
	 * @param code - Why the document could not be used.
	 * @param url - The document's URL.
	 * @param message - The explanation a log shows.
	 * @param options - The status, an explicit retry verdict, and the underlying error.
	 */
	constructor(
		code: ActivityPubFetchErrorCode,
		url: string,
		message: string,
		options: ActivityPubFetchError.Options = {},
	) {
		let status = options.status ?? null;
		super(code, message, {
			retryable: options.retryable ?? isRetryableFetch(code, status),
			cause: options.cause,
		});
		this.url = url;
		this.status = status;
	}
}

export namespace ActivityPubFetchError {
	/** How a fetch failure is classified beyond its code. */
	export interface Options extends ActivityPubError.Options {
		status?: number | null;
	}
}

/**
 * Whether a fetch failure can clear on its own: a deadline, a dropped connection, a
 * server error or a rate limit.
 *
 * @param code - The failure's code.
 * @param status - The response status, when one arrived.
 */
function isRetryableFetch(code: ActivityPubFetchErrorCode, status: number | null): boolean {
	if (RETRYABLE_FETCH_CODES.has(code)) return true;
	if (code !== "http" || status === null) return false;
	return status === 429 || status >= 500;
}

/**
 * Why `Federation#process` could not finish a queued message. `retryable` and `delay` are
 * all a job needs (retry after `delay` milliseconds, or acknowledge); `code` and `cause`
 * keep the failure underneath, such as a `DeliveryError` or an `ActivityPubFetchError`.
 */
export class FederationError extends ActivityPubError {
	override name = "FederationError";
	/** Which kind of message failed. */
	readonly kind: "inbox" | "fanOut" | "deliver";
	/**
	 * Milliseconds to wait before the retry: the backoff step for this attempt, or longer
	 * when the inbox named a `Retry-After`. `0` when the failure is not retryable.
	 */
	readonly delay: number;

	/**
	 * @param kind - Which kind of message failed.
	 * @param cause - The failure underneath, whose code, message and verdict this one keeps.
	 * @param delay - The wait before a retry, in milliseconds.
	 */
	constructor(kind: FederationError["kind"], cause: ActivityPubError, delay: number) {
		super(cause.code, cause.message, { retryable: cause.retryable, cause });
		this.kind = kind;
		this.delay = cause.retryable ? delay : 0;
	}
}
