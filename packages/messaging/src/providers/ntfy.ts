/**
 * The ntfy destination: publishes to a topic on ntfy.sh or any self-hosted server as
 * one JSON post, with Markdown text, a priority by severity and up to three link
 * buttons. ntfy answers no message an app can edit, so a send is all it does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { isFailure } from "@sdxc/result";

import type { Answer } from "../deliver.js";
import type { Destination, Secret, SendOptions, Sent } from "../destination.js";
import type { MessagingError } from "../error.js";
import type { Message, Severity } from "../message.js";
import type { Dialect } from "../text.js";

import {
	admitDestination,
	answerError,
	checkDestination,
	deliver,
	readSecret,
} from "../deliver.js";
import { severityOf } from "../severity.js";
import { fitText, writeText } from "../text.js";

/** The public server a topic lives on when the configuration names none. */
const DEFAULT_SERVER = "https://ntfy.sh";

/** ntfy's limits: a longer message becomes an attachment, and a fourth action is rejected. */
const LIMITS = { title: 250, message: 4096, actions: 3, label: 100 } as const;

/** ntfy's priority scale, 1 to 5, where 4 and 5 break through quiet settings on phones. */
const PRIORITIES: Readonly<Record<Severity, number>> = {
	info: 3,
	success: 3,
	warning: 4,
	critical: 5,
};

/** Emoji shortcodes ntfy draws before the title, so the severity reads at a glance. */
const TAGS: Readonly<Record<Severity, string | null>> = {
	info: null,
	success: "white_check_mark",
	warning: "warning",
	critical: "rotating_light",
};

