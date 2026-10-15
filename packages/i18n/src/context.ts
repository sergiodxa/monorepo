/**
 * The context keys the router and command-line middleware publish the language and translators
 * under, so code that reads them by key finds the same values whichever host it runs in, and the
 * handler that reports message errors to the invocation's log.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { currentLog } from "@sdxc/logger";
import { MessageError } from "@sdxc/messageformat";
import { createContextKey } from "remix/router";

import type { I18n } from "./lib/i18n.js";
import type { Translator } from "./lib/translator.js";

/** The supported language the invocation's own output is in, installed as `ctx.locale`. */
export const CurrentLocale: { defaultValue?: string } = createContextKey<string>();

/** The translator bound to {@link CurrentLocale}, installed as `ctx.intl`. */
export const CurrentIntl: { defaultValue?: I18n } = createContextKey<I18n>();

/**
 * The factory a command binds to each recipient's language, installed as `ctx.translate`, for
 * text written to someone other than whoever runs the command.
 */
export const Translators: { defaultValue?: Translator } = createContextKey<Translator>();

/**
 * Reports a message error as a warning on the current invocation's log, keyed by the message
 * key so a broken translation can be traced to its source.
 */
export function logError(error: Error, key: string): void {
	currentLog()?.warn("i18n.error", {
		key,
		type: error instanceof MessageError ? error.type : error.name,
		message: error.message,
	});
}
