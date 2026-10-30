/**
 * Live preview for `StepList`: three numbered steps the way a landing explains how to get
 * started, then a timeline that walks one incident from the first failed probe to the
 * all-clear, with a timestamp per step.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { HeadingScope } from "@sdxc/ui";
import { StepList } from "@sdxc/ui/patterns";

/** The source the page shows, matching the markup below. */
const CODE = `<StepList>
	<StepList.Item title="Add a monitor">Paste the URL you want watched.</StepList.Item>
	<StepList.Item title="Pick who gets paged">Route alerts to a person or a rotation.</StepList.Item>
	<StepList.Item title="Share the status page">Customers subscribe to updates.</StepList.Item>
</StepList>

<StepList variant="timeline">
	<StepList.Item meta="14:02 UTC" title="Checkout starts failing">
		Probes in eu-west and us-east both see <strong>503s from checkout</strong>, so the
		failure is confirmed in 3 seconds.
	</StepList.Item>
	<StepList.Item meta="14:04 UTC" title="On-call acknowledges">
		Ana gets the page with the failing region, the response body and the last deploy.
	</StepList.Item>
	<StepList.Item meta="14:19 UTC" title="Back to green">
		The rollback lands, every region passes, and subscribers get the all-clear.
	</StepList.Item>
</StepList>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full"), vstack({ gap: 16, align: "stretch" })]}>
			<HeadingScope>
				<StepList>
					<StepList.Item title="Add a monitor">Paste the URL you want watched.</StepList.Item>
					<StepList.Item title="Pick who gets paged">
						Route alerts to a person or a rotation.
					</StepList.Item>
					<StepList.Item title="Share the status page">
						Customers subscribe to updates.
					</StepList.Item>
				</StepList>
			</HeadingScope>
			<HeadingScope>
				<StepList variant="timeline">
					<StepList.Item meta="14:02 UTC" title="Checkout starts failing">
						Probes in eu-west and us-east both see <strong>503s from checkout</strong>, so the
						failure is confirmed in 3 seconds.
					</StepList.Item>
					<StepList.Item meta="14:04 UTC" title="On-call acknowledges">
						Ana gets the page with the failing region, the response body and the last deploy.
					</StepList.Item>
					<StepList.Item meta="14:19 UTC" title="Back to green">
						The rollback lands, every region passes, and subscribers get the all-clear.
					</StepList.Item>
				</StepList>
			</HeadingScope>
		</div>
	),
};
