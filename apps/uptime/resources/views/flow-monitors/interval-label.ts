/**
 * The words a flow monitor's interval is shown in, shared by the list and the detail page.
 * Each interval the form offers has its own message; a stored value outside that set, from
 * before an option was retired, still reads as a duration in the viewer's language.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";

import { isFlowIntervalSeconds } from "~/config/pricing";

/**
 * Labels `seconds` with the option the form names it by, or as a number of seconds in
 * `locale` when no option matches.
 *
 * @param t - The request's translator, unprefixed.
 * @param locale - The language a stored interval outside the options is formatted in.
 * @param seconds - The monitor's interval.
 */
export function flowIntervalLabel(t: Translate, locale: string, seconds: number): string {
	if (isFlowIntervalSeconds(seconds)) {
		return t(`page.createFlowMonitor.form.fields.interval.options.${seconds}`);
	}
	return new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "second",
		unitDisplay: "long",
	}).format(seconds);
}
