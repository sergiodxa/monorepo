/**
 * Live preview for `PlanNotice`: the sentence a gated help page opens with, under its
 * title, with the plan names linked to pricing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is } from "@sdxc/u/size";
import { PlanNotice } from "@sdxc/ui/docs";

/** The source the page shows, matching the markup below. */
const CODE = `<PlanNotice>
	Available on the <a href="/examples/pricing">Team and Business plans</a>, for workspace admins.
</PlanNotice>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full")]}>
			<PlanNotice>
				Available on the <a href="/examples/pricing">Team and Business plans</a>, for workspace
				admins.
			</PlanNotice>
		</div>
	),
};
