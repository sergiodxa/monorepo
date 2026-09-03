/**
 * Renders an i18next translation containing `<tagName>...</tagName>` markers
 * as a `RemixNode` tree, splicing in the `RemixElement` from `components`
 * whose key matches each tag's name and keeping that tag's own text/nesting
 * as the spliced element's children. Plain `{{variable}}` interpolation
 * happens through `i18n.t()` itself, the same as calling it directly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { i18n as I18n, TOptions } from "i18next";
import type { Handle, RemixElement } from "remix/ui";

import { intl } from "./intl-provider.js";
import { parseTrans } from "./lib/parse-trans.js";

export namespace Trans {
	export interface Props {
		/**
		 * i18next instance to translate through. Defaults to the nearest ancestor
		 * `IntlProvider`'s instance (via `intl`); pass it explicitly to translate
		 * through a different instance, e.g. a namespace-scoped one a parent holds.
		 */
		i18n?: I18n;
		/**
		 * Translation key to look up. Named `i18nKey`, not `key` — `key` is
		 * `remix/ui`'s own reconciliation prop and never reaches `handle.props`.
		 */
		i18nKey: string;
		/** Interpolation values, forwarded to `i18n.t()` alongside `i18nKey`. */
		values?: TOptions;
		/** Elements spliced in for each `<tagName>...</tagName>` marker in the translation, keyed by tag name. */
		components?: Record<string, RemixElement>;
	}
}

/**
 * @example
 * <Trans
 * 	i18nKey="feed.article"
 * 	values={{ title: item.title }}
 * 	components={{ articleLink: <Link href={item.link} /> }}
 * />
 */
export function Trans(handle: Handle<Trans.Props>) {
	return () => {
		let { i18n = intl(handle), i18nKey, values, components } = handle.props;
		let translation = i18n.t(i18nKey, values);

		return parseTrans(String(translation), components ?? {});
	};
}
