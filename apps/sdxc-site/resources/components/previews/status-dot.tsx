/**
 * Live preview for `StatusDot`: a deploy pipeline's states in their roles, the in-progress
 * one pulsing, a label-less dot named for assistive technology, and the `n/N` summary a status
 * filter trigger shows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack, vstack } from "@sdxc/u/layout";
import { StatusDot } from "@sdxc/ui/status-dot";

/** The source the page shows, matching the markup below. */
const CODE = `<StatusDot color="neutral">Queued</StatusDot>
<StatusDot color="brand" pulse>Building</StatusDot>
<StatusDot color="success">Ready</StatusDot>
<StatusDot color="warning">Degraded</StatusDot>
<StatusDot color="danger">Error</StatusDot>

<StatusDot color="danger" aria-label="Down" />

<StatusDot.Summary
	colors={["success", "warning", "danger"]}
	count={3}
	total={5}
	label="3 of 5 statuses shown"
/>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[vstack({ gap: 4 })]}>
			<div mix={[vstack({ gap: 2 })]}>
				<StatusDot color="neutral">Queued</StatusDot>
				<StatusDot color="brand" pulse>
					Building
				</StatusDot>
				<StatusDot color="success">Ready</StatusDot>
				<StatusDot color="warning">Degraded</StatusDot>
				<StatusDot color="danger">Error</StatusDot>
			</div>
			<div mix={[hstack({ gap: 4, align: "center" })]}>
				<StatusDot color="danger" aria-label="Down" />
				<StatusDot.Summary
					colors={["success", "warning", "danger"]}
					count={3}
					total={5}
					label="3 of 5 statuses shown"
				/>
			</div>
		</div>
	),
};
