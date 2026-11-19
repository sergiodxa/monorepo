/**
 * Live preview for `StepIndicator`: a three-page transfer on its second step, the payee
 * step done and linking back, the review still ahead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { StepIndicator } from "@sdxc/ui/step-indicator";

/** The source the page shows, matching the markup below. */
const CODE = `<StepIndicator label="Transfer steps">
	<StepIndicator.Step number={1} state="complete" href="/transfer">Payee</StepIndicator.Step>
	<StepIndicator.Step number={2} state="current">Amount</StepIndicator.Step>
	<StepIndicator.Step number={3} state="upcoming">Review</StepIndicator.Step>
</StepIndicator>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={raw({ inlineSize: "100%", maxInlineSize: "30rem", marginBlock: "1.5rem" })}>
			<StepIndicator label="Transfer steps">
				<StepIndicator.Step number={1} state="complete" href="#payee">
					Payee
				</StepIndicator.Step>
				<StepIndicator.Step number={2} state="current">
					Amount
				</StepIndicator.Step>
				<StepIndicator.Step number={3} state="upcoming">
					Review
				</StepIndicator.Step>
			</StepIndicator>
		</div>
	),
};
