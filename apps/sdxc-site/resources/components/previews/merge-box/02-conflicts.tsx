/**
 * Live example for `MergeBox` with a conflicting branch: the conflict row names the files in
 * the way and the disabled button says the conflicts come first.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is, maxIs } from "@sdxc/u/size";
import { MergeBox } from "@sdxc/ui/app/merge-box";

import { MERGE_ACTION, MERGE_LABELS } from "~/resources/components/previews/merge-box";

/** The source the page shows, matching the markup below apart from the preview's width. */
const CODE = `<MergeBox
	state="conflicts"
	action="/acme/delta/pull/405/merge"
	rows={{
		reviews: { tone: "success", title: "2 approving reviews" },
		checks: { tone: "danger", title: "1 failing check", detail: "test (ubuntu-latest) failed after 3m 41s" },
		conflicts: {
			tone: "danger",
			title: "This branch has conflicts that must be resolved",
			detail: "Conflicting files: src/parser.ts, src/lexer/tokens.ts",
		},
	}}
	labels={labels}
/>`;

/** What the preview registry reads: the title, the source to show, and the box to draw. */
export default {
	title: "Conflicts with the base branch",
	code: CODE,
	render: () => (
		<div mix={[is("full"), maxIs("40rem")]}>
			<MergeBox
				id="preview-merge-box-conflicts"
				state="conflicts"
				action={MERGE_ACTION}
				labels={MERGE_LABELS}
				rows={{
					reviews: { tone: "success", title: "2 approving reviews" },
					checks: {
						tone: "danger",
						title: "1 failing check",
						detail: "test (ubuntu-latest) failed after 3m 41s",
					},
					conflicts: {
						tone: "danger",
						title: "This branch has conflicts that must be resolved",
						detail: "Conflicting files: src/parser.ts, src/lexer/tokens.ts",
					},
				}}
			/>
		</div>
	),
};
