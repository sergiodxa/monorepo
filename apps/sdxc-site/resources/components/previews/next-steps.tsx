/**
 * Live preview for `NextSteps`: the hand-written path closing a quickstart, once as cards
 * and once as a ruled list, each link saying what it gets the reader.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { NextSteps } from "@sdxc/ui/docs";

/** The three destinations both variants list. */
const ITEMS: NextSteps.Item[] = [
	{
		title: "Route alerts",
		href: "#alerts",
		description: "Page the person on call instead of the whole team.",
	},
	{
		title: "Publish a status page",
		href: "#status-pages",
		description: "Tell customers what is down before they ask.",
	},
	{ title: "Invite your team", href: "#team", description: "Share monitors and on-call duty." },
];

/** The source the page shows, matching the markup below. */
const CODE = `<NextSteps
	title="Next steps"
	id="next-steps"
	items={[
		{ title: "Route alerts", href: "/docs/alerts", description: "Page the person on call instead of the whole team." },
		{ title: "Publish a status page", href: "/docs/status-pages", description: "Tell customers what is down before they ask." },
		{ title: "Invite your team", href: "/docs/team", description: "Share monitors and on-call duty." },
	]}
/>

<NextSteps variant="list" title="Related" items={items} />`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full"), vstack({ gap: 12, align: "stretch" })]}>
			<NextSteps title="Next steps" id="preview-next-steps" items={ITEMS} />
			<NextSteps variant="list" title="Related" items={ITEMS} />
		</div>
	),
};
