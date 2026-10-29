/**
 * Live preview for `StepList`: three numbered steps with a title and a line each, the way
 * a landing explains how to get started.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is } from "@sdxc/u/size";
import { HeadingScope } from "@sdxc/ui";
import { StepList } from "@sdxc/ui/patterns";

/** The source the page shows, matching the markup below. */
const CODE = `<StepList>
	<StepList.Item title="Add a monitor">Paste the URL you want watched.</StepList.Item>
	<StepList.Item title="Pick who gets paged">Route alerts to a person or a rotation.</StepList.Item>
	<StepList.Item title="Share the status page">Customers subscribe to updates.</StepList.Item>
</StepList>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full")]}>
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
		</div>
	),
};
