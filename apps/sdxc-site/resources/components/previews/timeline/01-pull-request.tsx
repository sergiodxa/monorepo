/**
 * Live example for a pull request's conversation on a `Timeline`: comments are cards with the
 * author's avatar on the rail, a push folds its commits under one stop with each commit's
 * checks, and housekeeping such as a review request stays a single line.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { EllipsisIcon, EyeIcon, GitCommitHorizontalIcon } from "@sdxc/icons";
import { hstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { Avatar, Button } from "@sdxc/ui";
import { CheckRunIcon } from "@sdxc/ui/app/check-runs";
import { Timeline } from "@sdxc/ui/timeline";

/** The source the page shows, matching the markup below. */
const CODE = `<Timeline aria-label="Conversation">
	<Timeline.Comment
		id="issuecomment-1"
		avatar={<Avatar size="sm">…</Avatar>}
		author="sergio"
		action="commented"
		time="2 days ago"
		menu={<Button variant="ghost" size="sm" aria-label="Comment actions"><EllipsisIcon /></Button>}
		reactions={<Button variant="outline" size="sm">👍 3</Button>}
	>
		<p>Identifiers that start with a non-ASCII letter fall through to the error token…</p>
	</Timeline.Comment>
	<Timeline.Commits icon={<GitCommitHorizontalIcon />} actor="sergio" summary="added 2 commits" time="2 days ago">
		<Timeline.Commit sha="4f2a9c1" href="/acme/delta/commit/4f2a9c1" check={<CheckRunIcon state="success" label="All checks passed" />}>
			Read identifiers with Unicode starts
		</Timeline.Commit>
		<Timeline.Commit sha="b81d3e7" href="/acme/delta/commit/b81d3e7" check={<CheckRunIcon state="failure" label="1 check failed" />}>
			Drop the ASCII-only fast path
		</Timeline.Commit>
	</Timeline.Commits>
	<Timeline.Event icon={<EyeIcon />} actor="sergio" time="2 days ago">requested a review from ana</Timeline.Event>
	<Timeline.Comment id="issuecomment-2" avatar={<Avatar size="sm">…</Avatar>} author="ana" action="commented" time="yesterday">
		<p>Looks right. Can we keep the fast path for pure ASCII input? The benchmark drops 8%.</p>
	</Timeline.Comment>
</Timeline>`;

/** Props for {@link Person}. */
interface PersonProps {
	initials: string;
}

/** A person's small avatar, drawn from their initials. */
function Person(handle: Handle<PersonProps>) {
	return () => (
		<Avatar size="sm">
			<Avatar.Fallback>{handle.props.initials}</Avatar.Fallback>
		</Avatar>
	);
}

/** The `⋯` button a comment's header ends with. */
function CommentMenu() {
	return () => (
		<Button variant="ghost" size="sm" aria-label="Comment actions">
			<EllipsisIcon aria-hidden="true" />
		</Button>
	);
}

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "A pull request's conversation",
	code: CODE,
	render: () => (
		<Timeline aria-label="Conversation">
			<Timeline.Comment
				id="preview-comment-1"
				avatar={<Person initials="SX" />}
				author="sergio"
				action="commented"
				time="2 days ago"
				menu={<CommentMenu />}
				reactions={
					<div mix={[hstack({ gap: 1 })]}>
						<Button variant="outline" size="sm" aria-label="3 people reacted with thumbs up">
							👍 3
						</Button>
						<Button variant="outline" size="sm" aria-label="1 person reacted with rocket">
							🚀 1
						</Button>
					</div>
				}
			>
				<p mix={[m(0)]}>
					Identifiers that start with a non-ASCII letter fall through to the error token, so{" "}
					<code>ñandú</code> never parses. This reads the start through the Unicode ID_Start table.
				</p>
			</Timeline.Comment>
			<Timeline.Commits
				icon={<GitCommitHorizontalIcon />}
				actor="sergio"
				summary="added 2 commits"
				time="2 days ago"
			>
				<Timeline.Commit
					sha="4f2a9c1"
					href="/examples/acme/delta/commit/4f2a9c1"
					check={<CheckRunIcon state="success" label="All checks passed" />}
				>
					Read identifiers with Unicode starts
				</Timeline.Commit>
				<Timeline.Commit
					sha="b81d3e7"
					href="/examples/acme/delta/commit/b81d3e7"
					check={<CheckRunIcon state="failure" label="1 check failed" />}
				>
					Drop the ASCII-only fast path
				</Timeline.Commit>
			</Timeline.Commits>
			<Timeline.Event icon={<EyeIcon />} actor="sergio" time="2 days ago">
				requested a review from ana
			</Timeline.Event>
			<Timeline.Comment
				id="preview-comment-2"
				avatar={<Person initials="AS" />}
				author="ana"
				action="commented"
				time="yesterday"
				menu={<CommentMenu />}
			>
				<p mix={[m(0)]}>
					Looks right. Can we keep the fast path for pure ASCII input? The lexer benchmark drops 8%
					without it.
				</p>
			</Timeline.Comment>
		</Timeline>
	),
};
