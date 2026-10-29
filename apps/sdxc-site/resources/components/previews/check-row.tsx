/**
 * Live preview for `CheckList` and `CheckRow`: claims with brand checks, stacked as a list
 * and laid in one row the way a hero's fine print reads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { CheckList, CheckRow } from "@sdxc/ui/patterns";

/** The source the page shows, matching the markup below. */
const CODE = `<div mix={[vstack({ gap: 6, align: "start" })]}>
	<CheckList>
		<CheckRow>Checks from six regions</CheckRow>
		<CheckRow>Alerts by email, Slack and SMS</CheckRow>
		<CheckRow>Ninety days of response history</CheckRow>
	</CheckList>
	<CheckList orientation="horizontal">
		<CheckRow>Free for five monitors</CheckRow>
		<CheckRow>No card required</CheckRow>
	</CheckList>
</div>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[vstack({ gap: 6, align: "start" })]}>
			<CheckList>
				<CheckRow>Checks from six regions</CheckRow>
				<CheckRow>Alerts by email, Slack and SMS</CheckRow>
				<CheckRow>Ninety days of response history</CheckRow>
			</CheckList>
			<CheckList orientation="horizontal">
				<CheckRow>Free for five monitors</CheckRow>
				<CheckRow>No card required</CheckRow>
			</CheckList>
		</div>
	),
};
