/**
 * Live example for a split `Diff`: the old and new sides of the lexer's change beside each
 * other, the import's one changed word marked on both. Once the pane is narrower than 48rem
 * the same rows lay out as unified, so a phone never scrolls sideways.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { diffLines } from "@sdxc/diff";
import { is } from "@sdxc/u/size";
import { Diff } from "@sdxc/ui/app/diff";

import {
	commentHref,
	FILE_LABELS,
	IDENTIFIER_AFTER,
	IDENTIFIER_BEFORE,
	MoreMenu,
	PULL,
	TOOLBAR_LABELS,
	ViewedToggle,
} from "~/resources/components/previews/diff";

/** The source the page shows, matching the markup below apart from the preview's width. */
const CODE = `<Diff labels={{ copied: "Copied" }}>
	<Diff.Toolbar
		view="split"
		unifiedHref="/acme/delta/pull/412/files?diff=unified"
		splitHref="/acme/delta/pull/412/files?diff=split"
		labels={toolbarLabels}
	/>
	<Diff.File path="src/lexer/identifier.ts" status="modified" additions={9} deletions={4} hunks={hunks} language="ts" view="split" labels={fileLabels} />
</Diff>`;

/** What the preview registry reads: the title, the source to show, and the file to draw. */
export default {
	title: "Split, old and new side by side",
	code: CODE,
	render: () => {
		let identifier = diffLines(IDENTIFIER_BEFORE, IDENTIFIER_AFTER);
		return (
			<div mix={[is("full")]}>
				<Diff labels={{ copied: "Copied" }}>
					<Diff.Toolbar
						view="split"
						unifiedHref={`${PULL}/files?diff=unified`}
						splitHref={`${PULL}/files?diff=split`}
						labels={TOOLBAR_LABELS}
					/>
					<Diff.File
						id="preview-diff-split"
						path="src/lexer/identifier.ts"
						status="modified"
						additions={identifier.additions}
						deletions={identifier.deletions}
						hunks={identifier.hunks}
						language="ts"
						view="split"
						commentHref={commentHref}
						menu={<MoreMenu />}
						viewedControl={<ViewedToggle path="src/lexer/identifier.ts" viewed={false} />}
						labels={FILE_LABELS}
					/>
				</Diff>
			</div>
		);
	},
};
