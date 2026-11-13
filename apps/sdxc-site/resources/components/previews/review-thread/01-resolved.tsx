/**
 * Live example for a resolved `ReviewThread`: folded to the line that says who resolved it,
 * with the conversation and Unresolve one click away.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is, m, maxIs } from "@sdxc/u/size";
import { ReviewThread } from "@sdxc/ui/app/review-thread";

import { MoreMenu, Person, PULL, THREAD_LABELS } from "~/resources/components/previews/diff";

/** The source the page shows, matching the markup below apart from the preview's width. */
const CODE = `<ReviewThread
	resolved
	resolvedSummary="sergio marked this conversation as resolved"
	comments={comments}
	resolveAction="/acme/delta/pull/412/threads/1838/resolve"
	labels={labels}
/>`;

/** Ana asks about the old module, and the author answers with the commit that removed it. */
const COMMENTS: ReviewThread.Comment[] = [
	{
		id: "discussion_r1838",
		avatar: <Person initials="AS" />,
		author: "ana",
		action: "commented",
		time: "yesterday",
		menu: <MoreMenu />,
		body: (
			<p mix={[m(0)]}>
				Nothing imports <code>./chars.js</code> after this. Can it go?
			</p>
		),
	},
	{
		id: "discussion_r1840",
		avatar: <Person initials="SX" />,
		author: "sergio",
		action: "commented",
		time: "yesterday",
		menu: <MoreMenu />,
		body: (
			<p mix={[m(0)]}>
				Deleted in <a href="/examples/acme/delta/commit/b81d3e7">b81d3e7</a>.
			</p>
		),
	},
];

/** What the preview registry reads: the title, the source to show, and the thread to draw. */
export default {
	title: "Resolved, folded to one line",
	code: CODE,
	render: () => (
		<div mix={[is("full"), maxIs("48rem")]}>
			<ReviewThread
				id="preview-review-thread-resolved"
				resolved
				resolvedSummary="sergio marked this conversation as resolved"
				comments={COMMENTS}
				resolveAction={`${PULL}/threads/1838/resolve`}
				labels={THREAD_LABELS}
			/>
		</div>
	),
};