/** Backslash-escapes the characters CommonMark reads as inline syntax or HTML. */
function escapeMarkdown(text: string): string {
	return text.replace(/[\\*_`~[\]<>]/gu, (char) => `\\${char}`);
}

/**
 * CommonMark, which ntfy renders when `markdown` is set. Only inline syntax is escaped,
 * so a client showing the raw text shows few backslashes.
 */
export const ntfyMarkdown: Dialect = {
	escape: escapeMarkdown,
	strong: (inner) => `**${inner}**`,
	emphasis: (inner) => `_${inner}_`,
	strike: (inner) => `~~${inner}~~`,
	code: (value) => `\`${value.replaceAll("`", "ˋ")}\``,
	codeBlock: (content, language) =>
		`\`\`\`${language ?? ""}\n${content.replaceAll("```", "ˋˋˋ")}\n\`\`\``,
	link: (label, href) =>
		label === "" || label === href ? `<${href}>` : `[${label}](${href.replaceAll(")", "%29")})`,
	quote: (inner) =>
		inner
			.split("\n")
			.map((line) => `> ${line}`)
			.join("\n"),
};

/** A button that opens a URL when tapped. */
export interface NtfyViewAction {
	action: "view";
	label: string;
	url: string;
}

/** The JSON body ntfy's server root accepts. */
export interface NtfyPayload {
	topic: string;
	title: string;
	message: string;
	markdown: true;
	priority: number;
	tags?: string[];
	/** Opened when the notification itself is tapped: the message's first link. */
	click?: string;
	actions: NtfyViewAction[];
}

/** How an `Ntfy` destination is configured. */
export interface NtfyOptions {
	topic: string;
	/** The server's base URL, which may carry a path. @default "https://ntfy.sh" */
	server?: string;
	/** An access token, for a protected topic or a server that requires login. */
	token?: Secret;
	/**
	 * Also resolve the server's host before each send and refuse it unless every
	 * address is public, so a self-hosted name pointing inside a network is caught.
	 */
	resolve?: boolean;
}

/** Maps a `404` to `gone`: ntfy accepts any topic, so it means no ntfy server is at that URL. */
function classifyNtfy(exchange: { provider: string; host: string }, answer: Answer) {
	if (answer.status !== 404) return null;
	return answerError(exchange, answer, "gone", "answered 404");
}

/**
 * Publishes to an ntfy topic. The server goes through the public URL policy, so a
 * self-hosted server URL a user typed can never reach a private network.
 *
 * @example await new Ntfy({ topic: "alerts-8f1c", token: () => env.NTFY_TOKEN }).send(message);
 */
export class Ntfy implements Destination {
	readonly provider = "ntfy";

	#topic: string;
	#server: string;
	#token: Secret | null;
	#resolve: boolean;

	/** @param options - The topic, server, token and whether to resolve the host. */
	constructor(options: NtfyOptions) {
		this.#topic = options.topic;
		this.#server = options.server ?? DEFAULT_SERVER;
		this.#token = options.token ?? null;
		this.#resolve = options.resolve ?? false;
	}

	/**
	 * Validates a server URL with the rule a send applies; the DNS check of `resolve`
	 * runs only at send time.
	 *
	 * @param url - The server URL as typed.
	 * @returns The parsed URL, or `invalid-destination`.
	 */
	static check(url: string): Result<URL, MessagingError> {
		return checkDestination("ntfy", url);
	}

	/**
	 * The exact body a send posts; a subclass overrides it to change the layout. The
	 * text and fields share ntfy's message limit, fields first so they always arrive.
	 *
	 * @param message - The message.
	 */
	render(message: Message): NtfyPayload {
		let severity = severityOf(message);
		let links = message.links ?? [];

		let fields = (message.fields ?? []).map(
			(field) =>
				`- **${fitText(field.label, LIMITS.label, escapeMarkdown)}**: ${fitText(field.value, LIMITS.message, escapeMarkdown)}`,
		);
		let extra = links
			.slice(LIMITS.actions)
			.map((link) => `- ${ntfyMarkdown.link(escapeMarkdown(link.label), link.url)}`);
		let tail = [...fields, ...extra].join("\n");
		tail = tail.length > LIMITS.message ? "" : tail;

		let room = LIMITS.message - tail.length - (tail === "" ? 0 : 2);
		let text = message.text ? writeText(message.text, ntfyMarkdown, room) : "";
		let body = [text, tail].filter((part) => part !== "").join("\n\n");
		let title = fitText(message.title, LIMITS.title);

		let payload: NtfyPayload = {
			topic: this.#topic,
			title,
			message: body === "" ? fitText(message.title, LIMITS.message, escapeMarkdown) : body,
			markdown: true,
			priority: PRIORITIES[severity],
			actions: links.slice(0, LIMITS.actions).map((link) => ({
				action: "view",
				label: fitText(link.label, LIMITS.label),
				url: link.url,
			})),
		};

		let tag = TAGS[severity];
		if (tag !== null) payload.tags = [tag];
		let first = links[0];
		if (first) payload.click = first.url;
		return payload;
	}

	/**
	 * Publishes the message. ntfy cannot edit or thread a notification, so the ref is
	 * always `null`.
	 *
	 * @param message - The message.
	 * @param options - Timeout and signal.
	 */
	async send(message: Message, options: SendOptions = {}): Promise<Result<Sent, MessagingError>> {
		let server = await admitDestination(
			this.provider,
			this.#server,
			{ resolve: this.#resolve },
			options.signal,
		);
		if (isFailure(server)) return server;

		let headers = new Headers({ "Content-Type": "application/json" });
		if (this.#token !== null) {
			let token = await readSecret(this.provider, this.#token);
			if (isFailure(token)) return token;
			headers.set("Authorization", `Bearer ${token.data}`);
		}

		let root = new URL(server.data);
		if (!root.pathname.endsWith("/")) root.pathname = `${root.pathname}/`;
		root.search = "";
		root.hash = "";

		let body = JSON.stringify(this.render(message));
		let exchange = { provider: this.provider, host: server.data.host };
		return await deliver(
			{
				...exchange,
				request: (signal) =>
					fetch(root, { method: "POST", headers, body, redirect: "manual", signal }),
				classify: (answer) => classifyNtfy(exchange, answer),
			},
			options,
		);
	}
}
