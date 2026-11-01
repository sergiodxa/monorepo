/**
 * Live preview for `EventTicker`: a checkout check landing every five minutes, one run slow,
 * one failing on its named step, and the newest finishing while it is on screen.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { EventTicker } from "@sdxc/ui/landing";

/** The source the page shows, matching the markup below. */
const CODE = `<EventTicker
	aria-label="Recent checkout checks, newest first"
	pauseLabel="Pause the animation"
	title="Checkout, every 5 minutes"
	statusLabels={{ ok: "Passed", warn: "Slow", fail: "Failed", pending: "Running" }}
	rows={[
		{ time: "09:25", label: "Checkout", status: "ok", detail: "4 steps in 1.2s" },
		{ time: "09:30", label: "Checkout", status: "warn", detail: "Pay took 3.8s" },
		{
			time: "09:35",
			label: "Checkout failed at Pay",
			status: "fail",
			code: "POST /api/pay → 502",
		},
		{ time: "09:40", label: "Checkout", status: "ok", detail: "4 steps in 1.1s" },
		{
			time: "09:45",
			label: "Checkout",
			status: "pending",
			detail: "Step 2 of 4",
			flipTo: { status: "ok", detail: "4 steps in 1.3s" },
		},
	]}
	footnote="A failure pages the on-call with the step that broke"
/>`;

/** What the preview registry reads: the source to show, and the ticker to draw. */
export default {
	code: CODE,
	viewports: true,
	render: () => (
		<div mix={[raw({ inlineSize: "100%", maxInlineSize: "28rem", marginInline: "auto" })]}>
			<EventTicker
				aria-label="Recent checkout checks, newest first"
				pauseLabel="Pause the animation"
				title="Checkout, every 5 minutes"
				statusLabels={{ ok: "Passed", warn: "Slow", fail: "Failed", pending: "Running" }}
				rows={[
					{ time: "09:25", label: "Checkout", status: "ok", detail: "4 steps in 1.2s" },
					{ time: "09:30", label: "Checkout", status: "warn", detail: "Pay took 3.8s" },
					{
						time: "09:35",
						label: "Checkout failed at Pay",
						status: "fail",
						code: "POST /api/pay → 502",
					},
					{ time: "09:40", label: "Checkout", status: "ok", detail: "4 steps in 1.1s" },
					{
						time: "09:45",
						label: "Checkout",
						status: "pending",
						detail: "Step 2 of 4",
						flipTo: { status: "ok", detail: "4 steps in 1.3s" },
					},
				]}
				footnote="A failure pages the on-call with the step that broke"
			/>
		</div>
	),
};
