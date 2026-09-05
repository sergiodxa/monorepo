/**
 * Buttondown newsletter API client. Covers the three calls the funnel makes —
 * checking whether an address is already subscribed, subscribing it with UTM
 * attribution and the caller's IP, and patching a subscriber's metadata to record a
 * purchase tier — and surfaces Buttondown's own error codes as {@link ButtondownError}
 * so controllers can map them to visitor-facing copy.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Json } from "@sdxc/http/content-type";
import { currentLog } from "@sdxc/logger";
import * as s from "remix/data-schema";

const API_URL = "https://api.buttondown.com";

/**
 * Header Buttondown reads to pick the API version for a request. Omitting it lets
 * the account's pinned version — or Buttondown's latest — decide, letting a provider
 * release change response shapes; sending it pins the contract this client expects.
 */
const VERSION_HEADER = "x-api-version";

/**
 * Buttondown's error envelope, validated because the `code` decides which message
 * a visitor sees (`subscriber_blocked` and `email_invalid` get their own copy,
 * `email_already_exists` is a success path).
 */
const ErrorBodySchema = s.object({ code: s.string(), detail: s.string() });

/**
 * UTM attribution captured from the query string of the page the form was submitted
 * from. Every field is optional: most visitors arrive without campaign parameters.
 */
export interface SubscribeAttribution {
	/** `utm_source` — where the visitor came from. */
	source?: string;
	/** `utm_campaign` — the campaign that brought them. */
	campaign?: string;
	/** `utm_medium` — the medium the campaign used. */
	medium?: string;
}

/**
 * An error returned by the Buttondown API, carrying its machine-readable `code`
 * alongside the human-readable detail. Controllers branch on the code to choose
 * visitor-facing copy; the detail is upstream text kept for logs.
 */
export class ButtondownError extends Error {
	override name = "ButtondownError";

	/**
	 * @param message - Buttondown's `detail` string.
	 * @param code - Buttondown's machine-readable error `code`.
	 */
	constructor(
		message: string,
		public readonly code: string,
	) {
		super(message);
	}
}

/**
 * Options accepted by the {@link Buttondown} constructor.
 */
export interface ButtondownOptions {
	/** Buttondown API key, sent as a `Token` authorization header. */
	apiKey: string;
	/**
	 * Buttondown API version to pin every request to, as a `YYYY-MM-DD` date. Omit to let
	 * the account's own pinned version (or Buttondown's latest) decide.
	 */
	apiVersion?: string;
}

/**
 * Typed client for the subset of Buttondown's API the funnel uses.
 *
 * Calls the global `fetch` directly; tests intercept requests at the network
 * layer with MSW.
 *
 * @example
 * ```ts
 * let buttondown = new Buttondown({ apiKey: env.BUTTONDOWN_API_KEY });
 * if (!(await buttondown.isSubscribed(email))) await buttondown.subscribe(email, {}, ip);
 * ```
 */
export class Buttondown {
	private readonly apiKey: string;

	private readonly apiVersion?: string;

	/**
	 * @param options - Client configuration.
	 * @throws {Error} When the API key is missing, so a missing secret fails inside
	 * the request that needed it.
	 */
	constructor(options: ButtondownOptions) {
		if (!options.apiKey) throw new Error("BUTTONDOWN_API_KEY is required");
		this.apiKey = options.apiKey;
		this.apiVersion = options.apiVersion;
	}

	/**
	 * Checks whether an address is already on the list.
	 *
	 * @param email - The address to look up.
	 * @returns `true` when Buttondown knows the subscriber.
	 * @throws {Error} When Buttondown answers 403 (a revoked or misscoped API key).
	 */
	async isSubscribed(email: string): Promise<boolean> {
		let response = await this.request("GET", `/v1/subscribers/${email}`);
		let subscribed = response.ok;
		currentLog()?.set({ buttondown: { subscribed } });
		return subscribed;
	}

	/**
	 * Subscribes an address, recording UTM attribution and the caller's IP.
	 *
	 * @param email - The address to subscribe.
	 * @param attribution - UTM parameters carried through from the form.
	 * @param ipAddress - The visitor's IP, or `null` when it cannot be resolved.
	 * @throws {ButtondownError} When Buttondown rejects the address; `code` says why.
	 * @throws {Error} When Buttondown answers 403.
	 */
	async subscribe(
		email: string,
		attribution: SubscribeAttribution,
		ipAddress: string | null,
	): Promise<void> {
		let response = await this.request("POST", "/v1/subscribers", {
			email,
			utm_source: attribution.source,
			utm_campaign: attribution.campaign,
			utm_medium: attribution.medium,
			ip_address: ipAddress ?? undefined,
		});

		if (response.ok) {
			currentLog()?.note("buttondown.subscribe.succeeded");
			return;
		}

		let error = s.parse(ErrorBodySchema, await response.json());

		currentLog()?.warn("buttondown.subscribe.failed", { code: error.code });
		throw new ButtondownError(error.detail, error.code);
	}

	/**
	 * Merges metadata onto an existing subscriber. Used to tag paying customers with
	 * their purchase tier, which drives segmentation inside Buttondown.
	 *
	 * @param email - The subscriber to patch.
	 * @param metadata - Key-value pairs to merge onto the subscriber.
	 * @throws {Error} When Buttondown rejects the patch, or answers 403.
	 */
	async addMetadata(email: string, metadata: Record<string, string>): Promise<void> {
		let response = await this.request("PATCH", `/v1/subscribers/${email}`, { metadata });

		if (response.ok) {
			currentLog()?.note("buttondown.metadata.updated");
			return;
		}

		currentLog()?.warn("buttondown.metadata.failed", { status: response.status });
		throw new Error("Failed to add metadata");
	}

	/**
	 * Sends one authorized request and fails closed on 403, treating it as a
	 * revoked API key.
	 *
	 * @param method - HTTP method to use.
	 * @param path - API path, resolved against Buttondown's base URL.
	 * @param body - Optional JSON body.
	 * @returns The raw response, for the caller to branch on.
	 * @throws {Error} When Buttondown answers 403.
	 */
	private async request(method: string, path: string, body?: unknown): Promise<Response> {
		let headers = new Headers({
			authorization: `Token ${this.apiKey}`,
			"content-type": Json,
		});

		if (this.apiVersion) headers.set(VERSION_HEADER, this.apiVersion);

		let response = await fetch(new URL(path, API_URL), {
			method,
			headers,
			body: body === undefined ? undefined : JSON.stringify(body),
		});

		if (response.status === 403) {
			currentLog()?.warn("buttondown.forbidden", { status: response.status });
			throw new Error("Forbidden");
		}

		return response;
	}
}
