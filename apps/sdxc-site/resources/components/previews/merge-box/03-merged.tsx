/**
 * Live example for a merged `MergeBox`: the box says where the branch landed and offers the
 * next step, a form that deletes the merged branch.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is, maxIs } from "@sdxc/u/size";
import { Button } from "@sdxc/ui";
import { MergeBox } from "@sdxc/ui/app/merge-box";

import { MERGE_ACTION, MERGE_LABELS } from "~/resources/components/previews/merge-box";

/** The source the page shows, matching the markup below apart from the preview's width. */
const CODE = `<MergeBox
	state="merged"
	action="/acme/delta/pull/399/merge"
	labels={labels}
	followUp={
		<form method="post" action="/acme/delta/branches/fix-tokenizer-offsets/delete">
			<Button type="submit" variant="outline" size="sm">Delete branch</Button>
		</form>
	}
/>`;

/** What the preview registry reads: the title, the source to show, and the box to draw. */
export default {
	title: "Merged, with the branch left to delete",
	code: CODE,
	render: () => (
		<div mix={[is("full"), maxIs("40rem")]}>
			<MergeBox
				id="preview-merge-box-merged"
				state="merged"
				action={MERGE_ACTION}
				labels={MERGE_LABELS}
				followUp={
					<form method="post" action="/examples/acme/delta/branches/fix-tokenizer-offsets/delete">
						<Button type="submit" variant="outline" size="sm">
							Delete branch
						</Button>
					</form>
				}
			/>
		</div>
	),
};
