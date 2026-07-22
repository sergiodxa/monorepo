/**
 * `remix/ui` context provider that publishes a live i18next instance to every
 * descendant component, the render-tree counterpart to `context.i18next` from
 * `@pkg/i18n/middleware`. Render the same per-request instance the middleware
 * already initialized server-side, or one created directly with i18next's own
 * `createInstance()` for a page that renders entirely client-side.
 *
 * Client-side, `IntlProvider` re-renders its whole subtree on its own
 * whenever the instance's language changes or a namespace finishes loading,
 * so every descendant's `i18n.t()`/`Trans` call reflects it without any of
 * them subscribing to anything themselves. It does this through
 * `handle.queueTask`, which the server renderer never runs — so server-side,
 * `IntlProvider` subscribes to nothing at all, matching how `context.locale`
 * is meant to stay fixed for the lifetime of a request instead of changing
 * mid-render.
 *
 * `setIntl` registers a module-scoped default for the case `IntlProvider`
 * itself can't reach: each independently hydrated island mounts its own
 * runtime tree, with no ancestor context from the server-rendered page around
 * it. Client-side, unlike server-side, one instance per page load is safe —
 * there's exactly one user, not many concurrent requests sharing an isolate —
 * so registering one default once and skipping `IntlProvider` in every island
 * is the normal case; reach for `IntlProvider` there only to override the
 * default for one specific subtree.
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
 * Publishes `i18n` to every descendant through context and renders `children`
 * unchanged. Re-renders its whole subtree when the instance's language
 * changes or a namespace finishes loading — client-side only; see the module
 * doc comment for why `handle.queueTask` is what makes that client-only
 * without an explicit environment check.
 *
 * @example
 * <IntlProvider i18n={ctx.i18next}>
 * 	<App />
 * </IntlProvider>
 */
export function IntlProvider(handle: Handle<IntlProvider.Props, I18n>) {
	handle.queueTask(() => {
		let i18n = handle.props.i18n;

		function onChange() {
			handle.update();
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
 * Registers a module-scoped default i18next instance for {@link intl} to fall
 * back to when there's no ancestor {@link IntlProvider} — every independently
 * hydrated island's own case, since none of them can see context from the
 * server-rendered page around it. Call this once, before mounting anything,
 * from the client bootstrap, so every island's `intl(handle)`/`Trans` picks it
 * up with no `IntlProvider` of its own.
 *
 * Browser-only — throws when called outside of one. A module-scoped instance
 * is shared by every concurrent request in a Workers isolate, exactly what
 * `@pkg/i18n/middleware`'s per-request instance exists to avoid.
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
 * {@link IntlProvider}, a wrapper over `handle.context.get(IntlProvider)` so
 * call sites don't need to import `IntlProvider` just to look it up. Falls
 * back to the module-scoped default {@link setIntl} registered when there's
 * no ancestor `IntlProvider`, and throws when neither exists.
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
