/**
 * PagerDuty destination: `PagerDuty` sends Events API v2 events to one integration, so
 * an open message triggers an incident deduplicated by the message's `key`, and a
 * resolved one resolves that incident.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { APIClient } from "@sdxc/api-client";
import { failure, isFailure } from "@sdxc/result";

import type { Answer } from "../deliver.js";
import type { Destination, Secret, SendOptions, Sent } from "../destination.js";
import type { MessagingError } from "../error.js";
import type { Message, MessageData, Severity } from "../message.js";

import { answerError, deliver, messageError, readSecret, record } from "../deliver.js";
import { severityOf } from "../severity.js";
import { fitText, plainText, writeText } from "../text.js";

/** The Events API v2 origin, the same for every account. */
const EVENTS_ORIGIN = "https://events.pagerduty.com/";

/** The source an event names when the caller configures none. */
const DEFAULT_SOURCE = "sdxc-messaging";

/** The Events API's field limits, past which PagerDuty rejects the event. */
const LIMITS = { summary: 1024, dedupKey: 255, source: 255 } as const;

/** PagerDuty's four severities, with success read as informational. */
const SEVERITIES: Readonly<Record<Severity, PagerDutySeverity>> = {
	info: "info",
	success: "info",
	warning: "warning",
	critical: "critical",
};

/** Matches an error PagerDuty answers for a routing key it does not know. */
const ROUTING_KEY_ERROR = /routing.?key/iu;

/** The severities an Events API v2 payload accepts. */
export type PagerDutySeverity = "critical" | "error" | "warning" | "info";

/** The `payload` of a trigger event, which becomes the incident's alert. */
export interface PagerDutyPayload {
	summary: string;
	source: string;
	severity: PagerDutySeverity;
	timestamp?: string;
	component?: string;
	group?: string;
	class?: string;
	custom_details?: { [key: string]: MessageData };
}

/** A trigger event, without the routing key a send adds at send time. */
export interface PagerDutyTrigger {
	event_action: "trigger";
	dedup_key: string;
	payload: PagerDutyPayload;
	links?: { href: string; text: string }[];
}

/** A resolve event, without the routing key a send adds at send time. */
export interface PagerDutyResolve {
	event_action: "resolve";
	dedup_key: string;
}

/** The event a message becomes; the routing key stays out so a rendered event is safe to show. */
export type PagerDutyEvent = PagerDutyTrigger | PagerDutyResolve;

/** How a `PagerDuty` destination is configured. */
export interface PagerDutyOptions {
	/** The integration key of an Events API v2 integration, read on every send. */
	routingKey: Secret;
	/**
	 * Where the problem is, which PagerDuty shows on the alert.
	 * @default "sdxc-messaging"
	 */
	source?: string;
	/** The part of the source that is broken, such as a database or a monitor. */
	component?: string;
	/** A logical grouping of components, such as a service or a cluster. */
	group?: string;
	/** The class or type of the event, such as `ping failure`. */
	class?: string;
}

/**
 * Sends a message as a PagerDuty event. Every message needs a `key`, which is the
 * `dedup_key` that ties a resolve to the trigger it closes.
 *
 * @example await new PagerDuty({ routingKey: () => env.PAGERDUTY_ROUTING_KEY }).send(message);
 */
export class PagerDuty extends APIClient implements Destination {
	readonly provider = "pagerduty";

	/** Events go to a service outside the caller's trace. */
	protected override readonly propagateTrace = "none";

	#routingKey: Secret;
	#options: Omit<PagerDutyOptions, "routingKey">;

	/** @param options - The routing key and the payload's fixed fields. */
	constructor(options: PagerDutyOptions) {
		super(new URL(EVENTS_ORIGIN));
		let { routingKey, ...rest } = options;
		this.#routingKey = routingKey;
		this.#options = rest;
	}

	/**
	 * The exact event a send posts, minus the routing key; a subclass overrides it to
	 * change the alert. A resolved message carries only the key it resolves.
	 *
	 * @param message - The message, whose `key` is the `dedup_key`.
	 */
	render(message: Message): PagerDutyEvent {
		let dedupKey = fitText(message.key ?? "", LIMITS.dedupKey);
		if (message.state === "resolved") return { event_action: "resolve", dedup_key: dedupKey };

		let payload: PagerDutyPayload = {
			summary: fitText(message.title, LIMITS.summary),
			source: fitText(this.#options.source ?? DEFAULT_SOURCE, LIMITS.source),
			severity: SEVERITIES[severityOf(message)],
		};
		if (message.timestamp) payload.timestamp = message.timestamp.toISOString();
		if (this.#options.component) payload.component = this.#options.component;
		if (this.#options.group) payload.group = this.#options.group;
		if (this.#options.class) payload.class = this.#options.class;

		let details: { [key: string]: MessageData } = {};
		if (message.text) details["text"] = writeText(message.text, plainText);
		if (message.fields && message.fields.length > 0) {
			details["fields"] = Object.fromEntries(
				message.fields.map((field) => [field.label, field.value]),
			);
		}
		Object.assign(details, message.data);
		if (Object.keys(details).length > 0) payload.custom_details = details;

		let event: PagerDutyTrigger = { event_action: "trigger", dedup_key: dedupKey, payload };
		if (message.links && message.links.length > 0) {
			event.links = message.links.map((link) => ({ href: link.url, text: link.label }));
		}
		return event;
	}

	/**
	 * Enqueues the event. A message without a `key` fails `invalid-message` before any
	 * request, since PagerDuty could never resolve the incident it opens.
	 *
	 * @param message - The message.
	 * @param options - Timeout and signal.
	 * @returns A ref carrying the `dedup_key` PagerDuty answered.
	 */
	async send(message: Message, options?: SendOptions): Promise<Result<Sent, MessagingError>> {
		if (!message.key) return failure(messageError(this.provider, "PagerDuty needs a key"));

		let routingKey = await readSecret(this.provider, this.#routingKey);
		if (isFailure(routingKey)) return routingKey;

		let key = routingKey.data;
		let body = JSON.stringify({ routing_key: key, ...this.render(message) });
		let exchange = { provider: this.provider, host: this.baseURL.host };
		return await deliver(
			{
				...exchange,
				request: (signal) =>
					this.post("v2/enqueue", {
						headers: { "Content-Type": "application/json" },
						body,
						redirect: "manual",
						signal,
					}),
				classify: (answer) => classifyPagerDuty(exchange, answer, key),
				ref: (answer) => {
					let dedupKey = record(answer.json)["dedup_key"];
					return typeof dedupKey === "string" ? { provider: this.provider, dedupKey } : null;
				},
			},
			options,
		);
	}
}

/**
 * Reads PagerDuty's `invalid event` answer: an unknown routing key is a refused
 * credential, and any other error is named in the failure with the key redacted.
 */
function classifyPagerDuty(
	exchange: { provider: string; host: string },
	answer: Answer,
	routingKey: string,
): MessagingError | null {
	if (answer.status !== 400) return null;
	let body = record(answer.json);
	let errors = Array.isArray(body["errors"])
		? body["errors"].filter((error): error is string => typeof error === "string")
		: [];
	if (errors.some((error) => ROUTING_KEY_ERROR.test(error))) {
		return answerError(exchange, answer, "unauthorized", "answered an invalid routing key");
	}

	let reason = errors.join("; ");
	if (routingKey !== "") reason = reason.replaceAll(routingKey, "[routing key]");
	return answerError(
		exchange,
		answer,
		"rejected",
		reason === "" ? "answered 400" : `answered invalid event: ${fitText(reason, 500)}`,
	);
}
