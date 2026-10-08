/**
 * The portable message every destination sends: plain JSON-serializable data, so a
 * job builds it from domain state, a queue carries it, and a database stores it beside
 * the delivery it produced. `MESSAGE_SCHEMA` reads the JSON form back.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";
import { lazy } from "remix/data-schema/lazy";

/** How urgent a message is, which each platform shows as a color, a style or a priority. */
export type Severity = "info" | "success" | "warning" | "critical";

/**
 * Where the incident a message describes stands. Incident providers open or resolve
 * by it; chat platforms carry it only in what the title says.
 */
export type MessageState = "open" | "resolved";

/** A labelled value, drawn side by side with its neighbours when `inline` is set. */
export interface MessageField {
	label: string;
	value: string;
	inline?: boolean;
}

/** A button that opens a URL, or a line of links on a platform without buttons. */
export interface MessageLink {
	label: string;
	url: string;
}

/** A value `data` may hold, which is anything JSON can write. */
export type MessageData =
	| string
	| number
	| boolean
	| null
	| MessageData[]
	| { [key: string]: MessageData };

/**
 * One message, written once and rendered natively by every provider.
 *
 * @example let message: Message = { title: "api.example.com is down", severity: "critical" };
 */
export interface Message {
	/** The push preview, the incident summary and every card's header, so it is required. */
	title: string;
	/**
	 * Portable Markdown: emphasis, strikethrough, code, links, lists and quotes. A heading
	 * becomes a bold line, and a table or an image is written as its plain text.
	 */
	text?: string;
	/** @default "info" */
	severity?: Severity;
	fields?: MessageField[];
	/** Only ever open a URL: a button that calls back needs an inbound endpoint. */
	links?: MessageLink[];
	timestamp?: Date;
	/**
	 * What the message is about. PagerDuty dedupes by it, Opsgenie aliases by it, and
	 * Google Chat threads by it, so every message about one incident lands together.
	 */
	key?: string;
	/** @default "open" */
	state?: MessageState;
	/** Machine-readable details for the webhook body and incident providers' details. */
	data?: { [key: string]: MessageData };
}

/** Reads any JSON value, which is what `data` promises to carry. */
const DATA_VALUE_SCHEMA: s.Schema<unknown, MessageData> = s.union([
	s.string(),
	s.number(),
	s.boolean(),
	s.null_(),
	s.array(lazy(() => DATA_VALUE_SCHEMA)),
	s.record(
		s.string(),
		lazy(() => DATA_VALUE_SCHEMA),
	),
]);

/**
 * Parses a message's JSON form, with `timestamp` as an ISO string, back into a
 * `Message`, so a job declares `input: s.object({ message: MESSAGE_SCHEMA })`.
 */
export const MESSAGE_SCHEMA: s.Schema<unknown, Message> = s.object({
	title: s.string(),
	text: s.optional(s.string()),
	severity: s.optional(s.enum_(["info", "success", "warning", "critical"])),
	fields: s.optional(
		s.array(
			s.object({
				label: s.string(),
				value: s.string(),
				inline: s.optional(s.boolean()),
			}),
		),
	),
	links: s.optional(s.array(s.object({ label: s.string(), url: s.string() }))),
	timestamp: s.optional(coerce.date()),
	key: s.optional(s.string()),
	state: s.optional(s.enum_(["open", "resolved"])),
	data: s.optional(s.record(s.string(), DATA_VALUE_SCHEMA)),
});
