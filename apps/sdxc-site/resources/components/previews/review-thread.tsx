/**
 * Live preview for `ReviewThread`: an open conversation on a line of a pull request, a
 * question and its answer above the reply box and Resolve, both plain forms that post to the
 * example's thread.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is, maxIs } from "@sdxc/u/size";
import { ReviewThread } from "@sdxc/ui/app/review-thread";

import { PULL, THREAD_COMMENTS, THREAD_LABELS } from "~/resources/components/previews/diff";

/** The source the page shows, matching the markup below apart from the preview's width. */
const CODE = `<Frame name="thread-1841" src="/acme/delta/pull/412/threads/1841">
	<ReviewThread
		frame="thread-1841"
		comments={[
			{ id: "discussion_r1841", avatar: <Avatar>…</Avatar>, author: "ana", action: "commented", time: "yesterday", body: <p>…</p> },
			{ id: "discussion_r1847", avatar: <Avatar>…</Avatar>, author: "sergio", action: "commented", time: "2 hours ago", body: <p>…</p> },
		]}
		replyAction="/acme/delta/pull/412/threads/1841/replies"
		resolveAction="/acme/delta/pull/412/threads/1841/resolve"
		fields={<input type="hidden" name="csrf" value={token} />}
		labels={{
			reply: "Reply",
			replyPlaceholder: "Reply…",
			resolve: "Resolve conversation",
			unresolve: "Unresolve conversation",
			outdated: "Outdated",
			pending: "Pending",
			suggestion: "Suggested change",
			applySuggestion: "Apply suggestion",
			columns,
		}}
	/>
</Frame>`;

/** What the preview registry reads: the source to show, and the thread to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full"), maxIs("48rem")]}>
			<ReviewThread
				id="preview-review-thread"
				comments={THREAD_COMMENTS}
				replyAction={`${PULL}/threads/1841/replies`}
				resolveAction={`${PULL}/threads/1841/resolve`}
				labels={THREAD_LABELS}
			/>
		</div>
	),
};
