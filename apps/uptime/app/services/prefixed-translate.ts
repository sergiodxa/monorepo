/**
 * Scopes a translator to one subtree of the locale bundles, so a form or layout that reads
 * dozens of sibling keys names each by its short path and the shared prefix lives in one place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {
	AppMessages,
	MessageAt,
	MessageKey,
	MessagePrefix,
	Messages,
	Translate,
} from "@sdxc/i18n";

/**
 * The keys under prefix `P`, as {@link withPrefix}'s translator takes them, for a table that maps
 * a field or a state to its message.
 *
 * @template P - The prefix the keys are relative to.
 */
export type PrefixedKey<P extends string> = MessageKey<MessageAt<AppMessages, P>>;

/**
 * A translator whose keys are relative to `P`. Its keys are those every subtree `P` names
 * shares, and its values are checked against the message the full key resolves to.
 *
 * @template P - The prefix, or a union of prefixes whose subtrees share their keys.
 */
export type PrefixedTranslate<P extends string> = Translate<MessageAt<AppMessages, P>>;

/**
 * Returns a translator that resolves every key under `prefix`, keeping values, plural
 * selection and missing-key behavior identical to `t`.
 *
 * @param t - The translator to delegate to.
 * @param prefix - The dotted path the returned translator's keys are relative to.
 * @example let fields = withPrefix(ctx.intl.t, "page.alerts.form.fields"); fields("name.label");
 */
export function withPrefix<P extends MessagePrefix<AppMessages>>(
	t: Translate,
	prefix: P,
): PrefixedTranslate<P> {
	let translate = t as Translate<Messages>;
	let prefixed: Translate<Messages> = (key, values) => translate(`${prefix}.${key}`, values);
	return prefixed as PrefixedTranslate<P>;
}
