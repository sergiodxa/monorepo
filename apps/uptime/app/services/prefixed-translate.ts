/**
 * Scopes a translator to one subtree of the locale bundles, so a form or layout that reads
 * dozens of sibling keys names each by its short path and the shared prefix lives in one place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";

/**
 * Returns a translator that resolves every key under `prefix`, keeping values, plural
 * selection and missing-key behavior identical to `t`.
 *
 * @param t - The translator to delegate to.
 * @param prefix - The dotted path the returned translator's keys are relative to.
 * @example let fields = withPrefix(ctx.intl.t, "page.alerts.form.fields"); fields("name.label");
 */
export function withPrefix(t: Translate, prefix: string): Translate {
	return (key, values) => t(`${prefix}.${key}`, values);
}
