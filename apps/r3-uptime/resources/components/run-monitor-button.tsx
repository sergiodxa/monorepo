/**
 * Client island: a real `<form>` posting to the "run monitor" action, so it
 * works with no JS at all (a plain navigating submit, same as before this
 * component existed) — `on("submit")` only runs once hydrated, where it
 * intercepts the submit to `fetch()` the same action instead, so clicking
 * doesn't navigate away, and swaps the play icon for a spinning loader icon
 * while the request is in flight. `Monitor.ping` only queues a workflow run
 * — the check itself finishes asynchronously — so "done" here means "the
 * queue request completed", matching the old app's own fetcher-driven
 * spinner (tied to request state, not to whether the queued check has
 * finished).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { LoaderIcon, PlayIcon } from "@pkg/lucide-remix";
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
			<form
				method="post"
				action={handle.props.action}
				mix={[
					css({ margin: 0 }),
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
						<LoaderIcon size={16} strokeWidth={1.5} mix={[spinner]} />
					) : (
						<PlayIcon size={16} strokeWidth={1.5} />
					)}
					Run Monitor
				</button>
			</form>
		);
	},
);

export default RunMonitorButton;
