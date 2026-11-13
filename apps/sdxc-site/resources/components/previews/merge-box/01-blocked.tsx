/**
 * Live example for `MergeBox` waiting on a review: the review row reads as a warning, a check
 * is still running, and both halves of the merge button stay on screen, disabled, with the
 * sentence that says why.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is, maxIs } from "@sdxc/u/size";
import { MergeBox } from "@sdxc/ui/app/merge-box";

import { MERGE_ACTION, MERGE_LABELS } from "~/resources/components/previews/merge-box";

/** The source the page shows, matching the markup below apart from the preview's width. */
const CODE = `<MergeBox
	state="blocked"
	action="/acme/delta/pull/418/merge"
	rows={{
		reviews: {
			tone: "warning",
			title: "Review required",
			detail: "At least 1 approving review is required by reviewers with write access",
		},
		checks: { tone: "warning", title: "Some checks haven't completed yet", detail: "1 pending and 3 successful checks" },
		conflicts: { tone: "success", title: "No conflicts with the base branch" },
	}}
	labels={labels}
/>`;

/** What the preview registry reads: the title, the source to show, and the box to draw. */
export default {
	title: "Blocked on a review",
	code: CODE,
	render: () => (
		<div mix={[is("full"), maxIs("40rem")]}>
			<MergeBox
				id="preview-merge-box-blocked"
				state="blocked"
				action={MERGE_ACTION}
				labels={MERGE_LABELS}
				rows={{
					reviews: {
						tone: "warning",
						title: "Review required",
						detail: "At least 1 approving review is required by reviewers with write access",
					},
					checks: {
						tone: "warning",
						title: "Some checks haven't completed yet",
						detail: "1 pending and 3 successful checks",
					},
					conflicts: { tone: "success", title: "No conflicts with the base branch" },
				}}
			/>
		</div>
	),
};
