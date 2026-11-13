/**
 * Live example for `Diff` files that draw no lines, each saying why: an image git declared
 * binary, and a lockfile whose patch the server dropped for size.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is } from "@sdxc/u/size";
import { Diff } from "@sdxc/ui/app/diff";

import { FILE_LABELS, MoreMenu, ViewedToggle } from "~/resources/components/previews/diff";

/** The source the page shows, matching the markup below apart from the preview's width. */
const CODE = `<Diff labels={{ copied: "Copied" }}>
	<Diff.File path="docs/assets/identifiers.png" status="modified" additions={0} deletions={0} binary labels={fileLabels} />
	<Diff.File path="package-lock.json" status="modified" additions={1834} deletions={1210} tooLarge labels={fileLabels} />
</Diff>`;

/** What the preview registry reads: the title, the source to show, and the files to draw. */
export default {
	title: "Binary and too large to show",
	code: CODE,
	render: () => (
		<div mix={[is("full")]}>
			<Diff labels={{ copied: "Copied" }}>
				<Diff.File
					id="preview-diff-binary"
					path="docs/assets/identifiers.png"
					status="modified"
					additions={0}
					deletions={0}
					binary
					menu={<MoreMenu />}
					viewedControl={<ViewedToggle path="docs/assets/identifiers.png" viewed={false} />}
					labels={FILE_LABELS}
				/>
				<Diff.File
					id="preview-diff-lockfile"
					path="package-lock.json"
					status="modified"
					additions={1834}
					deletions={1210}
					tooLarge
					menu={<MoreMenu />}
					viewedControl={<ViewedToggle path="package-lock.json" viewed={false} />}
					labels={FILE_LABELS}
				/>
			</Diff>
		</div>
	),
};
