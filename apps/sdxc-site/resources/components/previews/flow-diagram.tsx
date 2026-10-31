/**
 * Live preview for `FlowDiagram`: a deploy pipeline triggered by a push, its four steps
 * passing in turn along the rail, and the outcome settling before the loop restarts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BellIcon, GitBranchIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { FlowDiagram } from "@sdxc/ui/patterns";

/** The source the page shows, matching the markup below. */
const CODE = `<FlowDiagram
	aria-label="A deploy, step by step"
	pauseLabel="Pause the animation"
	trigger={{
		icon: <GitBranchIcon size={14} aria-hidden="true" />,
		title: "A push to main starts a deploy",
		detail: "Every commit, in order",
	}}
	steps={[
		{ title: "Install", code: "bun install --frozen-lockfile" },
		{ title: "Check", code: "bun check" },
		{ title: "Test", code: "bun run test" },
		{ title: "Ship", code: "sdxc deploy" },
	]}
	outcome="Deployed"
	footnote={
		<>
			<BellIcon size={14} aria-hidden="true" />
			A failed step pages the on-call
		</>
	}
/>`;

/** What the preview registry reads: the source to show, and the diagram to draw. */
export default {
	code: CODE,
	viewports: true,
	render: () => (
		<div mix={[raw({ inlineSize: "100%", maxInlineSize: "32rem", marginInline: "auto" })]}>
			<FlowDiagram
				aria-label="A deploy, step by step"
				pauseLabel="Pause the animation"
				trigger={{
					icon: <GitBranchIcon size={14} aria-hidden="true" />,
					title: "A push to main starts a deploy",
					detail: "Every commit, in order",
				}}
				steps={[
					{ title: "Install", code: "bun install --frozen-lockfile" },
					{ title: "Check", code: "bun check" },
					{ title: "Test", code: "bun run test" },
					{ title: "Ship", code: "sdxc deploy" },
				]}
				outcome="Deployed"
				footnote={
					<>
						<BellIcon size={14} aria-hidden="true" />A failed step pages the on-call
					</>
				}
			/>
		</div>
	),
};
