/**
 * Live preview for `FanOutDiagram`: one feed fetch travelling down the trunk and along the
 * bus to five readers' queues, each lighting in turn before the delivery badge settles.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { InboxIcon, RssIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { FanOutDiagram } from "@sdxc/ui/patterns";

/** The source the page shows, matching the markup below. */
const CODE = `<FanOutDiagram
	aria-label="One feed fetch reaches every reader"
	pauseLabel="Pause the animation"
	source={{
		icon: <RssIcon size={14} aria-hidden="true" />,
		title: "Feed fetched once",
		detail: "GET /blog/feed.xml",
	}}
	targets={[
		{ title: "Ana's queue", detail: "+3 posts" },
		{ title: "Ben's queue", detail: "+3 posts" },
		{ title: "Chen's queue", detail: "+3 posts" },
		{ title: "Dana's queue", detail: "+3 posts" },
		{ title: "Eli's queue", detail: "+3 posts" },
	]}
	outcome="Delivered to 5 readers"
	footnote={
		<>
			<InboxIcon size={14} aria-hidden="true" />
			One request, however many follow
		</>
	}
/>`;

/** What the preview registry reads: the source to show, and the diagram to draw. */
export default {
	code: CODE,
	viewports: true,
	render: () => (
		<div mix={[raw({ inlineSize: "100%", maxInlineSize: "32rem", marginInline: "auto" })]}>
			<FanOutDiagram
				aria-label="One feed fetch reaches every reader"
				pauseLabel="Pause the animation"
				source={{
					icon: <RssIcon size={14} aria-hidden="true" />,
					title: "Feed fetched once",
					detail: "GET /blog/feed.xml",
				}}
				targets={[
					{ title: "Ana's queue", detail: "+3 posts" },
					{ title: "Ben's queue", detail: "+3 posts" },
					{ title: "Chen's queue", detail: "+3 posts" },
					{ title: "Dana's queue", detail: "+3 posts" },
					{ title: "Eli's queue", detail: "+3 posts" },
				]}
				outcome="Delivered to 5 readers"
				footnote={
					<>
						<InboxIcon size={14} aria-hidden="true" />
						One request, however many follow
					</>
				}
			/>
		</div>
	),
};
