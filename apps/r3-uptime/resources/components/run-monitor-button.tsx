/**
 * Client island: a real `<form>` posting to the "run monitor" action, so it
 * works with no JS at all (a plain navigating submit, same as before this
 * component existed) — `on("submit")` only runs once hydrated, where it
 * intercepts the submit to `fetch()` the same action instead, so clicking
 * doesn't navigate away, and swaps the play icon for `@pkg/r3-ui`'s `Spinner`
 * while the request is in flight. `Monitor.ping` only queues a workflow run
 * — the check itself finishes asynchronously — so "done" here means "the
 * queue request completed" (tied to request state, not to whether the queued
 * check has finished).
 *
 * Its label reads through `@pkg/i18n/ui`'s `intl(handle)` rather than
 * `ctx.i18next.t`, since this component runs both server-side (the no-JS
 * baseline markup) and client-side (after hydration) and has no access to the
 * request-scoped `ctx.i18next` instance itself — `intl(handle)` resolves the
 * nearest ancestor `IntlProvider` (wired up by this component's caller,
 * `monitor-show.tsx`, for the server-rendered pass) or, client-side, the
 * module-scoped default `bootstrap/browser.ts` registers via `setIntl()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { intl } from "@pkg/i18n/ui";
import { PlayIcon } from "@pkg/lucide-remix";
import { Spinner } from "@pkg/r3-ui";
import { fg } from "@pkg/u/color";
import { m } from "@pkg/u/size";
import { clientEntry, on } from "remix/ui";

import { buttonBase, buttonSizeMix, buttonVariantMix } from "~/resources/components/button";

/** Props must be a `type` (not `interface`) to satisfy `SerializableProps`. */
type RunMonitorButtonProps = { action: string; monitorId: string };

/** Posts {@link RunMonitorButtonProps.action} with the monitor's id, spinning the icon until the request settles. */
export const RunMonitorButton = clientEntry(
	"/resources/components/run-monitor-button.tsx#RunMonitorButton",
	function RunMonitorButton(handle: Handle<RunMonitorButtonProps>) {
		let pending = false;

		return () => {
			let t = intl(handle).t;

			return (
				<form
					method="post"
					action={handle.props.action}
					mix={[
						m(0),
						on("submit", async (event) => {
							event.preventDefault();
							pending = true;
							handle.update();
							try {
								await fetch(handle.props.action, {
									method: "POST",
									body: new FormData(event.currentTarget),
								});
							} finally {
								pending = false;
								handle.update();
							}
						}),
					]}
				>
					<input type="hidden" name="monitor_id" value={handle.props.monitorId} />
					<button
						type="submit"
						disabled={pending}
						mix={[buttonBase, buttonSizeMix.md, buttonVariantMix.solid.neutral]}
					>
						{pending ? (
							<Spinner
								size="sm"
								aria-label={t("page.monitor.header.action.running")}
								mix={[fg("inherit")]}
							/>
						) : (
							<PlayIcon size={16} strokeWidth={1.5} />
						)}
						{t("page.monitor.header.action.play")}
					</button>
				</form>
			);
		};
	},
);

export default RunMonitorButton;
