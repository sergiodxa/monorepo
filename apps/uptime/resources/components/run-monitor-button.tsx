/**
 * Client island: a real `<form>` posting to the "run monitor" action, so it
 * works with no JS at all (a plain navigating submit, same as before this
 * component existed) — `on("submit")` only runs once hydrated, where it
 * intercepts the submit to `fetch()` the same action instead, so clicking
 * doesn't navigate away, and hands its pending state to `@pkg/ui`'s
 * `Button` (`isPending`), which swaps its content for a spinner while the
 * request is in flight. `Monitor.ping` only enqueues the check — the
 * check itself finishes asynchronously — so the hydrated path keeps the
 * button pending and polls the run-status route until the queued check
 * commits a result (or the wait times out), then reloads the detail page's
 * stat-card and uptime-history frames in place and, when the check moved the
 * monitor to a different status, queues a toast about it.
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

import type { TFunction } from "@pkg/i18n";
import type { Handle } from "remix/ui";

import { intl } from "@pkg/i18n/ui";
import { PlayIcon } from "@pkg/lucide-remix";
import { m } from "@pkg/u/size";
import { Button } from "@pkg/ui";
import * as s from "remix/data-schema";
import { clientEntry, on } from "remix/ui";

import type { AppToast } from "~/resources/components/app-toaster";

import { showToast } from "~/resources/components/app-toaster";

/**
 * Every named `Frame` on the monitor detail page whose content a completed check can
 * change. Listed here rather than derived, because the button sits in the page header,
 * outside all of them, and `handle.frames.get()` is a lookup by name.
 */
const MONITOR_FRAMES = [
	"monitor-card-usage",
	"monitor-card-slowest-result",
	"monitor-card-p99-response-time",
	"monitor-card-uptime",
	"monitor-card-uptime-history",
];

/** How long to wait between run-status polls while a queued check is still outstanding. */
const POLL_INTERVAL_MS = 2000;

/**
 * How long to keep polling before giving up. Generous, since the wait covers queue
 * delivery plus the probe's own timeout; giving up only means no toast, never a wrong one.
 */
const POLL_TIMEOUT_MS = 45_000;

/** What a completed check can classify a monitor as, mirrored from the column's value set. */
const RunStatusSchema = s.nullable(s.enum_(["up", "down", "degraded"]));

/** The action's JSON answer: whether a check was enqueued, plus the state to compare against. */
const PlayResponseSchema = s.object({
	queued: s.boolean(),
	status: RunStatusSchema,
	checkedAt: s.nullable(s.number()),
});

/** The run-status route's answer: the monitor row's cached last check outcome. */
const RunStatusResponseSchema = s.object({
	status: RunStatusSchema,
	checkedAt: s.nullable(s.number()),
});

/** Props must be a `type` (not `interface`) to satisfy `SerializableProps`. */
type RunMonitorButtonProps = {
	action: string;
	monitorId: string;
	/** Absolute path of the run-status route for this monitor, polled after a run starts. */
	statusUrl: string;
	/** The monitor's name, interpolated into the toast copy. */
	name: string;
};

/** Resolves after `ms`, or as soon as `signal` aborts, whichever comes first. */
function delay(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve) => {
		let timer = setTimeout(resolve, ms);
		signal.addEventListener("abort", () => {
			clearTimeout(timer);
			resolve();
		});
	});
}

/**
 * Polls `statusUrl` until the monitor's last-checked instant moves past `since`, which is
 * what tells the queued check apart from the result that was already there. Returns the
 * new status, or `undefined` when the wait ran out or anything about the response was
 * unusable — both mean "say nothing", never "assume it stayed the same".
 */
async function waitForCheck(
	statusUrl: string,
	since: number | null,
	signal: AbortSignal,
): Promise<"up" | "down" | "degraded" | null | undefined> {
	let deadline = Date.now() + POLL_TIMEOUT_MS;

	while (Date.now() < deadline && !signal.aborted) {
		await delay(POLL_INTERVAL_MS, signal);
		if (signal.aborted) return undefined;

		try {
			let response = await fetch(statusUrl, {
				credentials: "same-origin",
				headers: { accept: "application/json" },
				signal,
			});
			if (!response.ok) return undefined;

			let result = s.parse(RunStatusResponseSchema, await response.json());
			if (result.checkedAt !== since) return result.status;
		} catch {
			return undefined;
		}
	}

	return undefined;
}

/**
 * The toast a status change deserves, or `undefined` when the check left the monitor where
 * it was — an unchanged run is not news, and must stay silent.
 */
export function transitionToast(
	t: TFunction,
	name: string,
	previous: string | null,
	current: "up" | "down" | "degraded" | null,
): AppToast | undefined {
	if (current === null || current === previous) return undefined;

	return {
		title: t(`page.monitor.run.toast.${current}`, { name }),
		description: t("page.monitor.run.toast.changed"),
		color: current === "up" ? "success" : current === "degraded" ? "warning" : "danger",
	};
}

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
							let body = new FormData(event.currentTarget);
							/**
							 * The island's own signal, not the render-scoped one: `handle.update()`
							 * below aborts the latter, and this flow outlives several updates.
							 */
							let signal = handle.signal;

							pending = true;
							void handle.update();

							try {
								let response = await fetch(handle.props.action, {
									method: "POST",
									credentials: "same-origin",
									headers: { accept: "application/json" },
									body,
									signal,
								});
								if (!response.ok) return;

								let run = s.parse(PlayResponseSchema, await response.json());

								if (!run.queued) {
									showToast({
										title: t("page.monitor.run.toast.notQueued.title"),
										description: t("page.monitor.run.toast.notQueued.description"),
										color: "danger",
									});
									return;
								}

								let status = await waitForCheck(handle.props.statusUrl, run.checkedAt, signal);
								if (status === undefined) return;

								// Reloaded before the toast so the numbers behind it are already the new ones.
								// A frame the page did not render has nothing to wait on, so it is dropped
								// rather than contributing an `undefined` to the batch.
								let frames = MONITOR_FRAMES.map((name) => handle.frames.get(name)).filter(
									(frame) => frame !== undefined,
								);
								await Promise.all(frames.map((frame) => frame.reload()));

								let toast = transitionToast(t, handle.props.name, run.status, status);
								if (toast) showToast(toast);
							} catch {
								// A failed run is already visible in the page; a broken toast helps nobody.
							} finally {
								pending = false;
								void handle.update();
							}
						}),
					]}
				>
					<input type="hidden" name="monitor_id" value={handle.props.monitorId} />
					<Button type="submit" color="neutral" isPending={pending} disabled={pending}>
						<PlayIcon size={16} strokeWidth={1.5} />
						{t("page.monitor.header.action.play")}
					</Button>
				</form>
			);
		};
	},
);

export default RunMonitorButton;
