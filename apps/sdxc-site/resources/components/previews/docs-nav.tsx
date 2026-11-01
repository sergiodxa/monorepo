/**
 * Live preview for `DocsNav`: a product's help docs sidebar with the reader on the webhook
 * alerts page, its group open around it, a "New" badge, the title filter, and a support
 * link at the foot.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocsTree } from "@sdxc/ui/docs";

import { fg } from "@sdxc/u/color";
import { is, maxIs } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { DocsNav } from "@sdxc/ui/docs";

/** Three sections the way a monitoring product's help docs route a reader. */
const TREE: DocsTree = {
	label: "Documentation",
	sections: [
		{
			title: "Get started",
			items: [
				{ title: "Quickstart", href: "#quickstart" },
				{ title: "Add your first monitor", href: "#first-monitor" },
			],
		},
		{
			title: "Alerts",
			items: [
				{ title: "How alerts work", href: "#alerts" },
				{
					title: "Channels",
					items: [
						{ title: "Email", href: "#email" },
						{ title: "Slack", href: "#slack" },
						{ title: "Webhooks", href: "#webhooks", badge: "New" },
					],
				},
				{ title: "Escalation policies", href: "#escalation" },
			],
		},
		{
			title: "Fix a problem",
			items: [
				{ title: "I didn't get an alert", href: "#no-alert" },
				{ title: "My check says down but the site is up", href: "#false-down" },
			],
		},
	],
};

/** The source the page shows, matching the markup below. */
const CODE = `<DocsNav
	tree={tree}
	activePath="/docs/alerts/webhooks"
	collapseGroups
	filter={{ label: "Filter pages", placeholder: "Filter pages", noResults: "No page matches" }}
	footer={<a href="/support">Contact support</a>}
/>`;

/** What the preview registry reads: the source to show, and the sidebar to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full"), maxIs("16rem")]}>
			<DocsNav
				tree={TREE}
				activePath="#webhooks"
				collapseGroups
				filter={{
					label: "Filter pages",
					placeholder: "Filter pages",
					noResults: "No page matches",
				}}
				footer={
					<a href="#support" mix={[text("sm"), fg("brand")]}>
						Contact support
					</a>
				}
			/>
		</div>
	),
};
