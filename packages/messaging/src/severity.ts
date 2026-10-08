/**
 * The colors a card's severity is drawn in, shared by every platform that colors a
 * message, so one severity reads the same in Slack and Discord.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Message, Severity } from "./message.js";

/** Gray, green, amber and red, as `#rrggbb`. */
export const SEVERITY_COLORS: Readonly<Record<Severity, string>> = {
	info: "#6b7280",
	success: "#16a34a",
	warning: "#d97706",
	critical: "#dc2626",
};

/**
 * A message's severity with its default applied.
 *
 * @param message - The message.
 * @returns Its severity, `"info"` when it states none.
 */
export function severityOf(message: Message): Severity {
	return message.severity ?? "info";
}
