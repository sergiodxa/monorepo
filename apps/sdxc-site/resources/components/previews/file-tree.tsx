/**
 * Live preview for `FileTree`: an app's layout with the routes file the page is about
 * highlighted, short comments, a folded directory and a placeholder for files left out.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is } from "@sdxc/u/size";
import { FileTree } from "@sdxc/ui";

/** The tree both the source and the markup draw. */
const NODES: FileTree.Entry[] = [
	{
		name: "app",
		children: [
			{ name: "http", children: [{ name: "controllers", children: [{ name: "home.tsx" }, "…"] }] },
			{ name: "jobs", collapsed: true, children: [{ name: "send-digest.ts" }] },
		],
	},
	{
		name: "routes",
		children: [{ name: "web.ts", highlight: true, comment: "every URL the app serves" }],
	},
	{ name: "database", children: [{ name: "seed.ts" }] },
	{ name: "package.json" },
	{ name: "README.md" },
];

/** The source the page shows, matching the markup below. */
const CODE = `<FileTree
	aria-label="Project layout"
	moreLabel="More files"
	nodes={[
		{
			name: "app",
			children: [
				{ name: "http", children: [{ name: "controllers", children: [{ name: "home.tsx" }, "…"] }] },
				{ name: "jobs", collapsed: true, children: [{ name: "send-digest.ts" }] },
			],
		},
		{ name: "routes", children: [{ name: "web.ts", highlight: true, comment: "every URL the app serves" }] },
		{ name: "database", children: [{ name: "seed.ts" }] },
		{ name: "package.json" },
		{ name: "README.md" },
	]}
/>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full")]}>
			<FileTree aria-label="Project layout" moreLabel="More files" nodes={NODES} />
		</div>
	),
};
