/**
 * `remix/ui` context provider that publishes a live i18next instance to
 * descendants, the render-tree counterpart to `context.i18next` from
 * `@pkg/i18n/middleware`. Re-renders its subtree client-side when the
 * instance's language changes or a namespace loads, and stays inert
 * server-side so `context.locale` stays fixed for a request's lifetime.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { i18n as I18n } from "i18next";
import type { Handle, RemixNode } from "remix/ui";

export namespace IntlProvider {
	export interface Props {
		/** i18next instance published to descendants; read it back with {@link intl}. */
		i18n: I18n;
		children?: RemixNode;
	}
}

/**
 * Publishes `i18n` to every descendant through context and renders
 * `children` unchanged. Re-renders its whole subtree client-side when the
 * instance's language changes or a namespace finishes loading.
 *
 * @example
 * <IntlProvider i18n={ctx.i18next}>
 * 	<App />
 * </IntlProvider>
 */
export function IntlProvider(handle: Handle<IntlProvider.Props, I18n>) {
	handle.queueTask(() => {
		let i18n = handle.props.i18n;

		/**
		 * Fires-and-forgets: i18next's emitter calls listeners synchronously and
		 * drops what they return, so this settles the re-render after the event.
		 */
		function onChange() {
			void handle.update();
		}

		i18n.on("languageChanged", onChange);
		i18n.on("loaded", onChange);

		handle.signal.addEventListener("abort", () => {
			i18n.off("languageChanged", onChange);
			i18n.off("loaded", onChange);
		});
	});

	return () => {
		handle.context.set(handle.props.i18n);
		return handle.props.children ?? null;
	};
}

let defaultI18n: I18n | undefined;

/**
 * Registers a module-scoped default i18next instance for {@link intl} to
 * fall back to when there is no ancestor {@link IntlProvider}, so each
 * independently hydrated island can call `intl(handle)`/`Trans` without one.
 *
 * @example
 * setIntl(i18n);
 * run({ loadModule, resolveFrame });
 */
export function setIntl(i18n: I18n): void {
	if (typeof document === "undefined") {
		throw new Error(
			"setIntl() is browser-only. A module-scoped instance would be shared by every concurrent request in a Workers isolate, exactly what @pkg/i18n/middleware's per-request instance exists to avoid.",
		);
	}

	defaultI18n = i18n;
}

/**
 * Reads the i18next instance published by the nearest ancestor
 * {@link IntlProvider}, falling back to the module-scoped default
 * registered via {@link setIntl}, and throws when neither exists.
 *
 * @example
 * let i18n = intl(handle);
 * let message = i18n.t("greeting");
 */
export function intl(handle: Handle<unknown, any>): I18n {
	let i18n = handle.context.get(IntlProvider) ?? defaultI18n;
	if (!i18n) {
		throw new Error(
			"intl() was called with no ancestor IntlProvider and no default registered via setIntl().",
		);
	}
	return i18n;
}
