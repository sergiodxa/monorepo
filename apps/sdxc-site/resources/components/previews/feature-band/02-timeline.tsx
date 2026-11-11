/**
 * Live example for a timeline `FeatureBand`: one incident from the first failed probe to
 * the all-clear, each step carrying a `meta` timestamp on the rule.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { HeadingScope } from "@sdxc/ui";
import { FeatureBand, StepList } from "@sdxc/ui/landing";

/** The source the page shows, matching the markup below. */
const CODE = `<FeatureBand
	layout="timeline"
	tone="tinted"
	eyebrow="Incident timeline"
	title="One incident, start to finish"
	description="Seventeen minutes from the first 503 to the all-clear on the status page."
>
	<StepList.Item meta="14:02 UTC" title="Checkout starts failing">…</StepList.Item>
	<StepList.Item meta="14:04 UTC" title="Ana acknowledges">…</StepList.Item>
	<StepList.Item meta="14:11 UTC" title="Status page updated">…</StepList.Item>
	<StepList.Item meta="14:19 UTC" title="Back to green">…</StepList.Item>
</FeatureBand>`;

/** What the preview registry reads: the title, the source to show, and the band to draw. */
export default {
	title: "Timeline of one incident",
	code: CODE,
	viewports: true,
	render: () => (
		<HeadingScope>
			<FeatureBand
				layout="timeline"
				tone="tinted"
				eyebrow="Incident timeline"
				title="One incident, start to finish"
				description="Seventeen minutes from the first 503 to the all-clear on the status page."
			>
				<StepList.Item meta="14:02 UTC" title="Checkout starts failing">
					Probes in eu-west and us-east both see <strong>503s from checkout</strong>, so the failure
					is confirmed three seconds after the first one.
				</StepList.Item>
				<StepList.Item meta="14:04 UTC" title="Ana acknowledges">
					The page carries the failing regions, the response body and the deploy that went out at
					13:58, so Ana starts with <strong>the likely cause</strong>.
				</StepList.Item>
				<StepList.Item meta="14:11 UTC" title="Status page updated">
					Customers on the status page see “Checkout is failing for some card payments” and can
					subscribe to updates.
				</StepList.Item>
				<StepList.Item meta="14:19 UTC" title="Back to green">
					The rollback lands, all six regions pass, and subscribers get the all-clear with the
					incident’s duration.
				</StepList.Item>
			</FeatureBand>
		</HeadingScope>
	),
};
