/**
 * Live example for an outdated `ReviewThread`: the lines it was left on changed in a later
 * push, so it folds behind its badge and the file's path and keeps the code it was about as
 * an excerpt, drawn from that push's diff.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { diffLines } from "@sdxc/diff";
import { is, m, maxIs } from "@sdxc/u/size";
import { ReviewThread } from "@sdxc/ui/app/review-thread";

import {
	IDENTIFIER_BEFORE,
	MoreMenu,
	Person,
	PULL,
	THREAD_LABELS,
} from "~/resources/components/previews/diff";

/** The source the page shows, matching the markup below apart from the preview's width. */
const CODE = `<ReviewThread
	outdated
	excerpt={{ path: "src/lexer/identifier.ts", hunks: excerpt, language: "ts" }}
	comments={comments}
	replyAction="/acme/delta/pull/412/threads/1822/replies"
	labels={labels}
/>`;

/** The file as the first push left it, which read code points at the start only. */
const FIRST_PUSH = IDENTIFIER_BEFORE.replace(
	"isIdentifierStart(source.charCodeAt(offset))",
	"isIdentifierStart(source.codePointAt(offset) ?? 0)",
);

/** Mei's note on the first push, which the second push answered. */
const COMMENTS: ReviewThread.Comment[] = [
	{
		id: "discussion_r1822",
		avatar: <Person initials="MC" />,
		author: "mei",
		action: "commented",
		time: "3 days ago",
		menu: <MoreMenu />,
		body: (
			<p mix={[m(0)]}>
				This reads <code>𝑥</code> as a start, but <code>end = offset + 1</code> below still lands
				inside its surrogate pair.
			</p>
		),
	},
];

/** What the preview registry reads: the title, the source to show, and the thread to draw. */
export default {
	title: "Outdated, with the code it was about",
	code: CODE,
	render: () => (
		<div mix={[is("full"), maxIs("48rem")]}>
			<ReviewThread
				id="preview-review-thread-outdated"
				outdated
				excerpt={{
					path: "src/lexer/identifier.ts",
					hunks: diffLines(IDENTIFIER_BEFORE, FIRST_PUSH, { context: 2 }).hunks,
					language: "ts",
				}}
				comments={COMMENTS}
				replyAction={`${PULL}/threads/1822/replies`}
				labels={THREAD_LABELS}
			/>
		</div>
	),
};
