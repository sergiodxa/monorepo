/**
 * WhatsApp destination: `WhatsAppCloud` sends an approved template through the Cloud
 * API, since a business-initiated message outside the 24-hour window must be one. The
 * caller maps each message onto the template's body parameters.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { APIClient } from "@sdxc/api-client";
import { failure, isFailure } from "@sdxc/result";

import type { Answer } from "../deliver.js";
import type { Destination, Secret, SendOptions, Sent } from "../destination.js";
import type { MessagingErrorCode } from "../error.js";
import type { Message } from "../message.js";

import { answerError, deliver, readSecret, record } from "../deliver.js";
import { MessagingError } from "../error.js";
import { fitText } from "../text.js";

/** The Graph API origin every Cloud API call goes to. */
const GRAPH_ORIGIN = "https://graph.facebook.com/";

/** The Graph API version a send uses when the caller pins none. */
const DEFAULT_API_VERSION = "v21.0";

/** Line breaks and tabs, which Meta refuses inside a template parameter. */
const PARAMETER_BREAKS = /[\t\n\r]+/gu;

/** A run of five or more spaces, past Meta's limit of four. */
const PARAMETER_SPACE_RUN = / {5,}/gu;

/** The most of Graph's own error message a failure repeats. */
const MAX_ERROR_DETAIL = 300;

/**
 * Graph error codes and what each means for the destination. `131026` is a number
 * that cannot receive WhatsApp, which is `gone` since resending never succeeds, and
 * `131030` is a test number's allow list, which the business owner fixes in settings.
 */
const ERROR_CODES: ReadonlyMap<number, MessagingErrorCode> = new Map<number, MessagingErrorCode>([
	[131047, "outside-window"],
	[190, "unauthorized"],
	[10, "unauthorized"],
	[131026, "gone"],
	[131030, "rejected"],
	[4, "rate-limited"],
	[80007, "rate-limited"],
	[130429, "rate-limited"],
	[131056, "rate-limited"],
]);

/** The approved template a message is sent as. */
export interface WhatsAppTemplate {
	/** The template's name, as approved in WhatsApp Manager. */
	name: string;
	/** The language code it was approved in, such as `en` or `pt_BR`. */
	language: string;
	/** Maps a message onto the template body's `{{1}}`, `{{2}}`… in order. */
	parameters(message: Message): string[];
}

/** One body parameter, already normalized the way Meta requires. */
export interface WhatsAppTextParameter {
	type: "text";
	text: string;
}

/** The body the Cloud API's messages endpoint receives. */
export interface WhatsAppTemplatePayload {
	messaging_product: "whatsapp";
	recipient_type: "individual";
	to: string;
	type: "template";
	template: {
		name: string;
		language: { code: string };
		components?: [{ type: "body"; parameters: WhatsAppTextParameter[] }];
	};
}

/** How a `WhatsAppCloud` destination is configured. */
export interface WhatsAppCloudOptions {
	/** A system user's access token, read on every send. */
	accessToken: Secret;
	/** The business phone number's id, which the messages path names. */
	phoneNumberId: string;
	/** The recipient's phone number with its country code. */
	to: string;
	template: WhatsAppTemplate;
	/** @default "v21.0" */
	apiVersion?: string;
}

/**
 * Writes a template parameter the way Meta accepts it: every line break or tab becomes
 * a space, and a run of spaces longer than four is cut to four.
 *
 * @param value - The parameter as the template mapping produced it.
 * @returns The parameter Meta accepts.
 * @example normalizeParameter("down\n\tfor 30s"); // "down for 30s"
 */
export function normalizeParameter(value: string): string {
	return value.replace(PARAMETER_BREAKS, " ").replace(PARAMETER_SPACE_RUN, "    ");
}

/**
 * Sends a message as an approved WhatsApp template to one recipient. Links come from
 * the template's own URL buttons, fixed when the template is approved.
 *
 * @example await new WhatsAppCloud({ accessToken: () => env.WHATSAPP_ACCESS_TOKEN, phoneNumberId, to, template }).send(message);
 */
