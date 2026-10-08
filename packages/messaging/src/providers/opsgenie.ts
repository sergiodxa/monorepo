/**
 * Opsgenie destination: `Opsgenie` creates an alert through the Alert API v2 for an
 * open message and closes it by alias for a resolved one, so the message's `key` ties
 * a recovery to the alert it ends. Atlassian ends Opsgenie support in April 2027.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { APIClient } from "@sdxc/api-client";
import { failure, isFailure } from "@sdxc/result";

import type { Destination, Secret, SendOptions, Sent, SentRef } from "../destination.js";
import type { MessagingError } from "../error.js";
import type { Message, Severity } from "../message.js";

import { deliver, messageError, readSecret, record } from "../deliver.js";
import { severityOf } from "../severity.js";
import { fitText, plainText, writeText } from "../text.js";

/** The API origin of each Opsgenie region, since an account lives in exactly one. */
const REGION_ORIGINS: Readonly<Record<OpsgenieRegion, string>> = {
	us: "https://api.opsgenie.com/",
	eu: "https://api.eu.opsgenie.com/",
};

/** The Alert API's field limits, past which Opsgenie truncates or rejects the alert. */
const LIMITS = {
	message: 130,
	alias: 512,
	description: 15_000,
	source: 100,
	tag: 50,
	tags: 20,
	note: 25_000,
} as const;

/** Opsgenie's priorities, with success read as informational. */
const PRIORITIES: Readonly<Record<Severity, OpsgeniePriority>> = {
	info: "P5",
	success: "P5",
	warning: "P3",
	critical: "P1",
};

/** The region an Opsgenie account was created in. */
export type OpsgenieRegion = "us" | "eu";

/** The priorities an alert accepts, `P1` the most urgent. */
export type OpsgeniePriority = "P1" | "P2" | "P3" | "P4" | "P5";

/** A team, user, escalation or schedule the alert is routed to, by id or by name. */
export interface OpsgenieResponder {
	type: "team" | "user" | "escalation" | "schedule";
	id?: string;
	name?: string;
	username?: string;
}

/** The body that creates an alert. */
export interface OpsgenieCreateAlert {
	message: string;
	alias: string;
	description?: string;
	priority: OpsgeniePriority;
	/** Opsgenie stores details as strings only, so every value is written as one. */
	details?: Record<string, string>;
	responders?: OpsgenieResponder[];
	source?: string;
	tags?: string[];
}

/** The body that closes an alert. */
export interface OpsgenieCloseAlert {
	source?: string;
	note?: string;
}

/** One request a message becomes: the path under the region's origin and its body. */
export interface OpsgenieRequest {
	path: string;
	body: OpsgenieCreateAlert | OpsgenieCloseAlert;
}

/** How an `Opsgenie` destination is configured. */
export interface OpsgenieOptions {
	/** An API integration's key, read on every send. */
	apiKey: Secret;
	/** @default "us" */
	region?: OpsgenieRegion;
	/** Who the alert is routed to, past the integration's own team. */
	responders?: OpsgenieResponder[];
	tags?: string[];
	/** The alert's source, which Opsgenie shows beside it. */
	source?: string;
}

/**
 * Sends a message as an Opsgenie alert. Every message needs a `key`, which is the alias
 * that ties a close to the alert it ends.
 *
 * @example await new Opsgenie({ apiKey: () => env.OPSGENIE_API_KEY, region: "eu" }).send(message);
 */
export class Opsgenie extends APIClient implements Destination {
	readonly provider = "opsgenie";

	/** Alerts go to a service outside the caller's trace. */
	protected override readonly propagateTrace = "none";

	#apiKey: Secret;
	#options: Omit<OpsgenieOptions, "apiKey">;

	/** @param options - The API key, region and the alert's fixed fields. */
	constructor(options: OpsgenieOptions) {
		super(new URL(REGION_ORIGINS[options.region ?? "us"]));
		let { apiKey, ...rest } = options;
		this.#apiKey = apiKey;
		this.#options = rest;
	}

	/**
	 * The exact request a send makes; a subclass overrides it to change the alert. Links
	 * close the description, since an alert has no buttons, and fields and `data` become
	 * string details.
	 *
	 * @param message - The message, whose `key` is the alias.
	 */
	render(message: Message): OpsgenieRequest {
		let alias = fitText(message.key ?? "", LIMITS.alias);
		let source = this.#options.source ? fitText(this.#options.source, LIMITS.source) : undefined;

		if (message.state === "resolved") {
			let close: OpsgenieCloseAlert = { note: fitText(message.title, LIMITS.note) };
			if (source) close.source = source;
			return {
				path: `v2/alerts/${encodeURIComponent(alias)}/close?identifierType=alias`,
				body: close,
			};
		}

		let alert: OpsgenieCreateAlert = {
			message: fitText(message.title, LIMITS.message),
			alias,
			priority: PRIORITIES[severityOf(message)],
		};

		let description = [
			message.text ? writeText(message.text, plainText) : "",
			(message.links ?? []).map((link) => `${link.label}: ${link.url}`).join("\n"),
		]
			.filter((part) => part !== "")
			.join("\n\n");
		if (description !== "") alert.description = fitText(description, LIMITS.description);

		let details: Record<string, string> = {};
		for (let field of message.fields ?? []) details[field.label] = field.value;
		for (let [name, value] of Object.entries(message.data ?? {})) {
			details[name] = typeof value === "string" ? value : JSON.stringify(value);
		}
		if (Object.keys(details).length > 0) alert.details = details;

		if (this.#options.responders && this.#options.responders.length > 0) {
			alert.responders = this.#options.responders;
		}
		if (source) alert.source = source;
		if (this.#options.tags && this.#options.tags.length > 0) {
			alert.tags = this.#options.tags.slice(0, LIMITS.tags).map((tag) => fitText(tag, LIMITS.tag));
		}

		return { path: "v2/alerts", body: alert };
	}

	/**
	 * Creates or closes the alert. A message without a `key` fails `invalid-message`
	 * before any request, since Opsgenie could never close the alert it creates.
	 *
	 * @param message - The message.
	 * @param options - Timeout and signal.
	 * @returns A ref carrying the alias and the request id Opsgenie answered.
	 */
	async send(message: Message, options?: SendOptions): Promise<Result<Sent, MessagingError>> {
		if (!message.key) return failure(messageError(this.provider, "Opsgenie needs a key"));

		let apiKey = await readSecret(this.provider, this.#apiKey);
		if (isFailure(apiKey)) return apiKey;

		let rendered = this.render(message);
		let body = JSON.stringify(rendered.body);
		let headers = {
			"Content-Type": "application/json",
			Authorization: `GenieKey ${apiKey.data}`,
		};
		let alias = fitText(message.key, LIMITS.alias);
		return await deliver(
			{
				provider: this.provider,
				host: this.baseURL.host,
				request: (signal) =>
					this.post(rendered.path, { headers, body, redirect: "manual", signal }),
				ref: (answer) => {
					let ref: SentRef = { provider: this.provider, alias };
					let requestId = record(answer.json)["requestId"];
					if (typeof requestId === "string") ref["requestId"] = requestId;
					return ref;
				},
			},
			options,
		);
	}
}
