/**
 * `remix/ui` context provider that publishes an `I18n` translator to descendants, the
 * render-tree counterpart to `context.intl` from `@sdxc/i18n/middleware`. A translator is
 * immutable, so switching language means rendering the provider with a new one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import type { I18n } from "../lib/i18n.js";

export namespace IntlProvider {
	export interface Props {
		/** Translator published to descendants, typed keys or not; read it back with {@link intl}. */
		intl: I18n<any>;
		children?: RemixNode;
	}
}

/**
 * Publishes `intl` to every descendant through context and renders `children` unchanged.
 *
 * @example
 * <IntlProvider intl={ctx.intl}>
 * 	<App />
 * </IntlProvider>
 */
export function IntlProvider(handle: Handle<IntlProvider.Props, I18n>) {
	return () => {
		handle.context.set(handle.props.intl);
		return handle.props.children ?? null;
	};
}

let defaultIntl: I18n | undefined;

/**
 * Registers a module-scoped default translator for {@link intl} to fall back to when there is
 * no ancestor {@link IntlProvider}, so each independently hydrated island can call
 * `intl(handle)`/`Trans` without one.
 *
 * @example
 * setIntl(translation.intl);
 * run({ loadModule, resolveFrame });
 */
export function setIntl(intl: I18n<any>): void {
	if (typeof document === "undefined") {
		throw new Error(
			"setIntl() is browser-only. A module-scoped translator would be shared by every concurrent request in a Workers isolate, exactly what @sdxc/i18n/middleware's per-request translator exists to avoid.",
		);
	}

	defaultIntl = intl;
}

/**
 * Reads the translator published by the nearest ancestor {@link IntlProvider}, falling back to
 * the module-scoped default registered via {@link setIntl}, and throws when neither exists.
 *
 * @example
 * let message = intl(handle).t("greeting");
 */
export function intl(handle: Handle<unknown, any>): I18n {
	let found = handle.context.get(IntlProvider) ?? defaultIntl;
	if (!found) {
		throw new Error(
			"intl() was called with no ancestor IntlProvider and no default registered via setIntl().",
		);
	}
	return found;
}
