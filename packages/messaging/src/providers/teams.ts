/**
 * Microsoft Teams destinations: `TeamsWorkflow` posts an Adaptive Card to a Workflows
 * webhook URL, the replacement for Office 365 Connectors. Workflows answer `202` with
 * no message id, so a Teams message can be sent but never edited or threaded.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { isFailure } from "@sdxc/result";

import type { Answer } from "../deliver.js";
import type { Destination, SendOptions, Sent } from "../destination.js";
import type { MessagingError } from "../error.js";
import type { Message, Severity } from "../message.js";

import { admitDestination, answerError, checkDestination, deliver } from "../deliver.js";
import { severityOf } from "../severity.js";
import { fitText, teamsMarkdown, writeText } from "../text.js";

/**
 * Limits that keep a card inside the 28 KB Teams accepts per message. Teams renders
 * at most six card actions.
 */
const LIMITS = {
	title: 1000,
	text: 16_000,
	facts: 30,
	factTitle: 200,
	factValue: 1000,
	actions: 6,
	actionTitle: 100,
} as const;

/** The container style each severity draws the header in. */
const CONTAINER_STYLES: Readonly<Record<Severity, string>> = {
	info: "emphasis",
	success: "good",
	warning: "warning",
	critical: "attention",
};

/** The schema an Adaptive Card names, which designers and validators read. */
const CARD_SCHEMA = "http://adaptivecards.io/schemas/adaptive-card.json";

/** An Adaptive Card element or action, as plain data. */
export type AdaptiveElement = Record<string, unknown>;

/** The Adaptive Card a Workflows message carries. */
export interface AdaptiveCard {
	$schema: string;
	type: "AdaptiveCard";
	version: "1.4";
	body: AdaptiveElement[];
	actions?: AdaptiveElement[];
}

/** The `message` envelope a Workflows webhook's "post card" trigger receives. */
export interface TeamsWorkflowPayload {
	type: "message";
	attachments: [
		{
			contentType: "application/vnd.microsoft.card.adaptive";
			contentUrl: null;
			content: AdaptiveCard;
		},
	];
}

/**
 * Writes a timestamp with the card's `DATE` and `TIME` functions, which Teams draws in
 * the reader's own locale and time zone; they read RFC 3339 without fractional seconds.
 */
function cardTime(timestamp: Date): string {
	let iso = timestamp.toISOString().replace(/\.\d{3}Z$/u, "Z");
	return `{{DATE(${iso}, SHORT)}} {{TIME(${iso})}}`;
}

/**
 * Writes a message as an Adaptive Card 1.4: the title in a container styled by severity,
 * the text, the fields as a fact set, the timestamp, and a URL action per link, each cut
 * to the card's limits.
 *
 * @param message - The message.
 * @returns The card.
 */
export function teamsCard(message: Message): AdaptiveCard {
	let body: AdaptiveElement[] = [
		{
			type: "Container",
			style: CONTAINER_STYLES[severityOf(message)],
			bleed: true,
			items: [
				{
					type: "TextBlock",
					text: fitText(message.title, LIMITS.title, teamsMarkdown.escape),
					weight: "Bolder",
					size: "Medium",
					wrap: true,
				},
			],
		},
	];

	if (message.text) {
		body.push({
			type: "TextBlock",
			text: writeText(message.text, teamsMarkdown, LIMITS.text),
			wrap: true,
		});
	}

	let fields = (message.fields ?? []).slice(0, LIMITS.facts);
	if (fields.length > 0) {
		body.push({
			type: "FactSet",
			facts: fields.map((field) => ({
				title: fitText(field.label, LIMITS.factTitle, teamsMarkdown.escape),
				value: fitText(field.value, LIMITS.factValue, teamsMarkdown.escape),
			})),
		});
	}

	if (message.timestamp) {
		body.push({
			type: "TextBlock",
			text: cardTime(message.timestamp),
			isSubtle: true,
			size: "Small",
			wrap: true,
		});
	}

	let actions = (message.links ?? []).slice(0, LIMITS.actions).map((link) => ({
		type: "Action.OpenUrl",
		title: fitText(link.label, LIMITS.actionTitle),
		url: link.url,
	}));

	return {
		$schema: CARD_SCHEMA,
		type: "AdaptiveCard",
		version: "1.4",
		body,
		...(actions.length > 0 ? { actions } : {}),
	};
}

/** Maps a deleted or disabled workflow, which answers `404`, to `gone`. */
function classifyTeamsWorkflow(
	exchange: { provider: string; host: string },
	answer: Answer,
): MessagingError | null {
	if (answer.status === 404) return answerError(exchange, answer, "gone", "answered 404");
	return null;
}

/** How a `TeamsWorkflow` is configured. */
export interface TeamsWorkflowOptions {
	/** The Workflows webhook URL, which is itself the credential. */
	url: string;
	/**
	 * Also resolve the host before each send and refuse it unless every address is
	 * public, so a name re-pointed at a private network is never reached.
	 *
	 * @default false
	 */
	resolve?: boolean;
}

/**
 * Posts to a Teams Workflows webhook. Workflows URLs live on several Azure and Power
 * Platform hosts, so any URL the public outbound policy accepts is taken.
 *
 * @example await new TeamsWorkflow({ url: config.webhookUrl, resolve: true }).send(message);
 */
export class TeamsWorkflow implements Destination {
	readonly provider = "teams-workflow";

	#url: string;
	#resolve: boolean;

	/** @param options - The webhook URL and whether to resolve its host. */
	constructor(options: TeamsWorkflowOptions) {
		this.#url = options.url;
		this.#resolve = options.resolve ?? false;
	}

	/**
	 * Validates a pasted URL with the rule a send applies, short of the DNS check.
	 *
	 * @param url - The URL as pasted.
	 * @returns The parsed URL, or `invalid-destination`.
	 */
	static check(url: string): Result<URL, MessagingError> {
		return checkDestination("teams-workflow", url);
	}

	/**
	 * The exact body a send posts; a subclass overrides it to change the layout.
	 *
	 * @param message - The message.
	 */
	render(message: Message): TeamsWorkflowPayload {
		return {
			type: "message",
			attachments: [
				{
					contentType: "application/vnd.microsoft.card.adaptive",
					contentUrl: null,
					content: teamsCard(message),
				},
			],
		};
	}

	/**
	 * Posts the message. Workflows answer no message id, so the ref is always `null`.
	 *
	 * @param message - The message.
	 * @param options - Timeout and signal, which also cancels the DNS check.
	 */
	async send(message: Message, options?: SendOptions): Promise<Result<Sent, MessagingError>> {
		let url = await admitDestination(
			this.provider,
			this.#url,
			{ resolve: this.#resolve },
			options?.signal,
		);
		if (isFailure(url)) return url;

		let body = JSON.stringify(this.render(message));
		let exchange = { provider: this.provider, host: url.data.host };
		return await deliver(
			{
				...exchange,
				request: (signal) =>
					fetch(url.data, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body,
						redirect: "manual",
						signal,
					}),
				classify: (answer) => classifyTeamsWorkflow(exchange, answer),
			},
			options,
		);
	}
}
