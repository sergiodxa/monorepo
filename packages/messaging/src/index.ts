/**
 * The package entrypoint: the portable message and its schema, the destination
 * contract with its capability check, the one failure type, and the dialect writers a
 * `render` override reuses. Providers live behind their own subpaths.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type {
	Destination,
	OptionalCapability,
	Secret,
	SendOptions,
	Sent,
	SentRef,
} from "./destination.js";
export type { MessagingErrorCode, MessagingErrorOptions } from "./error.js";
export type {
	Message,
	MessageData,
	MessageField,
	MessageLink,
	MessageState,
	Severity,
} from "./message.js";
export type { Dialect } from "./text.js";

export { supports } from "./destination.js";
export { MessagingError } from "./error.js";
export { MESSAGE_SCHEMA } from "./message.js";
export { SEVERITY_COLORS } from "./severity.js";
export {
	discordMarkdown,
	fitText,
	mrkdwn,
	plainText,
	pushoverHtml,
	teamsMarkdown,
	telegramHtml,
	whatsappText,
	writeText,
} from "./text.js";
