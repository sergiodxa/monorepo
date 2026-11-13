/**
 * Live example for a `ReviewThread` with a suggested change: the replacement drawn as a small
 * diff with "Apply suggestion", and the author's reply still pending, badged until their
 * review is submitted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { diffLines } from "@sdxc/diff";
import { is, m, maxIs } from "@sdxc/u/size";
import { ReviewThread } from "@sdxc/ui/app/review-thread";

import {
	IDENTIFIER_AFTER,
	MoreMenu,
	Person,
	PULL,
	THREAD_LABELS,
} from "~/resources/components/previews/diff";

/** The source the page shows, matching the markup below apart from the preview's width. */
const CODE = `<ReviewThread
	comments={[
		{ author: "ana", action: "suggested a change", body: <p>…</p>, … },
		{ author: "sergio", action: "commented", pending: true, body: <p>…</p>, … },
	]}
	suggestion={{
		path: "src/lexer/identifier.ts",
		hunks: diffLines(before, after, { context: 0 }).hunks,
		language: "ts",
		applyAction: "/acme/delta/pull/412/threads/1841/suggestions/1/apply",
	}}
	replyAction="/acme/delta/pull/412/threads/1841/replies"
	resolveAction="/acme/delta/pull/412/threads/1841/resolve"
	labels={labels}
/>`;

/** The branch's file with Ana's suggestion applied to line 10. */
const SUGGESTED = IDENTIFIER_AFTER.replace(
	"let end = offset + (first > 0xffff ? 2 : 1);",
	"let end = offset + codePointLength(first);",
);

/** Ana's suggestion, and the author's reply in a review not yet submitted. */
const COMMENTS: ReviewThread.Comment[] = [
	{
		id: "discussion_r1841",
		avatar: <Person initials="AS" />,
		author: "ana",
		action: "suggested a change",
		time: "yesterday",
		menu: <MoreMenu />,
		body: (
			<p mix={[m(0)]}>
				Line 14 repeats this check. With a helper in <code>unicode.ts</code> both read the same:
			</p>
		),
	},
	{
		id: "discussion_r1849",
		avatar: <Person initials="SX" />,
		author: "sergio",
		action: "commented",
		time: "just now",
		pending: true,
		menu: <MoreMenu />,
		body: <p mix={[m(0)]}>Applying it, and the same on line 14.</p>,
	},
];

/** What the preview registry reads: the title, the source to show, and the thread to draw. */
export default {
	title: "A suggested change and a pending reply",
	code: CODE,
	render: () => (
		<div mix={[is("full"), maxIs("48rem")]}>
			<ReviewThread
				id="preview-review-thread-suggestion"
				comments={COMMENTS}
				suggestion={{
					path: "src/lexer/identifier.ts",
					hunks: diffLines(IDENTIFIER_AFTER, SUGGESTED, { context: 0 }).hunks,
					language: "ts",
					applyAction: `${PULL}/threads/1841/suggestions/1/apply`,
				}}
				replyAction={`${PULL}/threads/1841/replies`}
				resolveAction={`${PULL}/threads/1841/resolve`}
				labels={THREAD_LABELS}
			/>
		</div>
	),
};
