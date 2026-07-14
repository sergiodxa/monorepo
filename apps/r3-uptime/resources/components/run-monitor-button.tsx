/**
 * Client island: posts to the "run monitor" action via `fetch()` instead of a
 * plain form submit, so clicking doesn't navigate away, and shows a spinning
 * icon while the request is in flight. `Monitor.ping` only queues a workflow
 * run — the check itself finishes asynchronously — so "done" here means "the
 * queue request completed", matching the old app's own fetcher-driven spinner
 * (tied to request state, not to whether the queued check has finished).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { PlayIcon } from "@pkg/lucide-remix";
import { clientEntry, css, on } from "remix/ui";

import { buttonBase, buttonSizeMix, buttonVariantMix } from "~/resources/components/button";

/** Props must be a `type` (not `interface`) to satisfy `SerializableProps`. */
type RunMonitorButtonProps = { action: string; monitorId: string };

const spinner = css({
	animation: "uptime-run-monitor-spin 0.8s linear infinite",
	"@keyframes uptime-run-monitor-spin": {
		from: { transform: "rotate(0deg)" },
		to: { transform: "rotate(360deg)" },
	},
});

/** Posts {@link RunMonitorButtonProps.action} with the monitor's id, spinning the icon until the request settles. */
export const RunMonitorButton = clientEntry(
	"/resources/components/run-monitor-button.tsx#RunMonitorButton",
	function RunMonitorButton(handle: Handle<RunMonitorButtonProps>) {
		let pending = false;

		return () => (
			<button
				type="button"
				disabled={pending}
				mix={[
					buttonBase,
					buttonSizeMix.md,
					buttonVariantMix.outline.neutral,
					on("click", async () => {
						pending = true;
						handle.update();
						try {
							let body = new FormData();
							body.set("monitor_id", handle.props.monitorId);
							await fetch(handle.props.action, { method: "POST", body });
						} finally {
							pending = false;
							handle.update();
						}
					}),
				]}
			>
				<PlayIcon size={16} strokeWidth={1.5} mix={[pending && spinner]} />
				Run Monitor
			</button>
		);
	},
);

export default RunMonitorButton;
