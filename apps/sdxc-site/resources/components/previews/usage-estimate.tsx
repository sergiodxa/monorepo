/**
 * Live preview for `UsageEstimate`: a usage calculator for recorded hours, its GET form
 * beside the bill printed for the default 40 hours, so the frame shows what a page renders
 * before and after a reader submits.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is } from "@sdxc/u/size";
import { TextField } from "@sdxc/ui";
import { UsageEstimate } from "@sdxc/ui/landing";

/** The source the page shows, matching the markup below. */
const CODE = `<UsageEstimate
	action="#pricing"
	fields={
		<TextField label="Recorded hours a month" type="number" name="hours" defaultValue="40" />
	}
	submitLabel="Estimate"
	billLabel="Estimated monthly bill"
	rows={[
		{ label: "Free hours", detail: "5 h × $0.00", amount: "$0.00" },
		{ label: "Recorded hours", detail: "35 h × $0.36", amount: "$12.60" },
	]}
	total={{ label: "Per month", amount: "$12.60" }}
	footnote="Everyone in the workspace reads the notes free."
/>`;

/** What the preview registry reads: the source to show, and the calculator to draw. */
export default {
	code: CODE,
	render: () => (
		<UsageEstimate
			mix={[is("full")]}
			action="#pricing"
			fields={
				<TextField label="Recorded hours a month" type="number" name="hours" defaultValue="40" />
			}
			submitLabel="Estimate"
			billLabel="Estimated monthly bill"
			rows={[
				{ label: "Free hours", detail: "5 h × $0.00", amount: "$0.00" },
				{ label: "Recorded hours", detail: "35 h × $0.36", amount: "$12.60" },
			]}
			total={{ label: "Per month", amount: "$12.60" }}
			footnote="Everyone in the workspace reads the notes free."
		/>
	),
};
