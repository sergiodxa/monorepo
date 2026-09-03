/**
 * Client island: a real `<form>` posting to the "run monitor" action works with
 * no JS; once hydrated, `on("submit")` intercepts it to `fetch()` the same action
 * instead, showing a spinner via `Button`'s `isPending` while it's in flight.
 * `Monitor.ping` only enqueues the check, so the button polls the run-status
 * route until it commits a result (or times out), reloads the affected frames,
 * and toasts any status change.
 *
 * Its label reads through `intl(handle)` rather than `ctx.i18next.t`, since it
 * also renders server-side with no request-scoped `ctx.i18next` to read from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@sdxc/i18n";
import type { Handle } from "remix/ui";

import { intl } from "@sdxc/i18n/ui";
import { PlayIcon } from "@sdxc/icons";
import { m } from "@sdxc/u/size";
import { Button } from "@sdxc/ui";
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
 * Polls `statusUrl` until the monitor's last-checked instant moves past `since`,
 * distinguishing the queued check's own result from one already there. Returns
 * `undefined` on timeout or an unusable response — both read as "say nothing."
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
 * The toast a status change deserves, or `undefined` when the check left the
 * monitor where it was — only a change is worth announcing.
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

/**
 * Posts {@link RunMonitorButtonProps.action} with the monitor's id, spinning
 * the icon until the request settles, then reloads the affected frames before
 * toasting so the toast lands over numbers that already reflect the result.
 */
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

								/** Only frames the page actually rendered have anything to reload, so a missing lookup is filtered out. */
								let frames = MONITOR_FRAMES.map((name) => handle.frames.get(name)).filter(
									(frame) => frame !== undefined,
								);
								await Promise.all(frames.map((frame) => frame.reload()));

								let toast = transitionToast(t, handle.props.name, run.status, status);
								if (toast) showToast(toast);
							} catch {
								/** A failed run already shows in the page, so this stays silent rather than risking a wrong toast. */
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
