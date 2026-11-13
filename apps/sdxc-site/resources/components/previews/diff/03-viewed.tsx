/**
 * Live example for a `Diff` mid-review: the lexer file is marked viewed, so it renders closed
 * with its counts still in the header, and the toolbar's bar fills to one of two files.
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
	indexHunks,
	MoreMenu,
	PULL,
	TOOLBAR_LABELS,
	ViewedToggle,
} from "~/resources/components/previews/diff";

/** The source the page shows, matching the markup below apart from the preview's width. */
const CODE = `<Diff labels={{ copied: "Copied" }}>
	<Diff.Toolbar view="unified" unifiedHref={unifiedHref} splitHref={splitHref} viewed={1} total={2} labels={toolbarLabels} />
	<Diff.File
		path="src/lexer/identifier.ts"
		status="modified"
		additions={9}
		deletions={4}
		hunks={hunks}
		viewed
		viewedControl={<OptimisticToggle action="/acme/delta/pull/412/files/viewed" name="viewed" pressed … />}
		labels={fileLabels}
	/>
	<Diff.File path="src/lexer/index.ts" status="modified" additions={1} deletions={1} hunks={indexHunks} language="ts" labels={fileLabels} />
</Diff>`;

/** What the preview registry reads: the title, the source to show, and the files to draw. */
export default {
	title: "A viewed file, collapsed",
	code: CODE,
	render: () => {
		let identifier = diffLines(IDENTIFIER_BEFORE, IDENTIFIER_AFTER);
		return (
			<div mix={[is("full")]}>
				<Diff labels={{ copied: "Copied" }}>
					<Diff.Toolbar
						view="unified"
						unifiedHref={`${PULL}/files?diff=unified`}
						splitHref={`${PULL}/files?diff=split`}
						viewed={1}
						total={2}
						labels={TOOLBAR_LABELS}
					/>
					<Diff.File
						id="preview-diff-viewed"
						path="src/lexer/identifier.ts"
						status="modified"
						additions={identifier.additions}
						deletions={identifier.deletions}
						hunks={identifier.hunks}
						language="ts"
						viewed
						commentHref={commentHref}
						menu={<MoreMenu />}
						viewedControl={<ViewedToggle path="src/lexer/identifier.ts" viewed />}
						labels={FILE_LABELS}
					/>
					<Diff.File
						id="preview-diff-index"
						path="src/lexer/index.ts"
						status="modified"
						additions={1}
						deletions={1}
						hunks={indexHunks()}
						language="ts"
						commentHref={commentHref}
						menu={<MoreMenu />}
						viewedControl={<ViewedToggle path="src/lexer/index.ts" viewed={false} />}
						labels={FILE_LABELS}
					/>
				</Diff>
			</div>
		);
	},
};