export class WhatsAppCloud extends APIClient implements Destination {
	readonly provider = "whatsapp-cloud";

	/** Messages go to a service outside the caller's trace. */
	protected override readonly propagateTrace = "none";

	#accessToken: Secret;
	#options: Omit<WhatsAppCloudOptions, "accessToken">;

	/** @param options - The token, the sending number, the recipient and the template. */
	constructor(options: WhatsAppCloudOptions) {
		super(new URL(GRAPH_ORIGIN));
		let { accessToken, ...rest } = options;
		this.#accessToken = accessToken;
		this.#options = rest;
	}

	/**
	 * The exact body a send posts; a subclass overrides it to add header or button
	 * components. A template without parameters carries no components.
	 *
	 * @param message - The message the template's parameters are read from.
	 */
	render(message: Message): WhatsAppTemplatePayload {
		let { template, to } = this.#options;
		let parameters = template
			.parameters(message)
			.map((text): WhatsAppTextParameter => ({ type: "text", text: normalizeParameter(text) }));

		let payload: WhatsAppTemplatePayload = {
			messaging_product: "whatsapp",
			recipient_type: "individual",
			to,
			type: "template",
			template: { name: template.name, language: { code: template.language } },
		};
		if (parameters.length > 0) payload.template.components = [{ type: "body", parameters }];
		return payload;
	}

	/**
	 * Sends the template. A parameter mapping that throws fails `invalid-message`, so
	 * the send still answers a `Result`.
	 *
	 * @param message - The message.
	 * @param options - Timeout and signal.
	 * @returns A ref carrying the WhatsApp message id.
	 */
	async send(message: Message, options?: SendOptions): Promise<Result<Sent, MessagingError>> {
		let payload: WhatsAppTemplatePayload;
		try {
			payload = this.render(message);
		} catch (error) {
			return failure(
				new MessagingError(`${this.provider} could not map the message onto its template`, {
					code: "invalid-message",
					provider: this.provider,
					cause: error,
				}),
			);
		}

		let accessToken = await readSecret(this.provider, this.#accessToken);
		if (isFailure(accessToken)) return accessToken;

		let version = encodeURIComponent(this.#options.apiVersion ?? DEFAULT_API_VERSION);
		let path = `${version}/${encodeURIComponent(this.#options.phoneNumberId)}/messages`;
		let body = JSON.stringify(payload);
		let headers = {
			"Content-Type": "application/json",
			Authorization: `Bearer ${accessToken.data}`,
		};
		let exchange = { provider: this.provider, host: this.baseURL.host };
		return await deliver(
			{
				...exchange,
				request: (signal) => this.post(path, { headers, body, redirect: "manual", signal }),
				classify: (answer) => classifyGraph(exchange, answer),
				ref: (answer) => {
					let messages = record(answer.json)["messages"];
					let id = Array.isArray(messages) ? record(messages[0])["id"] : undefined;
					return typeof id === "string" ? { provider: this.provider, id } : null;
				},
			},
			options,
		);
	}
}

/**
 * Reads a Graph error's `code`, which names the failure more precisely than the HTTP
 * status: Meta answers the customer-service window and most rate limits as a `400`.
 */
function classifyGraph(
	exchange: { provider: string; host: string },
	answer: Answer,
): MessagingError | null {
	if (answer.status >= 200 && answer.status < 300) return null;
	let error = record(record(answer.json)["error"]);
	let code = error["code"];
	if (typeof code !== "number") return null;

	let mapped = ERROR_CODES.get(code);
	if (mapped === undefined) return null;
	let message = typeof error["message"] === "string" ? error["message"] : "";
	let detail = message === "" ? "" : `: ${fitText(message, MAX_ERROR_DETAIL)}`;
	return answerError(exchange, answer, mapped, `answered error ${code}${detail}`);
}
