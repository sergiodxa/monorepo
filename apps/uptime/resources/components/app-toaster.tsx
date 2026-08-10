/**
 * App-wide client toast stack: a `clientEntry` island holding one headless `Toaster`
 * queue and rendering it into a `Toast.Region`. Any other island anywhere on the page
 * queues a toast with {@link showToast}, which travels as a DOM event on `document`
 * rather than through `remix/ui` context — each island hydrates its own runtime tree, so
 * there is no shared ancestor between a button in the page header and this region.
 *
 * It renders nothing at all while the queue is empty, which is always the case
 * server-side: a toast here is by definition something that happened after hydration, and
 * keeping the empty case out of the markup is also what lets the region's labels come
 * from `intl(handle)` (resolved from the module-scoped default the browser bootstrap
 * registers, which exists only in the browser) without an `IntlProvider` ancestor.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { intl } from "@pkg/i18n/ui";
import { Toast } from "@pkg/ui";
import { Toaster } from "@pkg/ui/behaviors";
import { clientEntry, on } from "remix/ui";

/**
 * Name of the `document`-level event {@link showToast} dispatches and {@link AppToaster}
 * listens for. Namespaced so it can never collide with a platform or library event.
 */
const TOAST_EVENT = "uptime:toast";

/** What a queued toast carries, already translated by whoever asked for it. */
export interface AppToast {
	/** Headline copy, the one part every toast must have. */
	title: string;
	/** Optional supporting line under {@link AppToast.title}. */
	description?: string;
	/** Semantic tone; defaults to the neutral panel when omitted. */
	color?: Toast.Color;
}

/**
 * Queues a toast on the page's {@link AppToaster}. A no-op outside the browser and
 * whenever no `AppToaster` is mounted, so a caller never has to guard either case —
 * a toast is a progressive enhancement, not something to fail a flow over.
 *
 * @param toast The already-translated toast to show.
 * @example
 * showToast({ title: t("page.monitor.run.toast.recovered", { name }), color: "success" });
 */
export function showToast(toast: AppToast): void {
	if (typeof document === "undefined") return;
	document.dispatchEvent(new CustomEvent<AppToast>(TOAST_EVENT, { detail: toast }));
}

/** Renders every toast queued through {@link showToast}, or nothing while the queue is empty. */
export const AppToaster = clientEntry(
	"/resources/components/app-toaster.tsx#AppToaster",
	function AppToaster(handle: Handle) {
		let toaster = new Toaster<AppToast>();

		/**
		 * `queueTask` never runs in the server renderer, which is what keeps every
		 * `document`/timer touch below out of the SSR pass without an environment check.
		 */
		handle.queueTask(() => {
			toaster.addEventListener("change", () => handle.update(), { signal: handle.signal });

			document.addEventListener(
				TOAST_EVENT,
				(event) => {
					if (!(event instanceof CustomEvent)) return;
					toaster.add(event.detail as AppToast);
				},
				{ signal: handle.signal },
			);

			// Timers outlive the island otherwise, and each one would fire into a dead tree.
			handle.signal.addEventListener("abort", () => toaster.dispose());
		});

		return () => {
			let toasts = toaster.toasts;
			if (toasts.length === 0) return null;

			let t = intl(handle).t;

			return (
				<Toast.Region aria-label={t("app.layout.toasts.region")}>
					{toasts.map((toast) => (
						<Toast key={toast.id} color={toast.data.color}>
							<Toast.Content>
								<Toast.Title>{toast.data.title}</Toast.Title>
								{toast.data.description && (
									<Toast.Description>{toast.data.description}</Toast.Description>
								)}
							</Toast.Content>
							<Toast.Close
								aria-label={t("app.layout.toasts.dismiss")}
								mix={[
									on("click", () => {
										toaster.dismiss(toast.id);
									}),
								]}
							/>
						</Toast>
					))}
				</Toast.Region>
			);
		};
	},
);

export default AppToaster;
