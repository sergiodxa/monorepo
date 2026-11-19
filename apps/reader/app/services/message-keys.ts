/**
 * Narrows a name that arrived at runtime, such as a redirect's outcome or a refusal's reason,
 * to a key the English dictionary holds under a prefix, so the message it names is translated
 * with its key checked and a name no message answers to is handled by the caller instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AppMessages, MessageAt, MessageKey, MessagePrefix } from "@sdxc/i18n";

import en from "~/resources/locales/en";

/**
 * Whether English has a message at `prefix.name`. Every other language mirrors English's
 * keys, so a name that passes resolves in each of them.
 *
 * @param prefix - The subtree the name is looked up in.
 * @param name - The name as it arrived, possibly dotted.
 * @example if (hasMessage("agent.tokens.refused", outcome)) t(`agent.tokens.refused.${outcome}`);
 */
export function hasMessage<P extends MessagePrefix<AppMessages>>(
	prefix: P,
	name: string,
): name is MessageKey<MessageAt<AppMessages, P>> {
	let node: unknown = en;
	for (let segment of `${prefix}.${name}`.split(".")) {
		if (typeof node !== "object" || node === null || !Object.hasOwn(node, segment)) return false;
		node = Reflect.get(node, segment);
	}
	return typeof node === "string";
}
