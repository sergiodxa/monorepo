/**
 * The translator the public pages render with: the request's own, with the figures every
 * page may quote bound in, typed so a message that quotes only figures takes no values while
 * one reading anything else still asks for it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AppMessages, MessageKey, MessageValues, Messages, Translate } from "@sdxc/i18n";

import type { LandingFigures } from "~/resources/components/marketing/figures";

/**
 * The values a call through {@link LandingTranslate} still passes for the message at `K`:
 * those the message reads beyond the figures, any of the figures to override, or none.
 */
type FigureValues<K extends string> =
	MessageValues<AppMessages, K> extends [values?: infer Values]
		? OwnValues<NonNullable<Values>>
		: never;

/** The rest parameters for a message reading `Values`, with every figure already bound. */
type OwnValues<Values> = string extends keyof Values
	? [values?: Values]
	: [Exclude<keyof Values, keyof LandingFigures>] extends [never]
		? [values?: Partial<Values>]
		: [values: Omit<Values, keyof LandingFigures> & Partial<Values>];

/** A translator whose messages may quote any of {@link LandingFigures} without being passed it. */
export type LandingTranslate = <K extends MessageKey<AppMessages>>(
	key: K,
	...values: FigureValues<K>
) => string;

/**
 * Binds `figures` into every call of `t`, with a value a call site passes winning. A figure
 * `figures` leaves out renders as its placeholder, so a test can bind only those it reads.
 *
 * @param t - The translator to delegate to.
 * @param figures - The figures every message may quote, formatted for `t`'s language.
 * @example let t = bindFigures(translate("en").t, { freeFeeds: "20" });
 */
export function bindFigures(t: Translate, figures: Partial<LandingFigures>): LandingTranslate {
	let translate = t as Translate<Messages>;
	let bound: Translate<Messages> = (key, values) => translate(key, { ...figures, ...values });
	return bound as LandingTranslate;
}
